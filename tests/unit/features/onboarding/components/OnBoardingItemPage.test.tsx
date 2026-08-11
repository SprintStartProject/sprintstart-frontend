import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnBoardingItemPage } from "../../../../../src/features/onboarding/components/OnBoardingItemPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ stepId: "step1" }),
  useNavigate: () => mockNavigate,
}));

// The celebratory layer lives behind its own provider, so the page gets a stub.
// `flyby` is hoisted rather than created inline so it can be asserted on: which
// action sends the rocket is a product decision, not an implementation detail.
const mockFlyby = vi.hoisted(() => vi.fn());

vi.mock("../../../../../src/features/moments", () => ({
  useMoments: () => ({
    celebrate: vi.fn(),
    flyby: mockFlyby,
    completeMission: vi.fn(),
    playLaunchSequence: vi.fn(),
    isLaunching: false,
  }),
}));

vi.mock("../../../../../src/services/onboardingService", () => ({
  onboardingService: {
    fetchStep: vi.fn(),
    fetchTasks: vi.fn(),
    fetchResources: vi.fn(),
    updateTask: vi.fn(),
    updateStepStatus: vi.fn(),
    skipStep: vi.fn(),
    submitFeedback: vi.fn(),
    fetchPath: vi.fn(),
    startStep: vi.fn(),
  },
}));

import { onboardingService } from "../../../../../src/services/onboardingService";

const mockStep = {
  id: "step1",
  phaseId: "phase1",
  position: 1,
  title: "Setup Environment",
  description: "Set up your dev environment",
  type: "TASK" as const,
  estimatedMinutes: 30,
  expectedOutcomes: ["Node.js installed", "Git configured"],
  tasks: [],
  resources: [],
  status: "IN_PROGRESS" as const,
  startedAt: "2026-07-01T00:00:00Z",
  completedAt: null,
  feedback: null,
  skip: null,
};

const mockTasks = [
  {
    id: "t1",
    stepId: "step1",
    position: 1,
    title: "Install Node",
    description: "Install Node.js",
    finished: false,
  },
  { id: "t2", stepId: "step1", position: 2, title: "Clone repo", description: "", finished: false },
];

const mockResources = [
  {
    id: "r1",
    stepId: "step1",
    title: "Node.js",
    description: "Download page",
    url: "https://nodejs.org",
  },
];

const noCheck = {
  required: false,
  questionCount: 0,
  passed: false,
  latestAttemptId: null,
  latestAttemptAt: null,
};

/** A path where another step is still waiting, so what comes next is a step. */
const pathWithNextStep = {
  id: "path1",
  userId: "user1",
  createdAt: "2026-07-01T00:00:00Z",
  phases: [
    {
      id: "phase1",
      pathId: "path1",
      position: 1,
      title: "Phase 1",
      description: "",
      locked: false,
      unlockReason: null,
      checkSummary: noCheck,
      steps: [
        { ...mockStep, status: "FINISHED" as const },
        { ...mockStep, id: "step2", position: 2, title: "Step 2", status: "WAITING" as const },
      ],
    },
  ],
};

/** A path whose only remaining obstacle is the current phase's knowledge check. */
const pathWithPendingCheck = {
  ...pathWithNextStep,
  phases: [
    {
      ...pathWithNextStep.phases[0],
      checkSummary: { ...noCheck, required: true, questionCount: 3 },
      steps: [{ ...mockStep, status: "FINISHED" as const }],
    },
  ],
};

