import { useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import type { FAQRebuildScope } from "../types";

/**
 * How much history to regroup.
 *
 * Presets rather than a free number field: the choice is "everything / recent /
 * only the last stretch", and a PM picking 1,437 questions has no better basis
 * for that number than the dialog does.
 */
type ScopeKey = "all" | "newest-500" | "newest-1000" | "months-3" | "months-6";

const SCOPE_OPTIONS: FilterSelectOption<ScopeKey>[] = [
  { value: "all", label: "All questions" },
  { value: "months-6", label: "Asked in the last 6 months" },
  { value: "months-3", label: "Asked in the last 3 months" },
  { value: "newest-1000", label: "Newest 1,000 questions" },
  { value: "newest-500", label: "Newest 500 questions" },
];

const SCOPES: Record<ScopeKey, FAQRebuildScope> = {
  all: {},
  "months-6": { sinceMonths: 6 },
  "months-3": { sinceMonths: 3 },
  "newest-1000": { questionLimit: 1000 },
  "newest-500": { questionLimit: 500 },
};

export interface RebuildFaqDialogProps {
  isOpen: boolean;
  /** Questions available in the project, uncapped. */
  questionCount?: number;
  /** Ceiling the backend enforces regardless of the chosen scope. */
  questionLimit?: number;
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
 */
export function RebuildFaqDialog({
  isOpen,
  questionCount,
  questionLimit,
  isRebuilding,
  errorMessage,
  onClose,
  onConfirm,
}: RebuildFaqDialogProps) {
  const [scope, setScope] = useState<ScopeKey>("all");

  // Only meaningful for "all": the presets are already below any sane ceiling,
  // so warning about it there would be noise.
  const isCapped =
    scope === "all" &&
    questionCount !== undefined &&
    questionLimit !== undefined &&
    questionCount > questionLimit;

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
      onConfirm={() => onConfirm(SCOPES[scope])}
      description={
        <div className="space-y-4">
          <p>
            This regroups every question from scratch and replaces the current entries. Titles are
            written again, and links to individual entries stop working.
          </p>

          <div className="space-y-1.5">
            <FilterSelect
              label="Questions to regroup"
              value={scope}
              options={SCOPE_OPTIONS}
              onChange={setScope}
              disabled={isRebuilding}
            />
            {questionCount !== undefined && (
              <p className="text-xs text-app-text-muted">
                {questionCount.toLocaleString("en-GB")} questions asked in this project.
              </p>
            )}
          </div>

          {scope !== "all" && (
            <p className="rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
              Questions outside this range are dropped from the FAQ, including from the counts.
            </p>
          )}

          {isCapped && questionLimit !== undefined && (
            <p className="rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
              Only the newest {questionLimit.toLocaleString("en-GB")} can be regrouped at once. The
              older ones are dropped from the FAQ.
            </p>
          )}
        </div>
      }
    />
  );
}
