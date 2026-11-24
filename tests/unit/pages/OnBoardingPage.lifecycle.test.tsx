import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { announceBuddyPathChanged } from "../../../src/features/buddy/aiBuddyBus";
import { OnBoardingPage } from "../../../src/pages/OnBoardingPage";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { hireJourneyViewKey } from "../../../src/features/onboarding/journeyViewMemory";
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
    canManageSelected: false,
  },
}));

// The page reads the signed-in id to key the remembered view on the account rather than on the
// browser, which is the one thing it asks the auth context for.
vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: signedInUserId.value } }),
}));

// One stable object, as the real hook's is: the page keeps `toast` in effect dependencies.
const toastMocks = vi.hoisted(() => ({
  show: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));
vi.mock("../../../src/context/useToast", () => ({ useToast: () => toastMocks }));

// The celebratory layer is decorative and lives behind its own provider; the
// page only needs a no-op `celebrate` to render.
const momentMocks = vi.hoisted(() => ({
  celebrate: vi.fn(),
  flyby: vi.fn(),
  completeMission: vi.fn(),
  revealPath: vi.fn(),
  playLaunchSequence: vi.fn(),
}));
vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({ ...momentMocks, isLaunching: false }),
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
        canManageSelected: projectContextState.canManageSelected,
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

type Step = ReturnType<typeof step>;
type StepStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "SKIPPED";

function step(id: string, phaseId: string, position: number, status: StepStatus, extra = {}) {
  return {
    id,
    phaseId,
    position,
    title: `Step ${id}`,
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...extra,
  };
}

function phase(
  id: string,
  position: number,
  title: string,
  extra: { steps?: Step[]; questions?: unknown[]; [key: string]: unknown } = {},
) {
  return {
    id,
    pathId: "path1",
    position,
    title,
    description: "",
    steps: [],
    questions: [],
    ...extra,
  };
}

function servePath(phases: unknown[]) {
  server.use(
    http.get("/api/v1/onboarding/me/path", () =>
      HttpResponse.json({
        id: "path1",
        userId: "user1",
        createdAt: new Date().toISOString(),
        phases,
      }),
    ),
  );
}

function renderWith(
  entry: Parameters<typeof MemoryRouter>[0]["initialEntries"],
  overrides: JourneyOverrides = {},
) {
  const value = journeyValue(overrides);
  return {
    value,
    ...render(
      <MemoryRouter initialEntries={entry}>
        <Routes>
          <Route
            path="/onboarding/:stepId?"
            element={
              <OnboardingJourneyContext.Provider value={value}>
                <OnBoardingPage />
              </OnboardingJourneyContext.Provider>
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

function rememberGraph() {
  localStorage.setItem(
    hireJourneyViewKey(signedInUserId.value),
    JSON.stringify({ mode: "graph", graphPhaseId: null }),
  );
}

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

const onePhase = [
  phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS", { title: "Working" })] }),
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(
    hireJourneyViewKey(signedInUserId.value),
    JSON.stringify({ mode: "list", graphPhaseId: null }),
  );
  projectContextState.selectedProjectId = "proj1";
  projectContextState.isLoading = false;
  projectContextState.isSwitcherEnabled = true;
  projectContextState.canManageSelected = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("OnBoardingPage: which view it opens in", () => {
  it("follows the remembered graph when nothing sent the hire here", async () => {
    rememberGraph();
    servePath(onePhase);

    renderWith(["/onboarding"]);

    await waitFor(() => expect(pressed("Graph")).toBe("true"));
    expect(pressed("List")).toBe("false");
  });

  it("opens the list for a step's address, whatever view was left", async () => {
    rememberGraph();
    servePath(onePhase);
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () =>
        HttpResponse.json(onePhase[0].steps[0]),
      ),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
    );

    renderWith(["/onboarding/a1"]);

    await waitFor(() => expect(pressed("List")).toBe("true"));
  });

  it("opens the list for a question focus and for a phase choice", async () => {
    rememberGraph();
    servePath(onePhase);

    renderWith([{ pathname: "/onboarding", state: { focusQuestionId: "nope" } }]);
    await waitFor(() => expect(pressed("List")).toBe("true"));
  });

  it("opens the list when sent to choose a phase", async () => {
    rememberGraph();
    servePath(onePhase);

    renderWith([{ pathname: "/onboarding", state: { choosePhase: true } }]);

    await waitFor(() => expect(pressed("List")).toBe("true"));
  });

  it("opens the graph for a hire with no account id and nothing remembered", async () => {
    signedInUserId.value = "";
    servePath(onePhase);

    renderWith(["/onboarding"]);

    await waitFor(() => expect(pressed("Graph")).toBe("true"));
    signedInUserId.value = "user1";
  });
});

describe("OnBoardingPage: keeping the path current", () => {
  it("says so when the path could not be refreshed after the buddy changed it", async () => {
    servePath(onePhase);
    renderWith(["/onboarding"]);
    await waitFor(() => expect(document.getElementById("phase-title")).toBeInTheDocument());

    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 500 })),
    );
    act(() => announceBuddyPathChanged());

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Your path could not be refreshed", {
        description: "What you did is saved. Reload the page to see it.",
      }),
    );
    expect(document.getElementById("phase-title")).toBeInTheDocument();
  });

  it("stops listening to the buddy once the page is gone", async () => {
    let reads = 0;
    server.use(
      http.get("/api/v1/onboarding/me/path", () => {
        reads += 1;
        return HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: onePhase,
        });
      }),
    );
    const { unmount } = renderWith(["/onboarding"]);
    await waitFor(() => expect(document.getElementById("phase-title")).toBeInTheDocument());
    unmount();
    const before = reads;

    act(() => announceBuddyPathChanged());
    await act(() => Promise.resolve());

    expect(reads).toBe(before);
  });

  it("reads the new path when a generation finishes, and clears the generation", async () => {
    servePath(onePhase);
    const clearGeneration = vi.fn();

    renderWith(["/onboarding"], { generation: { status: "done", path: null }, clearGeneration });

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    await waitFor(() => expect(clearGeneration).toHaveBeenCalled());
  });

  it("clears a finished generation even when the new path could not be read", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 500 })),
    );
    const clearGeneration = vi.fn();

    renderWith(["/onboarding"], { generation: { status: "done", path: null }, clearGeneration });

    await waitFor(() => expect(clearGeneration).toHaveBeenCalled());
    expect(console.error).toHaveBeenCalledWith(
      "Failed to load the new onboarding path:",
      expect.anything(),
    );
  });
});

