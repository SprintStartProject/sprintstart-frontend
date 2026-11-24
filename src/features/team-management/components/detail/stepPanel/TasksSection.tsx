import { Plus } from "lucide-react";
import { Badge } from "../../../../../components/ui/Badge";
import { Button } from "../../../../../components/ui/Button";
import type { OnboardingTaskEndpoint } from "./stepPanelKit";
import { TaskDraftForm } from "./NewTaskForm";
import type { TaskDraft } from "./stepPanelTypes";
import { TaskItem } from "./TaskItem";
import { useTaskReorder } from "./useTaskReorder";

type TasksSectionProps = {
  tasks: OnboardingTaskEndpoint[];
  doneTaskCount: number;
  draft: TaskDraft;
  stepActionId: string | null;
  taskToDelete: OnboardingTaskEndpoint | null;
  onRequestDeleteTask: (task: OnboardingTaskEndpoint) => void;
  onCancelDeleteTask: () => void;
  onConfirmDeleteTask: (task: OnboardingTaskEndpoint) => void;
  onReorderTasks?: (activeTaskId: string, overTaskId: string) => void;
};

function NoTasks({ draft }: { draft: TaskDraft }) {
  return (
    <>
      <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
        <p>No tasks for this step.</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => draft.onTaskInsertTargetChange({ stepId: draft.stepId, position: 0 })}
          icon={<Plus className="h-3.5 w-3.5" />}
          className="mt-3"
        >
          Add first task
        </Button>
      </div>
      {draft.taskInsertTarget?.stepId === draft.stepId && <TaskDraftForm draft={draft} />}
    </>
  );
}

/** The step's tasks with their count, the empty state, and the controls to add, reorder and delete. */
export function TasksSection({
  tasks,
  doneTaskCount,
  draft,
  stepActionId,
  taskToDelete,
  onRequestDeleteTask,
  onCancelDeleteTask,
  onConfirmDeleteTask,
  onReorderTasks,
}: TasksSectionProps) {
  const reorder = useTaskReorder(tasks, onReorderTasks);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-app-text">Tasks</h3>
        <Badge variant="neutral" size="sm">
          {doneTaskCount}/{tasks.length} done
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        {tasks.length === 0 ? (
          <NoTasks draft={draft} />
        ) : (
          tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              draft={draft}
              reorder={reorder.controlsFor(index)}
              draggedTaskId={reorder.draggedTaskId}
              dragOverTaskId={reorder.dragOverTaskId}
              stepActionId={stepActionId}
              taskToDelete={taskToDelete}
              onRequestDeleteTask={onRequestDeleteTask}
              onCancelDeleteTask={onCancelDeleteTask}
              onConfirmDeleteTask={onConfirmDeleteTask}
            />
          ))
        )}
      </div>
    </section>
  );
}
