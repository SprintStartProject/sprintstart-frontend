import { useEffect, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Spinner } from "../../../components/ui/Spinner";
import { insightsService } from "../../../services/faqService";
import type { FAQRebuildPreview, FAQRebuildScope } from "../types";

/**
 * The choices offered, in the order they are shown.
 *
 * `sinceDays` doubles as the key: a scope is fully described by how far back it
 * reaches, and the whole-history option is the absence of that.
 */
const WINDOWS_IN_DAYS = [1, 7, 30, 90] as const;

const WINDOW_LABELS: Record<(typeof WINDOWS_IN_DAYS)[number], string> = {
  1: "Asked today",
  7: "Asked in the last 7 days",
  30: "Asked in the last 30 days",
  90: "Asked in the last 90 days",
};

const ALL_SCOPE_KEY = "all";
type ScopeKey = typeof ALL_SCOPE_KEY | `${(typeof WINDOWS_IN_DAYS)[number]}`;

/** Thousands separator pinned to the locale the app already formats dates in. */
function formatCount(value: number): string {
  return value.toLocaleString("en-GB");
}

export interface RebuildFaqDialogProps {
  isOpen: boolean;
  projectId: string;
  isRebuilding: boolean;
  errorMessage?: string;
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
 * The options are radios rather than a dropdown for two reasons: every scope
 * carries its own question count, which is the number the choice actually turns
 * on, and an overlay inside a modal is clipped by the modal's own rounding.
 */
export function RebuildFaqDialog({
  isOpen,
  projectId,
  isRebuilding,
  errorMessage,
  onClose,
  onConfirm,
}: RebuildFaqDialogProps) {
  const [scope, setScope] = useState<ScopeKey>(ALL_SCOPE_KEY);
  const [preview, setPreview] = useState<FAQRebuildPreview | null>(null);
  const [isLoadingPreview, setLoadingPreview] = useState(false);

  // Loaded when the dialog opens rather than on every selection: the counts
  // decide which option to pick, so they all have to be on screen at once —
  // and one request answers all of them.
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const load = async () => {
      // Yield before touching state: a setState in the effect's own frame is a
      // cascading render, and nothing here needs to happen synchronously.
      await Promise.resolve();
      if (!active) return;

      setLoadingPreview(true);
      setPreview(null);
      try {
        const result = await insightsService.fetchRebuildPreview(projectId, [...WINDOWS_IN_DAYS]);
        if (active) setPreview(result);
      } catch (error) {
        // Swallowed on purpose: the counts are a decision aid, and losing them
        // is no reason to block a rebuild the PM already asked for.
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

  const countFor = (key: ScopeKey): number | undefined => {
    if (!preview) return undefined;
    if (key === ALL_SCOPE_KEY) {
      return Math.min(preview.totalQuestionCount, preview.rebuildQuestionLimit);
    }
    return preview.windows.find((window) => String(window.sinceDays) === key)?.questionCount;
  };

  const scopeFor = (key: ScopeKey): FAQRebuildScope =>
    key === ALL_SCOPE_KEY ? {} : { sinceDays: Number(key) };

  const isCapped =
    scope === ALL_SCOPE_KEY &&
    preview !== null &&
    preview.totalQuestionCount > preview.rebuildQuestionLimit;

  const options: { key: ScopeKey; label: string }[] = [
    { key: ALL_SCOPE_KEY, label: "All questions" },
    ...WINDOWS_IN_DAYS.map((days) => ({
      key: String(days) as ScopeKey,
      label: WINDOW_LABELS[days],
    })),
  ];

  return (
    <AlertDialog
      isOpen={isOpen}
      title="Rebuild the FAQ?"
      variant="danger"
      confirmLabel="Rebuild"
      loadingLabel="Rebuilding…"
      isLoading={isRebuilding}
      errorMessage={errorMessage}
      onClose={onClose}
      onConfirm={() => onConfirm(scopeFor(scope))}
      description={
        <div className="space-y-4">
          <p>
            This regroups every question from scratch and replaces the current entries. Titles are
            written again, and links to individual entries stop working.
          </p>

          <fieldset className="space-y-1.5" disabled={isRebuilding}>
            <legend className="mb-1.5 flex items-center gap-2 text-xs font-medium text-app-text">
              Questions to regroup
              {isLoadingPreview && <Spinner size="sm" label="Counting questions" />}
            </legend>

            {options.map(({ key, label }) => {
              const count = countFor(key);
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    scope === key
                      ? "border-app-brand-border-strong bg-app-brand-soft text-app-text"
                      : "border-app-border text-app-text-muted hover:bg-app-surface-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="faq-rebuild-scope"
                    value={key}
                    checked={scope === key}
                    onChange={() => setScope(key)}
                    className="accent-app-brand"
                  />
                  <span className="flex-1">{label}</span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {count === undefined ? "—" : `${formatCount(count)} questions`}
                  </span>
                </label>
              );
            })}
          </fieldset>

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
