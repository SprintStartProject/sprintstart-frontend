import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { CreateStarterWorkTaskInput } from "../types";

type NewStarterTaskModalProps = {
  isSaving: boolean;
  error: string | null;
  onCreate: (input: CreateStarterWorkTaskInput) => Promise<boolean>;
  onClose: () => void;
};

/**
 * A PM hand-authoring a starter task, with no AI mining.
 *
 * The origination counterpart to the review queue: mining fills the pool from ingested issues, this
 * adds one the corpus never surfaced. It is born approved — a PM authoring a task is the review —
 * so it lands in the graph as a goal at once rather than joining the queue below.
 *
 * The competency keys are typed as a free list (comma- or space-separated) rather than a picker:
 * they are optional enrichment, and a key that isn't a live competency is skipped server-side, so
 * an over-eager entry costs an edge, not the task.
 */
export function NewStarterTaskModal({
  isSaving,
  error,
  onCreate,
  onClose,
}: NewStarterTaskModalProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [competencyKeysRaw, setCompetencyKeysRaw] = useState("");

  const canSave = title.trim().length > 0 && !isSaving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const competencyKeys = competencyKeysRaw
      .split(/[\s,]+/)
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    const created = await onCreate({
      title: title.trim(),
      summary: summary.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      competencyKeys: competencyKeys.length > 0 ? competencyKeys : undefined,
    });
    if (created) onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Add a starter task"
      data-testid="new-starter-task-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl border border-app-border bg-app-bg p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-app-text">Add a starter task</h2>
            <p className="mt-1 text-sm text-app-text-muted">
              Author a first task by hand. The AI is optional — this becomes a goal a hire can aim
              at right away, no mining needed.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label htmlFor="new-task-title" className="mb-1 block text-xs font-medium text-app-text">
            Title
          </label>
          <input
            id="new-task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Add a dark-mode toggle to the settings page"
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="new-task-summary"
            className="mb-1 block text-xs font-medium text-app-text"
          >
            What it involves
          </label>
          <textarea
            id="new-task-summary"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="new-task-source-url"
            className="mb-1 block text-xs font-medium text-app-text"
          >
            Link <span className="text-app-text-subtle">(optional)</span>
          </label>
          <input
            id="new-task-source-url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://github.com/org/repo/issues/123"
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="new-task-competency-keys"
            className="mb-1 block text-xs font-medium text-app-text"
          >
            Prerequisite competencies <span className="text-app-text-subtle">(optional)</span>
          </label>
          <input
            id="new-task-competency-keys"
            value={competencyKeysRaw}
            onChange={(event) => setCompetencyKeysRaw(event.target.value)}
            placeholder="react, typescript"
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          />
          <p className="mt-1 text-xs text-app-text-subtle">
            Competency identifiers, comma-separated. Each becomes a prerequisite edge into the task;
            any that isn&apos;t in the graph is quietly skipped.
          </p>
        </div>

        {error && (
          <p
            data-testid="new-task-error"
            className="rounded-lg bg-app-danger-bg p-2.5 text-xs font-medium text-app-danger-text"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            data-testid="create-starter-task"
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Add as a goal
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-app-border px-4 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
