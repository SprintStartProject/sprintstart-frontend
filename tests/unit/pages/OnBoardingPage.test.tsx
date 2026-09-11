import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { onboardingService } from "../../../src/services/onboardingService";

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
    const personalize = vi
      .spyOn(onboardingService, "personalizePath")
      .mockImplementation((_projectId, handlers) => {
        handlers.onStage?.("Enhancing phases", "Phase 1 of 3");
        return Promise.resolve();
      });

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    const startButton = await screen.findByRole("button", { name: "Start personalization" });
    expect(personalize).not.toHaveBeenCalled();

    await user.click(startButton);

    expect(personalize).toHaveBeenCalledTimes(1);
    expect(personalize).toHaveBeenCalledWith("proj1", expect.any(Object));
    expect(await screen.findByText("Enhancing phases")).toBeInTheDocument();
    expect(screen.getByText("Phase 1 of 3")).toBeInTheDocument();
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
      expect(screen.getByText("Your onboarding journey")).toBeInTheDocument();
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
      expect(screen.getByText("Your onboarding journey")).toBeInTheDocument();
    });

    expect(screen.getAllByText("33%").length).toBeGreaterThan(0);
    expect(screen.getByText("1/3 items")).toBeInTheDocument();
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

  it("switches to the read-only graph and opens a phase subgraph", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Graph view" }));

    // The graph opens directly on the selected phase's subgraph.
    expect(await screen.findByRole("heading", { name: "Phase 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to phases" }));

    expect(screen.getByText("Your onboarding graph")).toBeInTheDocument();
    expect(screen.queryByText("Create on canvas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Phase 1 Open phase/ }));

    expect(screen.getByRole("button", { name: "Back to phases" })).toBeInTheDocument();
    expect(
      screen.getByText("Read-only view of this phase's steps and knowledge-check questions."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("re-targets the subgraph when a different phase is picked in the header", async () => {
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

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    // The graph opens directly on the active phase's subgraph.
    await user.click(await screen.findByRole("button", { name: "Graph view" }));
    expect(await screen.findByRole("heading", { name: "Phase 1" })).toBeInTheDocument();

    // Inside Phase 1's subgraph, a header phase-tab click must switch the drill-down —
    // previously the viewer kept rendering the stale phase's subgraph.
    await user.click(screen.getByRole("button", { name: /^Phase 2/ }));

    expect(await screen.findByRole("heading", { name: "Phase 2" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Phase 1" })).not.toBeInTheDocument();
  });
});