describe("OnBoardingItemPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onboardingService.fetchStep).mockResolvedValue(mockStep);
    vi.mocked(onboardingService.fetchTasks).mockResolvedValue(mockTasks);
    vi.mocked(onboardingService.fetchResources).mockResolvedValue(mockResources);
    vi.mocked(onboardingService.updateTask).mockResolvedValue(undefined);
    vi.mocked(onboardingService.updateStepStatus).mockResolvedValue(undefined);
    vi.mocked(onboardingService.skipStep).mockResolvedValue({
      id: "skip1",
      stepId: "step1",
      status: "PENDING",
      reason: "too hard",
      reviewComment: null,
      createdAt: new Date().toISOString(),
    });
    vi.mocked(onboardingService.submitFeedback).mockResolvedValue(undefined);
    // The continue button reads the path to work out where it leads, so every test
    // rendering a finished step needs one.
    vi.mocked(onboardingService.fetchPath).mockResolvedValue(pathWithNextStep);
  });

  it("shows loading state initially", () => {
    vi.mocked(onboardingService.fetchStep).mockImplementation(() => new Promise(() => {}));
    render(<OnBoardingItemPage />);
    expect(screen.getByText("Loading step...")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(onboardingService.fetchStep).mockRejectedValue(new Error("Network error"));
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Could not load step")).toBeInTheDocument());
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("renders the step title, description, and expected outcomes", async () => {
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Setup Environment")).toBeInTheDocument());
    expect(screen.getByText("Set up your dev environment")).toBeInTheDocument();
    expect(screen.getByText("Node.js installed")).toBeInTheDocument();
    expect(screen.getByText("Git configured")).toBeInTheDocument();
  });

  it("renders tasks with completion count", async () => {
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("1. Install Node")).toBeInTheDocument());
    expect(screen.getByText(/0\/2 completed/)).toBeInTheDocument();
  });

  it("toggles a task when clicked", async () => {
    const user = userEvent.setup();
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("1. Install Node")).toBeInTheDocument());
    const taskButton = screen.getByText("1. Install Node").closest("button")!;
    await user.click(taskButton);

    expect(onboardingService.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      true,
    );
  });

  it("renders resources as links", async () => {
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Node.js")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Node\.js/ });
    expect(link).toHaveAttribute("href", "https://nodejs.org");
  });

  it("submits feedback when helpful is selected and comment is provided", async () => {
    const user = userEvent.setup();
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Helpful")).toBeInTheDocument());
    await user.click(screen.getByText("Helpful"));

    const textarea = screen.getByPlaceholderText("Tell us what worked or what was missing...");
    await user.type(textarea, "Great step!");

    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() =>
      expect(onboardingService.submitFeedback).toHaveBeenCalledWith("step1", true, "Great step!"),
    );
  });

  it("skips the step when reason is provided", async () => {
    const user = userEvent.setup();
    render(<OnBoardingItemPage />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Reason for skipping...")).toBeInTheDocument(),
    );
    const textarea = screen.getByPlaceholderText("Reason for skipping...");
    await user.type(textarea, "Already done");

    await user.click(screen.getByRole("button", { name: "Skip Step" }));

    await waitFor(() => expect(onboardingService.skipStep).toHaveBeenCalled());
  });

  it("marks step as completed when all tasks are done", async () => {
    const user = userEvent.setup();
    vi.mocked(onboardingService.fetchTasks).mockResolvedValue([
      {
        id: "t1",
        stepId: "step1",
        position: 1,
        title: "Install Node",
        description: "",
        finished: true,
      },
      {
        id: "t2",
        stepId: "step1",
        position: 2,
        title: "Clone repo",
        description: "",
        finished: true,
      },
    ]);
    render(<OnBoardingItemPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Mark as Completed/ })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Mark as Completed/ }));

    await waitFor(() =>
      expect(onboardingService.updateStepStatus).toHaveBeenCalledWith(
        expect.any(Object),
        "FINISHED",
      ),
    );
  });

  it('shows the "Continue to next step" button when step is finished', async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...mockStep,
      status: "FINISHED",
      completedAt: "2026-07-02T00:00:00Z",
    });
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Finished!")).toBeInTheDocument());
    expect(await screen.findByText("Continue to next step")).toBeInTheDocument();
  });

  it("offers the knowledge check when that is what blocks the way", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...mockStep,
      status: "FINISHED",
      completedAt: "2026-07-02T00:00:00Z",
    });
    vi.mocked(onboardingService.fetchPath).mockResolvedValue(pathWithPendingCheck);
    render(<OnBoardingItemPage />);

    // Calling this "next step" would be a lie: the next phase is locked behind the check.
    expect(await screen.findByText("Start knowledge check")).toBeInTheDocument();
    expect(screen.queryByText("Continue to next step")).not.toBeInTheDocument();
  });

  it("sends the user to the check on the overview instead of starting a step", async () => {
    const user = userEvent.setup();
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...mockStep,
      status: "FINISHED",
      completedAt: "2026-07-02T00:00:00Z",
    });
    vi.mocked(onboardingService.fetchPath).mockResolvedValue(pathWithPendingCheck);
    render(<OnBoardingItemPage />);

    await user.click(await screen.findByText("Start knowledge check"));

    // The phase id lets the overview scroll to the check rather than dropping the user
    // at the top of the step list they just worked through.
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
      state: { focusCheckPhaseId: "phase1" },
    });
    expect(onboardingService.startStep).not.toHaveBeenCalled();
  });

  it('navigates to the next step when "Continue" is clicked', async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...mockStep,
      status: "FINISHED",
      completedAt: "2026-07-02T00:00:00Z",
    });
    vi.mocked(onboardingService.fetchPath).mockResolvedValue({
      id: "path1",
      userId: "user1",
      createdAt: new Date().toISOString(),
      phases: [
        {
          id: "p1",
          pathId: "path1",
          position: 1,
          title: "Phase 1",
          description: "",
          locked: false,
          unlockReason: null,
          checkSummary: {
            required: false,
            questionCount: 0,
            passed: false,
            latestAttemptId: null,
            latestAttemptAt: null,
          },
          steps: [
            {
              id: "step2",
              phaseId: "p1",
              position: 2,
              title: "Step 2",
              description: "",
              type: "TASK" as const,
              estimatedMinutes: 10,
              expectedOutcomes: [],
              tasks: [],
              resources: [],
              status: "WAITING" as const,
              startedAt: null,
              completedAt: null,
              feedback: null,
              skip: null,
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Continue to next step")).toBeInTheDocument());
    await user.click(screen.getByText("Continue to next step"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/onboarding/step2"));
  });

  it("does not fly the rocket when the next step is already in progress", async () => {
    vi.mocked(onboardingService.fetchStep).mockResolvedValue({
      ...mockStep,
      status: "FINISHED",
      completedAt: "2026-07-02T00:00:00Z",
    });
    vi.mocked(onboardingService.fetchPath).mockResolvedValue({
      id: "path1",
      userId: "user1",
      createdAt: new Date().toISOString(),
      phases: [
        {
          id: "p1",
          pathId: "path1",
          position: 1,
          title: "Phase 1",
          description: "",
          locked: false,
          unlockReason: null,
          checkSummary: {
            required: false,
            questionCount: 0,
            passed: false,
            latestAttemptId: null,
            latestAttemptAt: null,
          },
          steps: [
            {
              id: "step2",
              phaseId: "p1",
              position: 2,
              title: "Step 2",
              description: "",
              type: "TASK" as const,
              estimatedMinutes: 10,
              expectedOutcomes: [],
              tasks: [],
              resources: [],
              status: "IN_PROGRESS" as const,
              startedAt: "2026-07-01T00:00:00Z",
              completedAt: null,
              feedback: null,
              skip: null,
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    render(<OnBoardingItemPage />);

    await waitFor(() => expect(screen.getByText("Continue to next step")).toBeInTheDocument());
    await user.click(screen.getByText("Continue to next step"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/onboarding/step2"));
    // Picking a half-finished step back up is a return, not a departure.
    expect(mockFlyby).not.toHaveBeenCalled();
  });
});
