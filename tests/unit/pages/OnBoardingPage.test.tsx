import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { onboardingService } from "../../../src/services/onboardingService";
import {
  OnboardingJourneyContext,
  type OnboardingJourneyValue,
} from "../../../src/features/onboarding/generation/OnboardingJourneyContext";

const { projectContextState } = vi.hoisted(() => ({
  projectContextState: {
    selectedProjectId: "proj1",
    isLoading: false,
    isSwitcherEnabled: true,
  },
}));

// The celebratory layer is decorative and lives behind its own provider; the
// page only needs a no-op `celebrate` to render.
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

vi.mock("../../../src/services/userService", () => ({
  userService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "user1",
      authId: "auth-1",
      username: "testuser",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      projectRoles: [],
      permissionGroup: "USER",
      enabled: true,
      profileIcon: null,
      hasCompletedOnboarding: true,
    }),
  },
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: projectContextState.selectedProjectId,
        selectedProject: projectContextState.selectedProjectId
          ? createSelectableProject({
              id: projectContextState.selectedProjectId,
              name: "Project One",
            })
          : null,
        isLoading: projectContextState.isLoading,
        isSwitcherEnabled: projectContextState.isSwitcherEnabled,
      }),
  };
});

type JourneyOverrides = Partial<OnboardingJourneyValue>;

function renderPage(overrides: JourneyOverrides = {}) {
  const value: OnboardingJourneyValue = {
    generation: { status: "idle" },
    startGeneration: vi.fn(),
    clearGeneration: vi.fn(),
    availability: "buildable",
    unavailableReason: null,
    refreshAvailability: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <OnboardingJourneyContext.Provider value={value}>
        <OnBoardingPage />
      </OnboardingJourneyContext.Provider>
    </MemoryRouter>,
  );
}

// Minimal phase payload matching the `/api/v1/onboarding/me/path` contract — enough for
// the phase tabs and graph viewer to render, without duplicating the MSW mock's verbosity.
function phaseFixture(id: string, position: number, title: string) {
  return {
    id,
    pathId: "path1",
    position,
    title,
    description: `${title} description`,
    steps: [
      {
        id: `step-${id}`,
        phaseId: id,
        position: 1,
        title: `${title} step`,
        description: "Do the step",
        type: "TASK",
        estimatedMinutes: 10,
        expectedOutcomes: [],
        tasks: [],
        resources: [],
        status: "IN_PROGRESS",
        startedAt: null,
        completedAt: null,
        feedback: null,
        skip: null,
      },
    ],
    questions: [],
  };
}

