import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
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
        <LocationDisplay />
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

const twoPhases = [
  phase("p1", 1, "Alpha", {
    steps: [step("a1", "p1", 1, "IN_PROGRESS", { title: "Working" })],
  }),
  phase("p2", 2, "Beta", {
    steps: [step("b1", "p2", 1, "WAITING", { title: "Later" })],
    questions: [
      {
        id: "q1",
        phaseId: "p2",
        position: 2,
        type: "SHORT_TEXT",
        question: "Why?",
        status: "OPEN",
        title: "Why",
      },
    ],
  }),
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

const where = () => screen.getByTestId("where").textContent;
const titleNow = () => document.getElementById("phase-title")?.textContent;
const card = (id: string) => document.getElementById(`onboarding-item-${id}`);

function stubScroll() {
  const scroll = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = scroll;
  return scroll;
}

describe("OnBoardingPage: a link from the buddy", () => {
  it("lands on a phase by name and takes the link out of the address", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?phase=p2"]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await waitFor(() => expect(where()).toBe("/onboarding"));
    expect(pressed("List")).toBe("true");
  });

  it("says so, once, when the phase is not on the path", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?phase=gone"]);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("That phase is not on your path", {
        description: "It may have been replaced when your path was rebuilt.",
      }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(where()).toBe("/onboarding"));
    expect(titleNow()).toBe("Alpha");
  });

  it("lands on a step, lights its card and scrolls to it, without unfolding it", async () => {
    const scroll = stubScroll();
    servePath(twoPhases);

    renderWith(["/onboarding?step=b1"]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await waitFor(() => expect(card("b1")?.className).toContain("app-link-highlight"));
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }),
    );
    expect(
      document
        .querySelector('[data-item-id="b1"] button[aria-expanded]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("unfolds the step when the link asks for it open", async () => {
    servePath(twoPhases);
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () =>
        HttpResponse.json(twoPhases[1].steps[0]),
      ),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
    );

    renderWith(["/onboarding?step=b1&open=1"]);

    await waitFor(() =>
      expect(
        document
          .querySelector('[data-item-id="b1"] button[aria-expanded]')
          ?.getAttribute("aria-expanded"),
      ).toBe("true"),
    );
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("lands on a question in its phase and lights it", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?question=q1"]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await waitFor(() => expect(card("q1")?.className).toContain("app-link-highlight"));
  });

  it("names a step that is not on the path, and goes back to the plain address", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?step=gone"]);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("That step is not on your path", {
        description: "It may have been replaced when your path was rebuilt.",
      }),
    );
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("names a question that is not on the path", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?question=gone"]);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("That question is not on your path", {
        description: "It may have been replaced when your path was rebuilt.",
      }),
    );
  });

  it("does not follow the same link twice on one visit", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding?phase=gone"]);

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledTimes(1));
    await act(() => Promise.resolve());
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });
});

describe("OnBoardingPage: arriving for a step, a question or the chooser", () => {
  it("unfolds a step by its address, starts it and scrolls to it", async () => {
    const scroll = stubScroll();
    const started = vi.fn();
    servePath(twoPhases);
    server.use(
      http.get("/api/v1/onboarding/me/steps/:stepId", () =>
        HttpResponse.json(twoPhases[1].steps[0]),
      ),
      http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
      http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
      http.put("/api/v1/onboarding/me/steps/:stepId/start", ({ params }) => {
        started(params.stepId);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWith(["/onboarding/b1"]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await waitFor(() => expect(started).toHaveBeenCalledWith("b1"));
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }),
    );
  });

  it("names a step address that is not on the path and returns to the plain address", async () => {
    servePath(twoPhases);

    renderWith(["/onboarding/gone"]);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("That step is not on your path", {
        description: "It may have been replaced when your path was rebuilt.",
      }),
    );
    await waitFor(() => expect(where()).toBe("/onboarding"));
  });

  it("names a question focus that is not on the path", async () => {
    servePath(twoPhases);

    renderWith([{ pathname: "/onboarding", state: { focusQuestionId: "gone" } }]);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("That question is not on your path", {
        description: "It may have been replaced when your path was rebuilt.",
      }),
    );
  });

  it("unfolds a question it was sent for, in its phase", async () => {
    servePath(twoPhases);

    renderWith([{ pathname: "/onboarding", state: { focusQuestionId: "q1" } }]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-item-id="q1"] button[aria-expanded]')
          ?.getAttribute("aria-expanded"),
      ).toBe("true"),
    );
  });

  it("brings the phase chooser into view after the panel has slid in", async () => {
    const scroll = stubScroll();
    const three = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED")] }),
      phase("p2", 2, "Beta", { steps: [step("b1", "p2", 1, "WAITING")] }),
      phase("p3", 3, "Gamma", { steps: [step("g1", "p3", 1, "WAITING")] }),
    ];
    servePath(three);

    renderWith([{ pathname: "/onboarding", state: { choosePhase: true } }]);

    await waitFor(() => expect(document.getElementById("phase-chooser")).toBeInTheDocument());
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }),
    );
  });
});

describe("OnBoardingPage: remembering the view", () => {
  const remembered = () =>
    JSON.parse(localStorage.getItem(hireJourneyViewKey(signedInUserId.value)) ?? "{}") as {
      mode?: string;
    };

  it("does not write a list it was only sent to over a remembered graph", async () => {
    rememberGraph();
    servePath(twoPhases);

    renderWith(["/onboarding?phase=p2"]);

    await waitFor(() => expect(titleNow()).toBe("Beta"));
    await act(() => Promise.resolve());
    expect(remembered().mode).toBe("graph");
  });

  it("writes the view the hire chose", async () => {
    rememberGraph();
    servePath(twoPhases);
    const user = userEvent.setup();

    renderWith(["/onboarding"]);
    await waitFor(() => expect(pressed("Graph")).toBe("true"));
    await user.click(screen.getByRole("button", { name: "List" }));

    await waitFor(() => expect(remembered().mode).toBe("list"));
    await user.click(screen.getByRole("button", { name: "Graph" }));
    await waitFor(() => expect(remembered().mode).toBe("graph"));
  });
});
