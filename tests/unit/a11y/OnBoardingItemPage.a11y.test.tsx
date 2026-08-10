import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { OnBoardingItemPage } from "../../../src/features/onboarding/components/OnBoardingItemPage";

// The celebratory layer is decorative and lives behind its own provider; the
// page only needs a no-op `flyby` to render.
vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({
    celebrate: vi.fn(),
    flyby: vi.fn(),
    completeMission: vi.fn(),
    playLaunchSequence: vi.fn(),
    isLaunching: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await import("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ stepId: "step1" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../../src/services/onboardingService", () => ({
  onboardingService: {
    fetchStep: vi.fn().mockResolvedValue({
      id: "step1",
      phaseId: "phase1",
      position: 0,
      title: "Setup your environment",
      description: "Get your dev environment ready.",
      type: "TASK",
      estimatedMinutes: 30,
      expectedOutcomes: ["Node.js installed", "Dependencies installed"],
      tasks: [],
      resources: [],
      status: "IN_PROGRESS",
      startedAt: "2026-07-01T00:00:00.000Z",
      completedAt: null,
      feedback: null,
      skip: null,
    }),
    fetchTasks: vi.fn().mockResolvedValue([
      {
        id: "t1",
        stepId: "step1",
        position: 0,
        title: "Install Node.js",
        description: "",
        finished: false,
      },
    ]),
    fetchResources: vi.fn().mockResolvedValue([
      {
        id: "res1",
        stepId: "step1",
        title: "Node.js download",
        description: "",
        url: "https://nodejs.org",
      },
    ]),
    fetchPath: vi.fn().mockResolvedValue({ phases: [] }),
    startStep: vi.fn().mockResolvedValue(undefined),
    updateStepStatus: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    skipStep: vi.fn().mockResolvedValue({
      id: "skip1",
      stepId: "step1",
      status: "PENDING",
      reason: "",
      reviewComment: null,
      createdAt: "",
    }),
    submitFeedback: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("OnBoardingItemPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <OnBoardingItemPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Setup your environment")).toBeInTheDocument();
    });

    expect(screen.getByText(/Install Node\.js/)).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