describe("OnBoardingPage: a rebuild that failed beside an existing path", () => {
  it("says it once with the reason, keeps the path and clears the failure", async () => {
    servePath(onePhase);
    const clearGeneration = vi.fn();

    renderWith(["/onboarding"], {
      generation: { status: "error", message: "The model fell over." },
      clearGeneration,
    });

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Your path could not be rebuilt", {
        description: "The model fell over. Your current path is unchanged.",
      }),
    );
    expect(clearGeneration).toHaveBeenCalledTimes(1);
    expect(document.getElementById("phase-title")).toHaveTextContent("Alpha");
  });

  it("explains a thin knowledge base instead of echoing the raw message", async () => {
    servePath(onePhase);

    renderWith(["/onboarding"], {
      generation: { status: "error", message: "raw", reason: "not-enough-knowledge" },
    });

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Your path could not be rebuilt", {
        description:
          "The project's knowledge base does not cover any phase yet. Your current path is unchanged.",
      }),
    );
  });

  it("stays quiet while there is no path yet", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })),
    );

    renderWith(["/onboarding"], { generation: { status: "error", message: "nothing" } });

    await screen.findByRole("alert");
    expect(toastMocks.error).not.toHaveBeenCalled();
  });
});

describe("OnBoardingPage: when the path cannot be loaded", () => {
  it("shows the reason it gave and reloads on 'Try again'", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({ message: "The path service is down" }, { status: 500 }),
      ),
    );

    renderWith(["/onboarding"]);

    expect(await screen.findByText("Onboarding could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
