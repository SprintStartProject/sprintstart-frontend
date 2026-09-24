import { act, render, screen, waitFor } from "@testing-library/react";
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
    completeStep: vi.fn(),
    skipStep: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

const mockOpenAiBuddy = vi.hoisted(() => vi.fn());

// The real path-changed signal, so a test can announce one the way the dock does.
vi.mock("../../../../../../src/features/buddy/aiBuddyBus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../../src/features/buddy/aiBuddyBus")>()),
  openAiBuddy: mockOpenAiBuddy,
}));

import { onboardingService } from "../../../../../../src/services/onboardingService";
import { announceBuddyPathChanged } from "../../../../../../src/features/buddy/aiBuddyBus";

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

/** The same, but handing back `rerender` so the path's status can change under the workspace. */
function renderWaitingWorkspace(waiting: { status: "WAITING" }) {
  const props = {
    stepId: "step1",
    stepStatus: waiting.status,
    onPathChanged: vi.fn().mockResolvedValue(undefined),
    continueLabel: "Next step",
    onContinue: vi.fn(),
  };
  const { rerender } = render(<StepWorkspace {...props} />);
  return { rerender, props };
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

  /**
   * Opening a WAITING step fires `PUT /start` and this component's `GET` in the same tick, so the
   * read frequently came back WAITING and left "Start step" on a step that had already begun --
   * and nothing re-read it, because the load only depended on the id.
   */
  it("re-reads the step when the path says its status has moved on", async () => {
    const waiting = { ...step, status: "WAITING" as const, startedAt: null };
    vi.mocked(onboardingService.fetchStep).mockResolvedValue(waiting);

    const { rerender, props } = renderWaitingWorkspace(waiting);

    expect(await screen.findByRole("button", { name: "Start step" })).toBeInTheDocument();

    // The page started it and its refreshed path now says so.
    vi.mocked(onboardingService.fetchStep).mockResolvedValue(step);
    rerender(<StepWorkspace {...props} stepStatus="IN_PROGRESS" />);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Start step" })).not.toBeInTheDocument(),
    );
    expect(onboardingService.startStep).not.toHaveBeenCalled();
  });

  /**
   * The answer is marked seen by whoever draws it. Opening a step used to do it -- which includes
   * "Continue" and "Up next", so answers were marked seen on the way past.
   */
  it("marks an answered skip request seen once it is on screen", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...step,
      skip: {
        id: "skip-1",
        stepId: "step1",
        reason: "I have done this before",
        accepted: false,
        reviewComment: "Have a look anyway",
        reviewedAt: "2026-07-02T00:00:00Z",
        answerSeenAt: null,
      },
    });
    const onSkipAnswerSeen = vi.fn();

    renderWorkspace({ onSkipAnswerSeen });

    await waitFor(() => expect(onSkipAnswerSeen).toHaveBeenCalledWith("skip-1"));
  });

  /**
   * `accepted` is an explicit `null` on a pending request, but an omitted one means the same
   * thing -- and `accepted !== null` is true for `undefined`, which had the page reporting that
   * the member had seen an answer nobody has given yet.
   */
  it("does not mark a request whose answer is still missing as seen", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...step,
      skip: {
        id: "skip-1",
        stepId: "step1",
        reason: "I have done this before",
        reviewComment: null,
        reviewedAt: null,
        answerSeenAt: null,
      } as unknown as NonNullable<(typeof step)["skip"]>,
    });
    const onSkipAnswerSeen = vi.fn();

    renderWorkspace({ onSkipAnswerSeen });

    await screen.findByRole("button", { name: /Install Node/ });
    expect(onSkipAnswerSeen).not.toHaveBeenCalled();
  });

  it("leaves an answer that has already been seen alone", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...step,
      skip: {
        id: "skip-1",
        stepId: "step1",
        reason: "I have done this before",
        accepted: true,
        reviewComment: null,
        reviewedAt: "2026-07-02T00:00:00Z",
        answerSeenAt: "2026-07-03T00:00:00Z",
      },
    });
    const onSkipAnswerSeen = vi.fn();

    renderWorkspace({ onSkipAnswerSeen });

    await screen.findByRole("button", { name: /Install Node/ });
    expect(onSkipAnswerSeen).not.toHaveBeenCalled();
  });

  it("completes the step once every task is ticked, then offers to continue", async () => {
    const user = userEvent.setup();
    const { onPathChanged, onContinue } = renderWorkspace();

    await user.click(await screen.findByRole("button", { name: /Install Node/ }));
    expect(onboardingService.updateTask).toHaveBeenCalledWith(tasks[0], true);

    await user.click(screen.getByRole("button", { name: "Mark as complete" }));
    expect(onboardingService.completeStep).toHaveBeenCalledWith(step.id);
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

  it("offers the buddy on a step that is still open, with the step in the draft", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      await screen.findByRole("button", { name: "Stuck? Ask your buddy about this step" }),
    );

    expect(mockOpenAiBuddy).toHaveBeenCalledWith({
      draft: expect.stringContaining("Setup Environment") as string,
    });
  });

  it("re-reads the step after the buddy changed the path", async () => {
    renderWorkspace();
    await screen.findByText("1/2 done");
    vi.mocked(onboardingService.fetchTasks).mockResolvedValue(
      tasks.map((task) => ({ ...task, finished: true })),
    );

    act(() => announceBuddyPathChanged());

    await waitFor(() => expect(screen.getByText("2/2 done")).toBeInTheDocument());
  });

  it("does not offer the buddy on a step that is behind the hire", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({ ...step, status: "FINISHED" });
    renderWorkspace();

    await screen.findByText("Set up your dev environment");
    expect(screen.queryByRole("button", { name: /ask your buddy/i })).not.toBeInTheDocument();
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
