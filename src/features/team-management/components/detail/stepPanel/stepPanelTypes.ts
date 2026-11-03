import type { OnboardingStepEndpoint } from "./stepPanelKit";

export type DetailOnboardingStep = OnboardingStepEndpoint & {
  startedAt?: string | null;
  durationMinutes?: number | null;
  skip?: {
    id?: string;
    status?: string;
    accepted?: boolean | null;
    reason?: string;
    reviewComment?: string | null;
    reviewedAt?: string | null;
  } | null;
};

export type TaskInsertTarget = {
  stepId: string;
  position: number;
} | null;

export type TaskMoveDirection = "up" | "down";

export type MoveFocus = { taskId: string; direction: TaskMoveDirection } | null;

/** The new-task draft and the callbacks that edit it, passed to every spot a form can open. */
export type TaskDraft = {
  stepId: string;
  taskInsertTarget: TaskInsertTarget;
  newTaskTitle: string;
  newTaskDescription: string;
  addingTask: boolean;
  onTaskInsertTargetChange: (target: TaskInsertTarget) => void;
  onNewTaskTitleChange: (value: string) => void;
  onNewTaskDescriptionChange: (value: string) => void;
  onCreateTask: () => void;
};

/** What a task row needs to be dragged, moved with buttons, and to take focus back after a move. */
export type TaskReorderControls = {
  draggable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  showMoveButtons: boolean;
  moveFocus: MoveFocus;
  onMove: (direction: TaskMoveDirection) => void;
  onDragStart: (taskId: string) => void;
  onDragOver: (taskId: string) => void;
  onDragLeave: () => void;
  onDrop: (taskId: string) => void;
};
