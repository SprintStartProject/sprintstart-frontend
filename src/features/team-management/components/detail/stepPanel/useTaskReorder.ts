import { useState } from "react";
import type { OnboardingTaskEndpoint } from "./stepPanelKit";
import { neighbourFor } from "./stepPanelRules";
import type { MoveFocus, TaskMoveDirection, TaskReorderControls } from "./stepPanelTypes";

type TaskReorder = {
  draggedTaskId: string | null;
  dragOverTaskId: string | null;
  controlsFor: (index: number) => TaskReorderControls;
};

/**
 * Drag-and-drop and button reordering of a step's tasks. The panel owns no order: every move is
 * reported through `onReorderTasks`, and with no callback every control switches itself off.
 */
export function useTaskReorder(
  tasks: OnboardingTaskEndpoint[],
  onReorderTasks?: (activeTaskId: string, overTaskId: string) => void,
): TaskReorder {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  // Which task was just moved with its buttons, so that task can take focus back once the list has
  // been reordered (the move re-parents the node, which would otherwise drop keyboard focus).
  const [moveFocus, setMoveFocus] = useState<MoveFocus>(null);

  const moveTask = (index: number, direction: TaskMoveDirection) => {
    const task = tasks[index];
    const neighbour = neighbourFor(tasks, index, direction);
    if (!onReorderTasks || !task || !neighbour) return;
    setMoveFocus({ taskId: task.id, direction });
    onReorderTasks(task.id, neighbour.id);
  };

  const drop = (taskId: string) => {
    if (onReorderTasks && draggedTaskId && draggedTaskId !== taskId) {
      onReorderTasks(draggedTaskId, taskId);
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const controlsFor = (index: number): TaskReorderControls => ({
    draggable: Boolean(onReorderTasks),
    canMoveUp: index > 0,
    canMoveDown: index < tasks.length - 1,
    showMoveButtons: Boolean(onReorderTasks) && tasks.length > 1,
    moveFocus,
    onMove: (direction) => moveTask(index, direction),
    onDragStart: setDraggedTaskId,
    onDragOver: setDragOverTaskId,
    onDragLeave: () => setDragOverTaskId(null),
    onDrop: drop,
  });

  return { draggedTaskId, dragOverTaskId, controlsFor };
}
