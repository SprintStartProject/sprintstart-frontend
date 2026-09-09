import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { onboardingService } from "../../../src/services/onboardingService";

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
        selectedProjectId: "proj1",
        selectedProject: createSelectableProject({ id: "proj1", name: "Project One" }),
      }),
  };
});

describe("OnBoardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
                  status: "OPEN",
                  startedAt: null,
                  completedAt: null,
                  feedback: null,
                  skip: null,
                },
              ],
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
    expect(screen.getByText("1/3 Tasks")).toBeInTheDocument();
  });

  it("switches to the read-only graph and opens a phase subgraph", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnBoardingPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Graph view" }));

    expect(screen.getByText("Your onboarding graph")).toBeInTheDocument();
    expect(screen.queryByText("Create on canvas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Phase 1 Open phase/ }));

    expect(screen.getByRole("button", { name: "Back to phases" })).toBeInTheDocument();
    expect(
      screen.getByText("Read-only view of this phase's steps and knowledge-check questions."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
