import { useEffect, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { Spinner } from "../../../components/ui/Spinner";
import { insightsService } from "../../../services/faqService";
import type { FAQRebuildPreview, FAQRebuildScope } from "../types";

/**
 * The windows offered, in the order they are shown.
 *
 * `sinceDays` doubles as the key: a scope is fully described by how far back it
 * reaches, and the whole-history option is the absence of that.
 */
const WINDOWS_IN_DAYS = [7, 30, 90] as const;

const WINDOW_LABELS: Record<(typeof WINDOWS_IN_DAYS)[number], string> = {
  7: "Asked in the last 7 days",
  30: "Asked in the last 30 days",
  90: "Asked in the last 90 days",
};

const ALL_SCOPE_KEY = "all";
type ScopeKey = typeof ALL_SCOPE_KEY | `${(typeof WINDOWS_IN_DAYS)[number]}`;

const SCOPE_OPTIONS: FilterSelectOption<ScopeKey>[] = [
  { value: ALL_SCOPE_KEY, label: "All questions" },
  ...WINDOWS_IN_DAYS.map((days) => ({
    value: `${days}` as ScopeKey,
    label: WINDOW_LABELS[days],
  })),
];

/** Thousands separator pinned to the locale the app already formats dates in. */
function formatCount(value: number): string {
  return value.toLocaleString("en-GB");
}

export interface RebuildFaqDialogProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onConfirm: (scope: FAQRebuildScope) => void;
}

/**
 * Confirms a manual FAQ rebuild and lets the PM choose how far back it reaches.
 *
 * A rebuild is not a refresh: it throws the current entries away and regroups
 * from scratch, so titles change, entry links break, and anything outside the
 * chosen scope disappears from the counts. None of that is recoverable by
 * pressing the button again, which is why it asks first.
 *
 * The dialog only decides; it does not wait. Confirming hands the scope back and
 * closes, because a rebuild takes as long as an AI call and there is nothing to
 * watch — the page reports the progress from then on.
 *
 * The scope picker is the app's `FilterSelect` in its portalled mode, so it
 * matches the dropdowns on the page behind it. The portal is what makes that
 * possible here: the modal panel clips its overflow and its footer sits in a
 * sibling stacking context, which would otherwise cut the open list off and
 * paint what is left of it underneath the buttons.
 */
export function RebuildFaqDialog({ isOpen, projectId, onClose, onConfirm }: RebuildFaqDialogProps) {
  const [scope, setScope] = useState<ScopeKey>(ALL_SCOPE_KEY);
  const [preview, setPreview] = useState<FAQRebuildPreview | null>(null);
  const [isLoadingPreview, setLoadingPreview] = useState(false);

  // Loaded when the dialog opens rather than on every selection: one request
  // answers every option, so switching between them costs nothing.
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const load = async () => {
      // Yield before touching state: a setState in the effect's own frame is a
      // cascading render, and nothing here needs to happen synchronously.
      await Promise.resolve();
      if (!active) return;

      // Reopening starts from the default scope again: a rebuild is
      // destructive and this dialog is the only place its reach is stated, so
      // silently reoffering the last narrow window is the wrong thing to
      // remember. Set here rather than in the effect body for the same reason
      // the rest is -- a setState in the effect's own frame cascades.
      setScope(ALL_SCOPE_KEY);
      setLoadingPreview(true);
      setPreview(null);
      try {
        const result = await insightsService.fetchRebuildPreview(projectId, [...WINDOWS_IN_DAYS]);
        if (active) setPreview(result);
      } catch (error) {
        // Swallowed on purpose: the count is a decision aid, and losing it is
        // no reason to block a rebuild the PM already asked for.
        console.error("Could not load the rebuild preview", error);
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isOpen, projectId]);

  const selectedCount = ((): number | undefined => {
    if (!preview) return undefined;
    if (scope === ALL_SCOPE_KEY) {
      return Math.min(preview.totalQuestionCount, preview.rebuildQuestionLimit);
    }
    return preview.windows.find((window) => String(window.sinceDays) === scope)?.questionCount;
  })();

  const scopeFor = (key: ScopeKey): FAQRebuildScope =>
    key === ALL_SCOPE_KEY ? {} : { sinceDays: Number(key) };

  const isCapped =
    scope === ALL_SCOPE_KEY &&
    preview !== null &&
    preview.totalQuestionCount > preview.rebuildQuestionLimit;

  return (
    <AlertDialog
      isOpen={isOpen}
      title="Rebuild the FAQ?"
      variant="danger"
      // The count sits in the label so the number and the action that consumes
      // it cannot drift apart on screen.
      confirmLabel={
        selectedCount === undefined ? "Rebuild" : `Rebuild ${formatCount(selectedCount)} questions`
      }
      onClose={onClose}
      onConfirm={() => onConfirm(scopeFor(scope))}
      description={
        <div className="space-y-4">
          <p>
            This regroups every question from scratch and replaces the current entries. Titles are
            written again, and links to individual entries stop working.
          </p>

          <div className="space-y-1.5">
            {/* A caption rather than a `<label>`: FilterSelect is a combobox
                built from a button, and it names itself through `label`. */}
            <div className="flex items-center gap-2 text-xs font-medium text-app-text">
              Questions to regroup
              {isLoadingPreview && <Spinner size="sm" label="Counting questions" />}
            </div>
            <FilterSelect
              label="Questions to regroup"
              value={scope}
              options={SCOPE_OPTIONS}
              onChange={setScope}
              className="w-full"
            />
          </div>

          {scope !== ALL_SCOPE_KEY && (
            <p className="rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
              Questions outside this range are dropped from the FAQ, including from the counts.
            </p>
          )}

          {isCapped && preview && (
            <p className="rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
              This project has {formatCount(preview.totalQuestionCount)} questions, and only the
              newest {formatCount(preview.rebuildQuestionLimit)} can be regrouped at once. The rest
              are dropped from the FAQ.
            </p>
          )}
        </div>
      }
    />
  );
}
