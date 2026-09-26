import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { onboardingService } from "../../../src/services/onboardingService";
import {
  OnboardingJourneyContext,
  type OnboardingJourneyValue,
} from "../../../src/features/onboarding/generation/OnboardingJourneyContext";

const { signedInUserId } = vi.hoisted(() => ({ signedInUserId: { value: "user1" } }));

const { projectContextState } = vi.hoisted(() => ({
  projectContextState: {
    selectedProjectId: "proj1",
    isLoading: false,
    isSwitcherEnabled: true,
  },
}));

// The page reads the signed-in id to key the remembered view on the account rather than on the
// browser, which is the one thing it asks the auth context for.
vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: signedInUserId.value } }),
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

function journeyValue(overrides: JourneyOverrides = {}): OnboardingJourneyValue {
  return {
    generation: { status: "idle" },
    startGeneration: vi.fn(),
    clearGeneration: vi.fn(),
    availability: "buildable",
    unavailableReason: null,
    refreshAvailability: vi.fn(),
    ...overrides,
  };
}

/** Where the router currently is, for the cases that assert the page navigated away. */
function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

/** A second arrival, clicked while the page is already mounted. */
function LinkTo({ to }: { to: string }) {
  return <Link to={to}>second link</Link>;
}

/** Whether the list row for an item is the one unfolded. */
async function expectUnfolded(itemId: string) {
  await waitFor(() =>
    expect(
      document.querySelector(`[data-item-id="${itemId}"] button[aria-expanded]`),
    ).toHaveAttribute("aria-expanded", "true"),
  );
}

function renderPage(overrides: JourneyOverrides = {}) {
  const value = journeyValue(overrides);
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
    // Rebuilding throws the member's progress away: that is the PM's call, from the PM area.
    expect(screen.queryByRole("button", { name: /rebuild|regenerate/i })).not.toBeInTheDocument();
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
    expect(screen.getByTitle("Role-specific tasks — Could not be reached")).toBeInTheDocument();
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
    expect(screen.getByText("Came back empty")).toBeInTheDocument();
    expect(screen.getByText("Role-specific tasks")).toBeInTheDocument();
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
    expect(screen.getByTitle("Architecture — Took too long")).toBeInTheDocument();
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
    expect(screen.getByText("Took too long")).toBeInTheDocument();
    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(
      screen.getByText(/the journey is simply empty until one of them lands/),
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
      "sprintstart.onboarding.view.user1",
      JSON.stringify({ mode: "graph", graphPhaseId: "phase2" }),
    );

    renderPage();

    expect(
      await screen.findByRole("application", {
        name: "Graph of the steps and questions in Phase 2",
      }),
    ).toBeInTheDocument();
  });

  /**
   * Browser storage is per browser, not per account. A shared key handed one account's remembered
   * view to whoever signed in next on the same machine.
   */
  it("keeps one account's remembered view out of another's", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user2",
          createdAt: new Date().toISOString(),
          phases: [phaseFixture("phase1", 1, "Phase 1"), phaseFixture("phase2", 2, "Phase 2")],
        }),
      ),
    );
    localStorage.setItem(
      "sprintstart.onboarding.view.user1",
      JSON.stringify({ mode: "graph", graphPhaseId: "phase2" }),
    );
    signedInUserId.value = "user2";

    renderPage();

    // The list, which is what an account with nothing remembered gets -- not the graph the other
    // account left behind.
    expect(await screen.findByRole("button", { name: /Phase 1 step/ })).toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();

    // And what this account does is written under its own key, leaving the other one alone.
    await waitFor(() =>
      expect(localStorage.getItem("sprintstart.onboarding.view.user2")).not.toBeNull(),
    );
    expect(
      JSON.parse(localStorage.getItem("sprintstart.onboarding.view.user1") ?? "{}"),
    ).toMatchObject({ mode: "graph", graphPhaseId: "phase2" });
  });

  /**
   * `/onboarding` and `/onboarding/:stepId` are the same component in the same position, so a
   * second link arriving while the page is open remounts nothing. It used to be ignored.
   */
  it("follows a second deep link without being remounted", async () => {
    const user = userEvent.setup();
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

    render(
      <MemoryRouter initialEntries={["/onboarding/step-phase1"]}>
        <OnboardingJourneyContext.Provider value={journeyValue()}>
          <Routes>
            <Route path="/onboarding" element={<OnBoardingPage />} />
            <Route path="/onboarding/:stepId" element={<OnBoardingPage />} />
          </Routes>
          <LinkTo to="/onboarding/step-phase2" />
        </OnboardingJourneyContext.Provider>
      </MemoryRouter>,
    );

    await expectUnfolded("step-phase1");

    await user.click(screen.getByRole("link", { name: "second link" }));

    await expectUnfolded("step-phase2");
  });

  /**
   * A stale link, a step from a rebuilt path, somebody else's: the page used to render an
   * arbitrary phase with nothing unfolded and the dead id still in the address.
   */
  it("says so when a deep link points at a step that is not on the path", async () => {
    render(
      <MemoryRouter initialEntries={["/onboarding/step-that-went-away"]}>
        <OnboardingJourneyContext.Provider value={journeyValue()}>
          <Routes>
            <Route path="/onboarding" element={<OnBoardingPage />} />
            <Route path="/onboarding/:stepId" element={<OnBoardingPage />} />
          </Routes>
          <LocationDisplay />
        </OnboardingJourneyContext.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/onboarding$/));
  });
});
