import { CheckCircle2, ChevronDown, ChevronUp, Circle, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "../../../../../components/ui/Button";
import { DragHandle } from "../../../../../components/ui/DragHandle";
import type { OnboardingTaskEndpoint } from "./stepPanelKit";
import { TaskDraftForm, TaskInsertButton } from "./NewTaskForm";
import { isInsertAt } from "./stepPanelRules";
import type { TaskDraft, TaskReorderControls } from "./stepPanelTypes";
import { taskDragHandlers } from "./taskDragHandlers";
import { useMoveFocus } from "./useMoveFocus";

const MOVE_BUTTON_CLASS =
  "rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40";

function TaskLabel({ task }: { task: OnboardingTaskEndpoint }) {
  return (
    <div className="flex min-w-0 gap-2">
      {task.finished ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-app-text-disabled" />
      )}

      <div className="min-w-0">
        <p
          className={`text-sm font-medium ${
            task.finished ? "text-app-text-subtle line-through" : "text-app-text"
          }`}
        >
          {task.title}
        </p>
        {task.description && <p className="mt-1 text-xs text-app-text-muted">{task.description}</p>}
      </div>
    </div>
  );
}

type TaskActionsProps = {
  task: OnboardingTaskEndpoint;
  reorder: TaskReorderControls;
  moveUpRef: RefObject<HTMLButtonElement | null>;
  moveDownRef: RefObject<HTMLButtonElement | null>;
  deleteDisabled: boolean;
  onRequestDelete: (task: OnboardingTaskEndpoint) => void;
};

function TaskActions({
  task,
  reorder,
  moveUpRef,
  moveDownRef,
  deleteDisabled,
  onRequestDelete,
}: TaskActionsProps) {
  return (
    <div className="flex shrink-0 items-start gap-0.5">
      {reorder.showMoveButtons && (
        <>
          <button
            ref={moveUpRef}
            type="button"
            onClick={() => reorder.onMove("up")}
            disabled={!reorder.canMoveUp}
            className={MOVE_BUTTON_CLASS}
            aria-label={`Move ${task.title} up`}
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          <button
            ref={moveDownRef}
            type="button"
            onClick={() => reorder.onMove("down")}
            disabled={!reorder.canMoveDown}
            className={MOVE_BUTTON_CLASS}
            aria-label={`Move ${task.title} down`}
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => onRequestDelete(task)}
        disabled={deleteDisabled}
        className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-danger-bg hover:text-app-danger-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Delete ${task.title}`}
        title="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

type TaskCardProps = {
  task: OnboardingTaskEndpoint;
  reorder: TaskReorderControls;
  isDragging: boolean;
  isDragTarget: boolean;
  deleteDisabled: boolean;
  onRequestDelete: (task: OnboardingTaskEndpoint) => void;
};

function TaskCard({
  task,
  reorder,
  isDragging,
  isDragTarget,
  deleteDisabled,
  onRequestDelete,
}: TaskCardProps) {
  const [moveUpRef, moveDownRef] = useMoveFocus(reorder.moveFocus, task.id);

  return (
    <div
      draggable={reorder.draggable}
      {...taskDragHandlers(task.id, reorder)}
      className={`group/task flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
        isDragTarget
          ? "border-app-brand bg-app-brand-soft shadow-sm"
          : "border-app-border bg-app-surface-muted"
      } ${isDragging ? "scale-[0.99] opacity-50" : ""}`}
    >
      <div className="flex min-w-0">
        {reorder.draggable && (
          <DragHandle
            visibleClassName="group-hover/task:mr-1 group-hover/task:w-4 group-hover/task:opacity-100"
            className="mt-0.5"
          />
        )}
        <TaskLabel task={task} />
      </div>

      <TaskActions
        task={task}
        reorder={reorder}
        moveUpRef={moveUpRef}
        moveDownRef={moveDownRef}
        deleteDisabled={deleteDisabled}
        onRequestDelete={onRequestDelete}
      />
    </div>
  );
}

type TaskDeleteConfirmProps = {
  task: OnboardingTaskEndpoint;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (task: OnboardingTaskEndpoint) => void;
};

function TaskDeleteConfirm({ task, busy, onCancel, onConfirm }: TaskDeleteConfirmProps) {
  return (
    <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3">
      <p className="text-sm text-app-danger-text">
        Delete <span className="font-medium">{task.title}</span>? This cannot be undone.
      </p>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-xs font-medium text-app-text hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <Button variant="danger" size="sm" onClick={() => onConfirm(task)} loading={busy}>
          {busy ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}

type TaskItemProps = {
  task: OnboardingTaskEndpoint;
  index: number;
  draft: TaskDraft;
  reorder: TaskReorderControls;
  draggedTaskId: string | null;
  dragOverTaskId: string | null;
  stepActionId: string | null;
  taskToDelete: OnboardingTaskEndpoint | null;
  onRequestDeleteTask: (task: OnboardingTaskEndpoint) => void;
  onCancelDeleteTask: () => void;
  onConfirmDeleteTask: (task: OnboardingTaskEndpoint) => void;
};

/** One task of the step with the insert spots around it, its drag/move/delete controls and any open form. */
export function TaskItem({
  task,
  index,
  draft,
  reorder,
  draggedTaskId,
  dragOverTaskId,
  stepActionId,
  taskToDelete,
  onRequestDeleteTask,
  onCancelDeleteTask,
  onConfirmDeleteTask,
}: TaskItemProps) {
  const isFirst = index === 0;
  const openAt = (position: number) =>
    draft.onTaskInsertTargetChange({ stepId: draft.stepId, position });

  return (
    <div className="group/task-insert space-y-1">
      {isFirst && (
        <TaskInsertButton label={`Add task before ${task.title}`} onClick={() => openAt(0)} />
      )}
      {isFirst && isInsertAt(draft, 0) && <TaskDraftForm draft={draft} />}

      <TaskCard
        task={task}
        reorder={reorder}
        isDragging={draggedTaskId === task.id}
        isDragTarget={dragOverTaskId === task.id && draggedTaskId !== task.id}
        deleteDisabled={stepActionId !== null}
        onRequestDelete={onRequestDeleteTask}
      />

      {taskToDelete?.id === task.id && (
        <TaskDeleteConfirm
          task={task}
          busy={stepActionId === task.stepId}
          onCancel={onCancelDeleteTask}
          onConfirm={onConfirmDeleteTask}
        />
      )}

      <TaskInsertButton label={`Add task after ${task.title}`} onClick={() => openAt(index + 1)} />
      {isInsertAt(draft, index + 1) && <TaskDraftForm draft={draft} />}
    </div>
  );
}
