import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepDetailsPanel } from "../../../../../../src/features/team-management/components/detail/StepDetailsPanel";
import type { OnboardingTaskEndpoint } from "../../../../../../src/services/onboardingTypes";

const step = {
  id: "step1",
  phaseId: "phase1",
  position: 1,
  title: "Setup Environment",
  description: "Configure your environment",
  type: "TASK" as const,
  estimatedMinutes: 30,
  expectedOutcomes: [],
  tasks: [],
  resources: [],
  status: "IN_PROGRESS" as const,
  startedAt: null,
  completedAt: null,
  feedback: null,
  skip: null,
};

const tasks: OnboardingTaskEndpoint[] = [
  {
    id: "t1",
    stepId: "step1",
    position: 1,
    title: "First",
    description: "Do first",
    finished: false,
  },
  { id: "t2", stepId: "step1", position: 2, title: "Second", description: "", finished: true },
  { id: "t3", stepId: "step1", position: 3, title: "Third", description: "", finished: false },
];

function makeProps(over: Record<string, unknown> = {}) {
  return {
    step,
    tasks,
    doneTaskCount: 1,
    actualMinutes: null,
    feedbackItems: [],
    skipReason: "",
    taskInsertTarget: null,
    newTaskTitle: "",
    newTaskDescription: "",
    addingTask: false,
    stepActionId: null,
    stepToDelete: null,
    taskToDelete: null,
    onClose: vi.fn(),
    onRequestDeleteStep: vi.fn(),
    onCancelDeleteStep: vi.fn(),
    onConfirmDeleteStep: vi.fn(),
    onRequestDeleteTask: vi.fn(),
    onCancelDeleteTask: vi.fn(),
    onConfirmDeleteTask: vi.fn(),
    onTaskInsertTargetChange: vi.fn(),
    onNewTaskTitleChange: vi.fn(),
    onNewTaskDescriptionChange: vi.fn(),
    onCreateTask: vi.fn(),
    formatMinutes: (m?: number | null) => (m ? `${m} min` : "—"),
    getStepStatusStyles: () => "status-style",
    ...over,
  };
}

function renderPanel(over: Record<string, unknown> = {}) {
  const props = makeProps(over);
  render(<StepDetailsPanel {...(props as Parameters<typeof StepDetailsPanel>[0])} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());

describe("StepDetailsPanel header and times", () => {
  it("shows the status with its underscore replaced and the style it was given", () => {
    renderPanel({ step: { ...step, status: "IN_PROGRESS" } });
    const badge = screen.getByText("IN PROGRESS");
    expect(badge).toHaveClass("status-style");
  });

  it("shows 'Open' when there is no actual time and the formatted time when there is", () => {
    renderPanel();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("shows the formatted actual time", () => {
    renderPanel({ actualMinutes: 12 });
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    const props = renderPanel();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Close step details" })[0]);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("StepDetailsPanel step deletion", () => {
  const confirming = { stepToDelete: step };

  it("asks for confirmation naming the step, and cancels or confirms", async () => {
    const user = userEvent.setup();
    const props = renderPanel(confirming);
    expect(screen.getByText(/This cannot be undone/)).toHaveTextContent("Setup Environment");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancelDeleteStep).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onConfirmDeleteStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: "step1" }),
    );
  });

  it("holds both buttons while this step is being deleted", () => {
    renderPanel({ ...confirming, stepActionId: "step1" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
  });

  it("keeps the plain delete button when another step is up for deletion", () => {
    renderPanel({ stepToDelete: { ...step, id: "other" } });
    expect(screen.getByRole("button", { name: "Delete step" })).toBeEnabled();
  });

  it("disables the delete button while any step action runs", () => {
    renderPanel({ stepActionId: "other" });
    expect(screen.getByRole("button", { name: "Delete step" })).toBeDisabled();
  });
});

describe("StepDetailsPanel task rows", () => {
  it("shows a finished task struck through and a description only when it has one", () => {
    renderPanel();
    expect(screen.getByText("Second")).toHaveClass("line-through");
    expect(screen.getByText("First")).not.toHaveClass("line-through");
    expect(screen.getByText("Do first")).toBeInTheDocument();
  });

  it("disables the task delete buttons while a step action runs", () => {
    renderPanel({ stepActionId: "step1" });
    expect(screen.getByRole("button", { name: "Delete First" })).toBeDisabled();
  });

  it("confirms a task deletion naming the task", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ taskToDelete: tasks[1] });
    const prompt = screen.getByText(/This cannot be undone/);
    expect(prompt).toHaveTextContent("Second");
    await user.click(
      within(prompt.parentElement as HTMLElement).getByRole("button", { name: "Cancel" }),
    );
    expect(props.onCancelDeleteTask).toHaveBeenCalled();
    await user.click(
      within(prompt.parentElement as HTMLElement).getByRole("button", { name: "Delete" }),
    );
    expect(props.onConfirmDeleteTask).toHaveBeenCalledWith(expect.objectContaining({ id: "t2" }));
  });

  it("holds the task confirmation while its step is busy", () => {
    renderPanel({ taskToDelete: tasks[1], stepActionId: "step1" });
    const prompt = screen.getByText(/This cannot be undone/).parentElement as HTMLElement;
    expect(within(prompt).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(prompt).getByRole("button", { name: /Deleting/ })).toBeDisabled();
  });
});

