import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepWorkspace } from "../../../../../../src/features/onboarding/components/journey/StepWorkspace";

const mockFlyby = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../src/features/moments", () => ({
  useMoments: () => ({ flyby: mockFlyby, celebrate: vi.fn(), completeMission: vi.fn() }),
}));

vi.mock("../../../../../../src/services/onboardingService", () => ({
  onboardingService: {
    fetchStep: vi.fn(),
    fetchTasks: vi.fn(),
    fetchResources: vi.fn(),
    startStep: vi.fn(),
    updateTask: vi.fn(),
    updateStepStatus: vi.fn(),
    skipStep: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

import { onboardingService } from "../../../../../../src/services/onboardingService";

const step = {
  id: "step1",
  phaseId: "phase1",
  position: 1,
  title: "Setup Environment",
  description: "Set up your dev environment",
  type: "TASK" as const,
  estimatedMinutes: 30,
  expectedOutcomes: ["Node.js installed"],
  tasks: [],
  resources: [],
  status: "IN_PROGRESS" as const,
  startedAt: "2026-07-01T00:00:00Z",
  completedAt: null,
  feedback: null,
  skip: null,
};

const tasks = [
  {
    id: "t1",
    stepId: "step1",
    position: 1,
    title: "Install Node",
    description: "",
    finished: false,
  },
  { id: "t2", stepId: "step1", position: 2, title: "Clone repo", description: "", finished: true },
];

function renderWorkspace(overrides: Partial<Parameters<typeof StepWorkspace>[0]> = {}) {
  const props = {
    stepId: "step1",
    onPathChanged: vi.fn().mockResolvedValue(undefined),
    continueLabel: "Next step",
    onContinue: vi.fn(),
    ...overrides,
  };
  render(<StepWorkspace {...props} />);
  return props;
}

describe("StepWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onboardingService.fetchStep).mockResolvedValue(step);
    vi.mocked(onboardingService.fetchTasks).mockResolvedValue(tasks);
    vi.mocked(onboardingService.fetchResources).mockResolvedValue([
      {
        id: "r1",
        stepId: "step1",
        title: "Node.js",
        description: "Download",
        url: "https://nodejs.org",
      },
    ]);
  });

  it("shows the step's tasks, outcomes and resources in place", async () => {
    renderWorkspace();

    expect(await screen.findByRole("button", { name: /Install Node/ })).toBeInTheDocument();
    expect(screen.getByText("1/2 done")).toBeInTheDocument();
    expect(screen.getByText("Node.js installed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Node.js/ })).toHaveAttribute(
      "href",
      "https://nodejs.org",
    );
    expect(screen.getByRole("button", { name: "1 task to go" })).toBeDisabled();
  });

  it("completes the step once every task is ticked, then offers to continue", async () => {
    const user = userEvent.setup();
    const { onPathChanged, onContinue } = renderWorkspace();

    await user.click(await screen.findByRole("button", { name: /Install Node/ }));
    expect(onboardingService.updateTask).toHaveBeenCalledWith(tasks[0], true);

    await user.click(screen.getByRole("button", { name: "Mark as complete" }));
    expect(onboardingService.updateStepStatus).toHaveBeenCalledWith(step, "FINISHED");
    await waitFor(() => expect(onPathChanged).toHaveBeenCalled());

    await user.click(await screen.findByRole("button", { name: "Next step" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("starts a step that was never started, with the rocket", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...step,
      status: "WAITING",
      startedAt: null,
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole("button", { name: "Start step" }));

    expect(onboardingService.startStep).toHaveBeenCalledWith("step1");
    expect(mockFlyby).toHaveBeenCalled();
  });

  it("sends a skip request with a reason", async () => {
    vi.mocked(onboardingService.skipStep).mockResolvedValue({
      id: "skip1",
      stepId: "step1",
      reason: "Already know it",
      status: "PENDING",
      reviewComment: null,
    } as never);
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole("button", { name: "Skip" }));
    await user.type(screen.getByLabelText("Reason for skipping"), "Already know it");
    await user.click(screen.getByRole("button", { name: "Request skip" }));

    expect(onboardingService.skipStep).toHaveBeenCalledWith(step, "Already know it");
    expect(await screen.findByRole("button", { name: "Skip requested" })).toBeDisabled();
  });
});
