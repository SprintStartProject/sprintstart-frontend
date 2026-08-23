import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { CreateStarterWorkTaskInput } from "../types";
import { capturePoolFlightRect, type PoolFlightRect } from "./poolFlight";

type NewStarterTaskModalProps = {
  isSaving: boolean;
  onCreate: (input: CreateStarterWorkTaskInput, origin?: PoolFlightRect) => Promise<boolean>;
  onClose: () => void;
};

const inputClasses =
  "w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none";

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
export function NewStarterTaskModal({ isSaving, onCreate, onClose }: NewStarterTaskModalProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [competencyKeysRaw, setCompetencyKeysRaw] = useState("");

  const canSave = title.trim().length > 0 && !isSaving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const origin = submitter instanceof HTMLElement ? capturePoolFlightRect(submitter) : undefined;
    const competencyKeys = competencyKeysRaw
      .split(/[\s,]+/)
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    const created = await onCreate(
      {
        title: title.trim(),
        summary: summary.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        competencyKeys: competencyKeys.length > 0 ? competencyKeys : undefined,
      },
      origin,
    );
    if (created) onClose();
  };

  return (
    <Modal
      isOpen
      title="Add a starter task"
      description="Author a first task by hand. The AI is optional — this becomes a goal a hire can aim at right away, no mining needed."
      size="lg"
      testId="new-starter-task-modal"
      isDismissDisabled={isSaving}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-starter-task-form"
            data-testid="create-starter-task"
            disabled={!canSave}
            loading={isSaving}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Add as a goal
          </Button>
        </>
      }
    >
      <form
        id="new-starter-task-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4"
      >
        <div>
          <label htmlFor="new-task-title" className="mb-1 block text-xs font-medium text-app-text">
            Title
          </label>
          <input
            id="new-task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Add a dark-mode toggle to the settings page"
            className={inputClasses}
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
            className={inputClasses}
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
            className={inputClasses}
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
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-app-text-subtle">
            Competency identifiers, comma-separated. Each becomes a prerequisite edge into the task;
            any that isn&apos;t in the graph is quietly skipped.
          </p>
        </div>
      </form>
    </Modal>
  );
}