describe("StepDetailsPanel adding tasks", () => {
  it("opens the form before the first task, between tasks and after the last", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add task before First" }));
    expect(props.onTaskInsertTargetChange).toHaveBeenLastCalledWith({
      stepId: "step1",
      position: 0,
    });
    await user.click(screen.getByRole("button", { name: "Add task after First" }));
    expect(props.onTaskInsertTargetChange).toHaveBeenLastCalledWith({
      stepId: "step1",
      position: 1,
    });
    await user.click(screen.getByRole("button", { name: "Add task after Third" }));
    expect(props.onTaskInsertTargetChange).toHaveBeenLastCalledWith({
      stepId: "step1",
      position: 3,
    });
  });

  it("offers the 'before' spot only on the first task", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "Add task before Second" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    [0, 1],
    [1, 1],
    [3, 1],
  ])("shows exactly one form for position %i", (position, count) => {
    renderPanel({ taskInsertTarget: { stepId: "step1", position } });
    expect(screen.getAllByLabelText("Task title")).toHaveLength(count);
  });

  it("shows no form for another step's target or for a position that does not exist", () => {
    renderPanel({ taskInsertTarget: { stepId: "other", position: 0 } });
    expect(screen.queryByLabelText("Task title")).not.toBeInTheDocument();
  });

  it("puts the form right after the task it was opened after", () => {
    renderPanel({ taskInsertTarget: { stepId: "step1", position: 2 } });
    const form = screen.getByLabelText("Task title").closest("div.rounded-2xl") as HTMLElement;
    const second = screen.getByText("Second").closest("div.group\\/task-insert") as HTMLElement;
    expect(second.contains(form)).toBe(true);
  });

  it("reports typing and keeps submit disabled for a blank title", () => {
    const props = renderPanel({ taskInsertTarget: { stepId: "step1", position: 0 } });
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "x" } });
    expect(props.onNewTaskTitleChange).toHaveBeenCalledWith("x");
    fireEvent.change(screen.getByLabelText("Task description"), { target: { value: "y" } });
    expect(props.onNewTaskDescriptionChange).toHaveBeenCalledWith("y");
  });

  it("enables submit for a non-blank title and calls onCreateTask", async () => {
    const user = userEvent.setup();
    const props = renderPanel({
      taskInsertTarget: { stepId: "step1", position: 0 },
      newTaskTitle: "  Write docs ",
    });
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(props.onCreateTask).toHaveBeenCalled();
  });

  it("keeps submit disabled for a whitespace-only title", () => {
    renderPanel({ taskInsertTarget: { stepId: "step1", position: 0 }, newTaskTitle: "   " });
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
  });

  it("cancelling closes the form and clears both drafts", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ taskInsertTarget: { stepId: "step1", position: 0 } });
    const form = screen.getByLabelText("Task title").closest("div.rounded-2xl") as HTMLElement;
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(props.onTaskInsertTargetChange).toHaveBeenLastCalledWith(null);
    expect(props.onNewTaskTitleChange).toHaveBeenLastCalledWith("");
    expect(props.onNewTaskDescriptionChange).toHaveBeenLastCalledWith("");
  });

  it("shows the busy label and holds cancel while adding", () => {
    renderPanel({ taskInsertTarget: { stepId: "step1", position: 0 }, addingTask: true });
    expect(screen.getByRole("button", { name: /Adding/ })).toBeDisabled();
    const form = screen.getByLabelText("Task title").closest("div.rounded-2xl") as HTMLElement;
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("opens and shows the form for a step with no tasks", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ tasks: [], doneTaskCount: 0 });
    await user.click(screen.getByRole("button", { name: "Add first task" }));
    expect(props.onTaskInsertTargetChange).toHaveBeenCalledWith({ stepId: "step1", position: 0 });
    expect(screen.getByText("0/0 done")).toBeInTheDocument();
  });

  it("shows the empty-step form only for this step", () => {
    renderPanel({ tasks: [], taskInsertTarget: { stepId: "other", position: 0 } });
    expect(screen.queryByLabelText("Task title")).not.toBeInTheDocument();
    renderPanel({ tasks: [], taskInsertTarget: { stepId: "step1", position: 0 } });
    expect(screen.getAllByLabelText("Task title")).toHaveLength(1);
  });
});

