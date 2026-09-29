import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage.tsx";
import { server } from "../../unit/setup/vitest.setup";
import {
  OnboardingJourneyContext,
  type OnboardingGeneration,
  type OnboardingJourneyValue,
} from "../../../src/features/onboarding/generation/OnboardingJourneyContext.ts";

// The generation screen's dino game outlives the run it was opened for. These cases pin down what
// the page shows once that run ends while the game is still up: a failure must take over, a success
// must read as finished.

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user1" } }),
}));

vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({
    celebrate: vi.fn(),
    flyby: vi.fn(),
    completeMission: vi.fn(),
    revealPath: vi.fn(),
    playLaunchSequence: vi.fn(),
    isLaunching: false,
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "proj1",
        selectedProject: createSelectableProject({ id: "proj1", name: "Project One" }),
        isLoading: false,
        isSwitcherEnabled: true,
      }),
  };
});

const RUNNING: OnboardingGeneration = {
  status: "running",
  projectId: "proj1",
  startedAt: Date.now(),
  phases: [
    { name: "Project Overview", detail: "Completed", state: "done" },
    { name: "Architecture", detail: "Searching the project for: ADRs", state: "working" },
    { name: "First Task", detail: "", state: "waiting" },
  ],
};

function journey(generation: OnboardingGeneration): OnboardingJourneyValue {
  return {
    generation,
    startGeneration: vi.fn(),
    clearGeneration: vi.fn(),
    availability: "buildable",
    unavailableReason: null,
    refreshAvailability: vi.fn(),
  };
}

function page(generation: OnboardingGeneration) {
  return (
    <MemoryRouter>
      <OnboardingJourneyContext.Provider value={journey(generation)}>
        <OnBoardingPage />
      </OnboardingJourneyContext.Provider>
    </MemoryRouter>
  );
}

/** Renders a running generation and opens the dino game over it, as a member pressing Space would. */
async function renderWithGameOpen() {
  const view = render(page(RUNNING));
  expect(await screen.findByText("Building your onboarding path")).toBeInTheDocument();
  fireEvent.keyDown(window, { code: "Space" });
  expect(screen.getByTestId("dino-game")).toBeInTheDocument();
  return view;
}

// Testing Library unmounts after every case, which releases the game's module-level slot, so each
// case can open the game again.
describe("OnBoardingPage — generation ending while the dino game is open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("dinoUnlocked", "true");
  });

  it("shows the failure and its retry instead of the frozen generation screen", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );
    const view = await renderWithGameOpen();

    view.rerender(page({ status: "error", message: "The AI service is unavailable." }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI service is unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
    expect(screen.queryByText("Building your onboarding path")).not.toBeInTheDocument();
    expect(screen.queryByTestId("generation-elapsed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("generation-phase")).not.toBeInTheDocument();
  });

  it("keeps the failure up after the page clears the error", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );
    const view = await renderWithGameOpen();

    view.rerender(page({ status: "error", message: "The AI service is unavailable." }));
    await screen.findByRole("alert");
    // A cleared failure must not bring the generation screen back just because the game was open.
    view.rerender(page({ status: "idle" }));

    expect(
      await screen.findByRole("button", { name: "Start personalization" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Building your onboarding path")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
  });

  it("says 'Path ready' with every phase done, and keeps saying it once the status is cleared", async () => {
    const view = await renderWithGameOpen();

    view.rerender(page({ status: "done", path: null }));

    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent(/path ready/i);
    const phases = screen.getAllByTestId("generation-phase");
    expect(phases).toHaveLength(3);
    for (const phase of phases) expect(phase).toHaveAttribute("data-state", "done");
    expect(screen.getByText("3 of 3 phases assembled")).toBeInTheDocument();

    // The page clears a finished generation once it has fetched the new path.
    await act(async () => {
      view.rerender(page({ status: "idle" }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("dino-game")).toBeInTheDocument();
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent(/path ready/i);
    for (const phase of screen.getAllByTestId("generation-phase")) {
      expect(phase).toHaveAttribute("data-state", "done");
    }
  });
});
