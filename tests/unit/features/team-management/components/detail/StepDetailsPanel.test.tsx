import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StepDetailsPanel } from "../../../../../../src/features/team-management/components/detail/StepDetailsPanel";
import type { OnboardingTaskEndpoint } from "../../../../../../src/features/onboarding/types";

const mockStep = {
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
  startedAt: "2026-07-01T00:00:00Z",
  completedAt: null,
  feedback: null,
  skip: null,
};

const mockTasks: OnboardingTaskEndpoint[] = [
  {
    id: "t1",
    stepId: "step1",
    position: 1,
    title: "Install Node",
    description: "Install Node.js",
    finished: false,
  },
  { id: "t2", stepId: "step1", position: 2, title: "Clone repo", description: "", finished: true },
];

const defaultProps = {
  step: mockStep,
  tasks: mockTasks,
  doneTaskCount: 1,
  actualMinutes: 15,
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
  formatMinutes: (m: number | null | undefined) => (m ? `${m} min` : "—"),
  getStepStatusStyles: () => "bg-app-warning-bg text-app-warning-text",
};

describe("StepDetailsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the step title and description", () => {
    render(<StepDetailsPanel {...defaultProps} />);

    expect(screen.getByText("Setup Environment")).toBeInTheDocument();
    expect(screen.getByText("Configure your environment")).toBeInTheDocument();
  });

  it("renders the task list with done count", () => {
    render(<StepDetailsPanel {...defaultProps} />);

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("1/2 done")).toBeInTheDocument();
    expect(screen.getByText("Install Node")).toBeInTheDocument();
    expect(screen.getByText("Clone repo")).toBeInTheDocument();
  });

  it("renders the estimate and actual minutes", () => {
    render(<StepDetailsPanel {...defaultProps} />);

    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("15 min")).toBeInTheDocument();
  });

  it("calls onRequestDeleteTask when a task delete button is clicked", async () => {
    const user = userEvent.setup();
    const onRequestDeleteTask = vi.fn();
    render(<StepDetailsPanel {...defaultProps} onRequestDeleteTask={onRequestDeleteTask} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Install Node" });
    await user.click(deleteButton);

    expect(onRequestDeleteTask).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("shows the delete step button in the footer", () => {
    render(<StepDetailsPanel {...defaultProps} />);

    expect(screen.getByText("Delete step")).toBeInTheDocument();
  });

  it("calls onRequestDeleteStep when the delete step button is clicked", async () => {
    const user = userEvent.setup();
    const onRequestDeleteStep = vi.fn();
    render(<StepDetailsPanel {...defaultProps} onRequestDeleteStep={onRequestDeleteStep} />);

    await user.click(screen.getByText("Delete step"));

    expect(onRequestDeleteStep).toHaveBeenCalledWith(mockStep);
  });

  it("shows delete confirmation when stepToDelete matches the step", () => {
    render(<StepDetailsPanel {...defaultProps} stepToDelete={mockStep} />);

    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
  });

  it('shows the "No tasks" state when tasks is empty', () => {
    render(<StepDetailsPanel {...defaultProps} tasks={[]} doneTaskCount={0} />);

    expect(screen.getByText("No tasks for this step.")).toBeInTheDocument();
    expect(screen.getByText("Add first task")).toBeInTheDocument();
  });

  it('calls onTaskInsertTargetChange when "Add first task" is clicked', async () => {
    const user = userEvent.setup();
    const onTaskInsertTargetChange = vi.fn();
    render(
      <StepDetailsPanel
        {...defaultProps}
        tasks={[]}
        doneTaskCount={0}
        onTaskInsertTargetChange={onTaskInsertTargetChange}
      />,
    );

    await user.click(screen.getByText("Add first task"));

    expect(onTaskInsertTargetChange).toHaveBeenCalledWith({ stepId: "step1", position: 0 });
  });

  it("shows skip reason when provided", () => {
    render(<StepDetailsPanel {...defaultProps} skipReason="Too complicated" />);

    expect(screen.getByText("Skip request")).toBeInTheDocument();
    expect(screen.getByText("Too complicated")).toBeInTheDocument();
  });

  it('shows "No skip request or feedback" when there is no skip reason or feedback', () => {
    render(<StepDetailsPanel {...defaultProps} />);

    expect(screen.getByText("No skip request or feedback for this step.")).toBeInTheDocument();
  });

  it("shows feedback items when provided", () => {
    render(
      <StepDetailsPanel
        {...defaultProps}
        feedbackItems={[
          {
            id: "f1",
            stepId: "step1",
            helpful: true,
            message: "Great step!",
            read: true,
            createdAt: "2026-07-01T00:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Great step!")).toBeInTheDocument();
    expect(screen.getByText("Helpful")).toBeInTheDocument();
  });

  it("shows unread badge for unread feedback", () => {
    render(
      <StepDetailsPanel
        {...defaultProps}
        feedbackItems={[
          {
            id: "f1",
            stepId: "step1",
            helpful: false,
            message: "Confusing",
            read: false,
            createdAt: "2026-07-01T00:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Not helpful")).toBeInTheDocument();
  });
});
