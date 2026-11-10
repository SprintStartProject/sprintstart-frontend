import { describe, expect, it, vi } from "vitest";
import {
  getFeedbackRating,
  getSkipStatus,
  isInsertAt,
  neighbourFor,
} from "../../../../../../src/features/team-management/components/detail/stepPanel/stepPanelRules";
import type {
  DetailOnboardingStep,
  TaskDraft,
  TaskReorderControls,
} from "../../../../../../src/features/team-management/components/detail/stepPanel/stepPanelTypes";
import { taskDragHandlers } from "../../../../../../src/features/team-management/components/detail/stepPanel/taskDragHandlers";

type StepOverrides = Omit<Partial<DetailOnboardingStep>, "skip"> & {
  skip?: Record<string, unknown> | null;
};

function step(over: StepOverrides = {}): DetailOnboardingStep {
  return { id: "s1", status: "IN_PROGRESS", ...over } as DetailOnboardingStep;
}

describe("getSkipStatus", () => {
  it("capitalises the stated status", () => {
    expect(getSkipStatus(step({ skip: { status: "PENDING" } }))).toBe("Pending");
    expect(getSkipStatus(step({ skip: { status: "ACCEPTED" } }))).toBe("Accepted");
  });

  it("falls back to accepted for an accepted skip or a skipped step", () => {
    expect(getSkipStatus(step({ skip: { accepted: true } }))).toBe("Accepted");
    expect(getSkipStatus(step({ status: "SKIPPED" }))).toBe("Accepted");
  });

  it("reads a refused skip as denied", () => {
    expect(getSkipStatus(step({ skip: { accepted: false } }))).toBe("Denied");
  });

  it("reads anything else as pending", () => {
    expect(getSkipStatus(step())).toBe("Pending");
    expect(getSkipStatus(step({ skip: { accepted: null } }))).toBe("Pending");
  });

  it("prefers the stated status over the step's own", () => {
    expect(getSkipStatus(step({ status: "SKIPPED", skip: { status: "DENIED" } }))).toBe("Denied");
  });
});

describe("getFeedbackRating", () => {
  it("labels helpful, not helpful and unrated feedback apart", () => {
    expect(getFeedbackRating(true).label).toBe("Helpful");
    expect(getFeedbackRating(false).label).toBe("Not helpful");
    expect(getFeedbackRating(null).label).toBe("Feedback");
    expect(getFeedbackRating(undefined).label).toBe("Feedback");
  });

  it("colours each rating differently", () => {
    const cards = [true, false, null].map((value) => getFeedbackRating(value).cardClassName);
    expect(new Set(cards).size).toBe(3);
    expect(getFeedbackRating(true).cardClassName).toContain("success");
    expect(getFeedbackRating(false).cardClassName).toContain("danger");
  });
});

function draft(target: TaskDraft["taskInsertTarget"]): TaskDraft {
  return {
    stepId: "s1",
    taskInsertTarget: target,
    newTaskTitle: "",
    newTaskDescription: "",
    addingTask: false,
    onTaskInsertTargetChange: vi.fn(),
    onNewTaskTitleChange: vi.fn(),
    onNewTaskDescriptionChange: vi.fn(),
    onCreateTask: vi.fn(),
  };
}

describe("isInsertAt", () => {
  it("is true only for the open position of the same step", () => {
    expect(isInsertAt(draft({ stepId: "s1", position: 2 }), 2)).toBe(true);
    expect(isInsertAt(draft({ stepId: "s1", position: 2 }), 1)).toBe(false);
    expect(isInsertAt(draft({ stepId: "other", position: 2 }), 2)).toBe(false);
    expect(isInsertAt(draft(null), 0)).toBe(false);
  });
});

describe("neighbourFor", () => {
  const list = ["a", "b", "c"];

  it("returns the item above or below", () => {
    expect(neighbourFor(list, 1, "up")).toBe("a");
    expect(neighbourFor(list, 1, "down")).toBe("c");
  });

  it("returns null at the edges", () => {
    expect(neighbourFor(list, 0, "up")).toBeNull();
    expect(neighbourFor(list, 2, "down")).toBeNull();
  });
});

function reorder(over: Partial<TaskReorderControls> = {}): TaskReorderControls {
  return {
    draggable: true,
    canMoveUp: true,
    canMoveDown: true,
    showMoveButtons: true,
    moveFocus: null,
    onMove: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    ...over,
  };
}

function dragEvent(over: Record<string, unknown> = {}) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { effectAllowed: "", dropEffect: "", setData: vi.fn() },
    relatedTarget: null,
    currentTarget: document.createElement("div"),
    ...over,
  } as never;
}

describe("taskDragHandlers", () => {
  it("starts a drag by announcing the task and allowing a move", () => {
    const controls = reorder();
    const event = dragEvent();
    taskDragHandlers("t1", controls).onDragStart(event);
    expect(controls.onDragStart).toHaveBeenCalledWith("t1");
    expect(
      (event as { dataTransfer: { effectAllowed: string; setData: unknown } }).dataTransfer,
    ).toMatchObject({ effectAllowed: "move" });
    expect(
      (event as { dataTransfer: { setData: ReturnType<typeof vi.fn> } }).dataTransfer.setData,
    ).toHaveBeenCalledWith("text/plain", "t1");
  });

  it("accepts a drag over by cancelling the default and marking the target", () => {
    const controls = reorder();
    const event = dragEvent();
    taskDragHandlers("t1", controls).onDragOver(event);
    expect(
      (event as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault,
    ).toHaveBeenCalled();
    expect((event as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect).toBe(
      "move",
    );
    expect(controls.onDragOver).toHaveBeenCalledWith("t1");
  });

  it("drops by cancelling the default and reporting the task", () => {
    const controls = reorder();
    const event = dragEvent();
    taskDragHandlers("t1", controls).onDrop(event);
    expect(
      (event as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault,
    ).toHaveBeenCalled();
    expect(controls.onDrop).toHaveBeenCalledWith("t1");
  });

  it("leaves the target only when the pointer really left the row", () => {
    const controls = reorder();
    const row = document.createElement("div");
    const child = document.createElement("span");
    row.appendChild(child);

    taskDragHandlers("t1", controls).onDragLeave(
      dragEvent({ currentTarget: row, relatedTarget: child }),
    );
    expect(controls.onDragLeave).not.toHaveBeenCalled();

    taskDragHandlers("t1", controls).onDragLeave(
      dragEvent({ currentTarget: row, relatedTarget: document.createElement("p") }),
    );
    expect(controls.onDragLeave).toHaveBeenCalledTimes(1);

    taskDragHandlers("t1", controls).onDragLeave(dragEvent({ currentTarget: row }));
    expect(controls.onDragLeave).toHaveBeenCalledTimes(2);
  });

  it("does nothing at all while reordering is off", () => {
    const controls = reorder({ draggable: false });
    const handlers = taskDragHandlers("t1", controls);
    const event = dragEvent();
    handlers.onDragStart(event);
    handlers.onDragOver(event);
    handlers.onDragLeave(event);
    handlers.onDrop(event);
    expect(
      (event as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault,
    ).not.toHaveBeenCalled();
    expect(controls.onDragStart).not.toHaveBeenCalled();
    expect(controls.onDragOver).not.toHaveBeenCalled();
    expect(controls.onDragLeave).not.toHaveBeenCalled();
    expect(controls.onDrop).not.toHaveBeenCalled();
  });
});
