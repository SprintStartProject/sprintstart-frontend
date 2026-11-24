import { Plus } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";
import type { TaskDraft } from "./stepPanelTypes";

export function TaskInsertButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-4 w-full items-center justify-center border-y border-transparent text-app-text-muted transition-all before:h-px before:flex-1 before:bg-app-border-muted after:h-px after:flex-1 after:bg-app-border-muted hover:text-app-brand"
      aria-label={label}
      title="Add task here"
    >
      <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-focus-within/step-insert:opacity-100 group-focus-within/task-insert:opacity-100 group-hover/step-insert:opacity-100 group-hover/task-insert:opacity-100" />
    </button>
  );
}

type NewTaskFormProps = {
  title: string;
  description: string;
  addingTask: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function NewTaskForm({
  title,
  description,
  addingTask,
  onTitleChange,
  onDescriptionChange,
  onCancel,
  onSubmit,
}: NewTaskFormProps) {
  return (
    <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft p-3">
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Task title"
        aria-label="Task title"
      />
      <Input
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Optional description"
        aria-label="Task description"
        className="mt-2"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={addingTask}
          className="rounded-xl border border-app-border px-3 py-2 text-xs font-medium text-app-text hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSubmit}
          disabled={title.trim().length === 0}
          loading={addingTask}
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          {addingTask ? "Adding..." : "Add task"}
        </Button>
      </div>
    </div>
  );
}

/** The new-task form wired to the draft; cancelling closes it and clears both fields. */
export function TaskDraftForm({ draft }: { draft: TaskDraft }) {
  return (
    <NewTaskForm
      title={draft.newTaskTitle}
      description={draft.newTaskDescription}
      addingTask={draft.addingTask}
      onTitleChange={draft.onNewTaskTitleChange}
      onDescriptionChange={draft.onNewTaskDescriptionChange}
      onCancel={() => {
        draft.onTaskInsertTargetChange(null);
        draft.onNewTaskTitleChange("");
        draft.onNewTaskDescriptionChange("");
      }}
      onSubmit={draft.onCreateTask}
    />
  );
}