describe("StepDetailsPanel reordering", () => {
  it("moves a task with its buttons and reports the pair", async () => {
    const user = userEvent.setup();
    const onReorderTasks = vi.fn();
    renderPanel({ onReorderTasks });
    await user.click(screen.getByRole("button", { name: "Move Second up" }));
    expect(onReorderTasks).toHaveBeenLastCalledWith("t2", "t1");
    await user.click(screen.getByRole("button", { name: "Move Second down" }));
    expect(onReorderTasks).toHaveBeenLastCalledWith("t2", "t3");
    expect(screen.getByRole("button", { name: "Move Third down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Second up" })).toBeEnabled();
  });

  it("offers no move buttons for a single task", () => {
    renderPanel({ tasks: [tasks[0]], onReorderTasks: vi.fn() });
    expect(screen.queryByRole("button", { name: /Move First/ })).not.toBeInTheDocument();
  });

  it("gives focus back to the button that moved the task, or its twin at the edge", async () => {
    const user = userEvent.setup();
    renderPanel({ onReorderTasks: vi.fn() });
    // The panel moves focus to its first control on the next frame; let that settle first.
    await waitFor(() => expect(document.body).not.toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Move Second down" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Second down" })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Move Third up" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Third up" })).toHaveFocus(),
    );
  });

  it("makes rows draggable only when reordering is possible", () => {
    renderPanel();
    expect(screen.getByText("First").closest("[draggable]")).toHaveAttribute("draggable", "false");
  });

  it("drags one task onto another and reports it, then clears the drag state", () => {
    const onReorderTasks = vi.fn();
    renderPanel({ onReorderTasks });
    const first = screen.getByText("First").closest("[draggable]") as HTMLElement;
    const third = screen.getByText("Third").closest("[draggable]") as HTMLElement;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };

    fireEvent.dragStart(first, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "t1");
    expect(first).toHaveClass("opacity-50");

    fireEvent.dragOver(third, { dataTransfer });
    expect(third).toHaveClass("border-app-brand");

    fireEvent.drop(third, { dataTransfer });
    expect(onReorderTasks).toHaveBeenCalledWith("t1", "t3");
    expect(first).not.toHaveClass("opacity-50");
    expect(third).not.toHaveClass("border-app-brand");
  });

  it("does not report a drop onto itself", () => {
    const onReorderTasks = vi.fn();
    renderPanel({ onReorderTasks });
    const first = screen.getByText("First").closest("[draggable]") as HTMLElement;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    expect(first).not.toHaveClass("border-app-brand");
    fireEvent.drop(first, { dataTransfer });
    expect(onReorderTasks).not.toHaveBeenCalled();
  });

  it("does not report a drop that did not start on a task", () => {
    const onReorderTasks = vi.fn();
    renderPanel({ onReorderTasks });
    const third = screen.getByText("Third").closest("[draggable]") as HTMLElement;
    fireEvent.drop(third, { dataTransfer: { setData: vi.fn() } });
    expect(onReorderTasks).not.toHaveBeenCalled();
  });

  it("clears the drop highlight when the pointer leaves the row", () => {
    renderPanel({ onReorderTasks: vi.fn() });
    const first = screen.getByText("First").closest("[draggable]") as HTMLElement;
    const third = screen.getByText("Third").closest("[draggable]") as HTMLElement;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(third, { dataTransfer });
    fireEvent.dragLeave(third, { relatedTarget: document.body });
    expect(third).not.toHaveClass("border-app-brand");
  });

  it("ignores drags while reordering is off", () => {
    renderPanel();
    const first = screen.getByText("First").closest("[draggable]") as HTMLElement;
    fireEvent.dragStart(first, { dataTransfer: { setData: vi.fn() } });
    expect(first).not.toHaveClass("opacity-50");
  });
});

