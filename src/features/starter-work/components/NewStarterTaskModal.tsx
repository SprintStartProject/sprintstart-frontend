import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Textarea } from "../../../components/ui/Textarea";
import type { CreateStarterWorkTaskInput } from "../types";
import { capturePoolFlightRect, type PoolFlightRect } from "./poolFlight";

type NewStarterTaskModalProps = {
  isSaving: boolean;
  onCreate: (input: CreateStarterWorkTaskInput, origin?: PoolFlightRect) => Promise<boolean>;
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
      description="Write a first task by hand. It becomes a goal a hire can pick up right away."
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
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Add a dark-mode toggle to the settings page"
          />
        </Field>

        <Field label="What it involves" optional>
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            minRows={3}
          />
        </Field>

        <Field label="Link" optional>
          <Input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://github.com/org/repo/issues/123"
          />
        </Field>

        <Field
          label="Prerequisite competencies"
          optional
          hint="Competency identifiers, comma-separated. Each becomes a prerequisite edge into the task; any that isn't in the graph is quietly skipped."
        >
          <Input
            value={competencyKeysRaw}
            onChange={(event) => setCompetencyKeysRaw(event.target.value)}
            placeholder="react, typescript"
          />
        </Field>
      </form>
    </Modal>
  );
}
