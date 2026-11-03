import type { DragEvent } from "react";
import type { TaskReorderControls } from "./stepPanelTypes";

type TaskDragHandlers = {
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

/** The four drag events of one task row; every one does nothing while reordering is switched off. */
export function taskDragHandlers(taskId: string, reorder: TaskReorderControls): TaskDragHandlers {
  const { draggable } = reorder;
  return {
    onDragStart: (event) => {
      if (!draggable) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", taskId);
      reorder.onDragStart(taskId);
    },
    onDragOver: (event) => {
      if (!draggable) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      reorder.onDragOver(taskId);
    },
    onDragLeave: (event) => {
      if (!draggable) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
      reorder.onDragLeave();
    },
    onDrop: (event) => {
      if (!draggable) return;
      event.preventDefault();
      reorder.onDrop(taskId);
    },
  };
}