describe("StepDetailsPanel requests and feedback", () => {
  const skipStep = (over: Record<string, unknown>) => ({
    ...step,
    skip: {
      id: "sk1",
      stepId: "step1",
      reason: "r",
      accepted: null,
      reviewComment: null,
      reviewedAt: null,
      ...over,
    },
  });

  it("offers the review for an open skip request when a handler is given", async () => {
    const user = userEvent.setup();
    const onReviewSkip = vi.fn().mockResolvedValue(undefined);
    renderPanel({ step: skipStep({}), skipReason: "Already know it", onReviewSkip });
    await user.click(screen.getByRole("button", { name: "Approve skip" }));
    expect(onReviewSkip).toHaveBeenCalledWith("sk1", "accept", "");
  });

  it("shows only a note for an open skip request without a handler", () => {
    renderPanel({ step: skipStep({}), skipReason: "Already know it" });
    expect(screen.getByText("Skip request")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve skip" })).not.toBeInTheDocument();
  });

  it("shows a note, not the review, once the step is skipped", () => {
    renderPanel({
      step: { ...skipStep({}), status: "SKIPPED" },
      skipReason: "Already know it",
      onReviewSkip: vi.fn(),
    });
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve skip" })).not.toBeInTheDocument();
  });

  it("shows a note for a decided request", () => {
    renderPanel({ step: skipStep({ accepted: false }), skipReason: "Nope", onReviewSkip: vi.fn() });
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.getByText("Nope")).toBeInTheDocument();
  });

  it("colours the note by whether the step ended up skipped", () => {
    renderPanel({ step: { ...skipStep({}), status: "SKIPPED" }, skipReason: "a" });
    expect(screen.getByText("Skip request").closest("div.rounded-2xl")).toHaveClass(
      "bg-app-danger-bg",
    );
  });

  it("colours a pending note as a warning", () => {
    renderPanel({ step: skipStep({}), skipReason: "a" });
    expect(screen.getByText("Skip request").closest("div.rounded-2xl")).toHaveClass(
      "bg-app-warning-bg",
    );
  });

  it("shows no skip block without a reason", () => {
    renderPanel({ step: skipStep({}) });
    expect(screen.queryByText("Skip request")).not.toBeInTheDocument();
    expect(screen.getByText("No skip request or feedback for this step.")).toBeInTheDocument();
  });

  it("does not claim there is nothing when there is a skip reason or feedback", () => {
    renderPanel({ skipReason: "why" });
    expect(screen.queryByText(/No skip request or feedback/)).not.toBeInTheDocument();
  });

  it("shows feedback with its date, rating and read state, and dims read feedback", () => {
    renderPanel({
      feedbackItems: [
        {
          id: "f1",
          stepId: "step1",
          helpful: true,
          message: "Nice",
          read: true,
          createdAt: "2026-07-01T12:00:00Z",
        },
        { id: "f2", stepId: "step1", helpful: null, message: "Hmm", read: false },
      ],
    });
    expect(screen.getByText("Jul 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Nice").closest("div.rounded-2xl")).toHaveClass("opacity-75");
    expect(screen.getByText("Hmm").closest("div.rounded-2xl")).not.toHaveClass("opacity-75");
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getAllByText("Feedback").length).toBeGreaterThan(1);
  });

  it("offers 'Mark read' only for unread feedback and only with a handler", () => {
    const feedback = { id: "f2", stepId: "step1", helpful: null, message: "Hmm", read: false };
    renderPanel({ feedbackItems: [feedback] });
    expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument();
  });

  it("holds the button of the feedback being marked", () => {
    renderPanel({
      feedbackItems: [
        { id: "f1", stepId: "step1", helpful: null, message: "A", read: false },
        { id: "f2", stepId: "step1", helpful: null, message: "B", read: false },
      ],
      onMarkFeedbackRead: vi.fn(),
      markingFeedbackId: "f2",
    });
    const [first, second] = screen.getAllByRole("button", { name: "Mark read" });
    expect(first).toBeEnabled();
    expect(second).toBeDisabled();
  });
});