describe("OnBoardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The page remembers list or graph; every test starts from a page never seen before.
    localStorage.clear();
    projectContextState.selectedProjectId = "proj1";
    projectContextState.isLoading = false;
    projectContextState.isSwitcherEnabled = true;
  });

  it("renders loading state initially", () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => {
        return new Promise<never>(() => {});
      }),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading onboarding path...")).toBeInTheDocument();
  });

  it("renders error state on failure", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Onboarding could not be loaded")).toBeInTheDocument();
    });
  });

  it("waits for an explicit click before starting personalization", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );
    const startGeneration = vi.fn();

    renderPage({ startGeneration });

    const startButton = await screen.findByRole("button", { name: "Start personalization" });
    expect(startGeneration).not.toHaveBeenCalled();

    await user.click(startButton);

    // The generation belongs to the app-wide provider, so it survives leaving this page.
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(startGeneration).toHaveBeenCalledWith("proj1");
  });

  it("shows every phase of a running generation, even after coming back to the page", async () => {
    renderPage({
      generation: {
        status: "running",
        projectId: "proj1",
        startedAt: Date.now(),
        phases: [
          { name: "Project Overview", detail: "Completed", state: "done" },
          { name: "Architecture", detail: "Searching the project for: ADRs", state: "working" },
        ],
      },
    });

    expect(await screen.findByText("Building your onboarding path")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 phases assembled")).toBeInTheDocument();
    expect(screen.getByText("Searching the project for: ADRs")).toBeInTheDocument();
  });

  it("explains why no path can be built instead of offering a generation that would fail", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );

    renderPage({ availability: "unavailable", unavailableReason: "no-content" });

    expect(await screen.findByText(/nothing to learn from yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start personalization" })).not.toBeInTheDocument();
  });

  it("shows why the last generation failed next to the retry", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );

    renderPage({
      generation: {
        status: "error",
        message: "This project has no published onboarding blueprint yet.",
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("no published onboarding blueprint");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("asks for a project instead of offering personalization without one", async () => {
    projectContextState.selectedProjectId = "";
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );
    const personalize = vi.spyOn(onboardingService, "personalizePath");

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No project selected")).toBeInTheDocument();
    expect(
      screen.getByText(/Select a project from the project switcher before creating/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start personalization" })).not.toBeInTheDocument();
    expect(personalize).not.toHaveBeenCalled();
  });

  it("renders path after successful load", async () => {
    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Onboarding" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Phase 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Step 1").length).toBeGreaterThan(0);
  });

  it("computes progress correctly", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [
            {
              id: "phase1",
              pathId: "path1",
              position: 1,
              title: "Onboarding Phase 1",
              description: "Desc 1",
              steps: [
                {
                  id: "step1",
                  phaseId: "phase1",
                  position: 1,
                  title: "Step 1",
                  description: "",
                  type: "TASK",
                  estimatedMinutes: 10,
                  expectedOutcomes: [],
                  tasks: [],
                  resources: [],
                  status: "FINISHED",
                  startedAt: null,
                  completedAt: null,
                  feedback: null,
                  skip: null,
                },
                {
                  id: "step2",
                  phaseId: "phase1",
                  position: 2,
                  title: "Step 2",
                  description: "",
                  type: "TASK",
                  estimatedMinutes: 10,
                  expectedOutcomes: [],
                  tasks: [],
                  resources: [],
                  status: "IN_PROGRESS",
                  startedAt: null,
                  completedAt: null,
                  feedback: null,
                  skip: null,
                },
                {
                  id: "step3",
                  phaseId: "phase1",
                  position: 3,
                  title: "Step 3",
                  description: "",
                  type: "TASK",
                  estimatedMinutes: 10,
                  expectedOutcomes: [],
                  tasks: [],
                  resources: [],
                  status: "WAITING",
                  startedAt: null,
                  completedAt: null,
                  feedback: null,
                  skip: null,
                },
              ],
              questions: [],
            },
          ],
        }),
      ),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Onboarding" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("33%").length).toBeGreaterThan(0);
    expect(screen.getByText("0 of 1 phases complete")).toBeInTheDocument();
    expect(screen.getByText(/1 step done/)).toBeInTheDocument();
  });

  it("shows a warning beside regeneration when a generated phase was hidden", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [
            {
              id: "phase1",
              pathId: "path1",
              position: 1,
              title: "Foundation",
              description: "Start here",
              locked: false,
              steps: [],
              questions: [],
            },
          ],
          generationIssues: [{ phaseId: "phase2", title: "Role-specific tasks", status: "FAILED" }],
        }),
      ),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("status", { name: "1 onboarding phase could not be generated" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Role-specific tasks (failed)")).toBeInTheDocument();
  });

  it("offers regeneration when every generated phase is hidden", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [],
          generationIssues: [{ phaseId: "phase1", title: "Role-specific tasks", status: "EMPTY" }],
        }),
      ),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No onboarding phases were generated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try generation again" })).toBeInTheDocument();
    expect(screen.getByText("Role-specific tasks (empty)")).toBeInTheDocument();
  });

  it("shows a 'timed out' label for a timed-out generation issue", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [
            {
              id: "phase1",
              pathId: "path1",
              position: 1,
              title: "Foundation",
              description: "Start here",
              locked: false,
              steps: [],
              questions: [],
            },
          ],
          generationIssues: [{ phaseId: "phase2", title: "Architecture", status: "TIMED_OUT" }],
        }),
      ),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("status", { name: "1 onboarding phase could not be generated" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Architecture (timed out)")).toBeInTheDocument();
  });

  it("warns that every phase timed out and offers regeneration", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [],
          generationIssues: [{ phaseId: "phase1", title: "Architecture", status: "TIMED_OUT" }],
        }),
      ),
    );

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No onboarding phases were generated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try generation again" })).toBeInTheDocument();
    expect(screen.getByText("Architecture (timed out)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The generated phases were empty, could not be assembled, or timed out, so they have been left out of your journey.",
      ),
    ).toBeInTheDocument();
  });

  it("switches to the graph with the view slider and back to the list", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Graph" }));

    expect(
      await screen.findByRole("application", { name: /Journey map of all onboarding phases/ }),
    ).toBeInTheDocument();
    // The hire reads and arranges their graph; nothing here rewires it.
    expect(screen.queryByTitle("Drag to what this unlocks")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(
      await screen.findByRole("list", { name: "Phase 1: steps and questions" }),
    ).toBeInTheDocument();
  });

  it("steps into a phase from the journey map, and back out", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [phaseFixture("phase1", 1, "Phase 1"), phaseFixture("phase2", 2, "Phase 2")],
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Graph" }));
    await user.click(await screen.findByRole("button", { name: /^Phase 2: Phase 2,/ }));

    expect(
      await screen.findByRole("application", {
        name: "Graph of the steps and questions in Phase 2",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Journey map" }));
    expect(
      await screen.findByRole("application", { name: /Journey map of all onboarding phases/ }),
    ).toBeInTheDocument();
  });

  it("lets the hire pick the next phase when several open at once", async () => {
    const finished = phaseFixture("phase1", 1, "Basics");
    finished.steps[0].status = "FINISHED";
    const left = phaseFixture("phase2", 2, "Backend");
    left.steps[0].status = "WAITING";
    const right = phaseFixture("phase3", 3, "Frontend");
    right.steps[0].status = "WAITING";
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [finished, left, right],
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/2 phases are open/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Phase 3\s*Frontend/ }));

    expect(screen.queryByText(/2 phases are open/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Frontend step" })).toBeInTheDocument();
  });

  it("opens a step in place, without leaving the path", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () =>
        HttpResponse.json({ ...phaseFixture("phase1", 1, "Phase 1").steps[0] }),
      ),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [phaseFixture("phase1", 1, "Phase 1")],
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    const list = await screen.findByRole("list", { name: "Phase 1: steps and questions" });
    await user.click(within(list).getByRole("button", { name: /Phase 1 step/, expanded: false }));

    expect(await screen.findByRole("button", { name: "Mark as complete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Onboarding" })).toBeInTheDocument();
  });

  it("marks an answered skip request on the step until the hire opens it", async () => {
    const phase = phaseFixture("phase1", 1, "Phase 1");
    phase.steps[0] = {
      ...phase.steps[0],
      status: "SKIPPED",
      skip: {
        id: "skip1",
        stepId: phase.steps[0].id,
        reason: "Did this last week",
        accepted: true,
        reviewComment: "Makes sense",
        reviewedAt: "2026-09-18T10:00:00Z",
        answerSeenAt: null,
      },
    } as never;
    const seen = vi.fn();
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () => HttpResponse.json(phase.steps[0])),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/skips/:skipId/seen", ({ params }) => {
        seen(params.skipId);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [phase],
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    const list = await screen.findByRole("list", { name: "Phase 1: steps and questions" });
    expect(within(list).getByText(/new answer from your project manager/)).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: /Phase 1 step/, expanded: false }));

    await waitFor(() => expect(seen).toHaveBeenCalledWith("skip1"));
    expect(
      within(list).queryByText(/new answer from your project manager/),
    ).not.toBeInTheDocument();
    // The answer itself stays readable in the step.
    expect(within(list).getByText("Skip approved")).toBeInTheDocument();
  });

  it("lands on a step unfolded when opened by its address", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () =>
        HttpResponse.json({ ...phaseFixture("phase1", 1, "Phase 1").steps[0] }),
      ),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [phaseFixture("phase1", 1, "Phase 1")],
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/onboarding/step-phase1"]}>
        <OnboardingJourneyContext.Provider
          value={{
            generation: { status: "idle" },
            startGeneration: vi.fn(),
            clearGeneration: vi.fn(),
            availability: "path",
            unavailableReason: null,
            refreshAvailability: vi.fn(),
          }}
        >
          <Routes>
            <Route path="/onboarding/:stepId" element={<OnBoardingPage />} />
          </Routes>
        </OnboardingJourneyContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: "Mark as complete" })).toBeInTheDocument();
  });

  it("names what a locked item is waiting on", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [
            {
              ...phaseFixture("phase1", 1, "Phase 1"),
              steps: [
                {
                  ...phaseFixture("phase1", 1, "Phase 1").steps[0],
                  id: "a",
                  title: "Set up the repo",
                  status: "IN_PROGRESS",
                },
                {
                  ...phaseFixture("phase1", 1, "Phase 1").steps[0],
                  id: "b",
                  position: 2,
                  title: "Run the tests",
                  status: "WAITING",
                  locked: true,
                  blockerIds: ["a"],
                },
              ],
            },
          ],
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Run the tests")).toBeInTheDocument();
    expect(screen.getByText(/Waits on/)).toHaveTextContent("Waits on Set up the repo");
  });
  it("comes back to the view and phase it was left in", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [phaseFixture("phase1", 1, "Phase 1"), phaseFixture("phase2", 2, "Phase 2")],
        }),
      ),
    );
    localStorage.setItem(
      "sprintstart.onboarding.view",
      JSON.stringify({ mode: "graph", graphPhaseId: "phase2" }),
    );

    renderPage();

    expect(
      await screen.findByRole("application", {
        name: "Graph of the steps and questions in Phase 2",
      }),
    ).toBeInTheDocument();
  });
});
