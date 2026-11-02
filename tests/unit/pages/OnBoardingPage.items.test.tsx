import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

type Step = ReturnType<typeof step>;
type StepStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "SKIPPED";
type QuestionStatus = "OPEN" | "RETRY" | "PASSED" | "LOCKED";

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

function question(id: string, phaseId: string, position: number, status: QuestionStatus) {
  return {
    id,
    phaseId,
    position,
    type: "TEXT",
    question: `Question ${id}?`,
    status,
    title: `Question ${id}`,
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

/** The step and tasks the workspaces read when a row is unfolded. */
function serveSteps(phases: { steps: { id: string }[] }[]) {
  const all = phases.flatMap((candidate) => candidate.steps);
  server.use(
    http.get("/api/v1/onboarding/me/steps/:stepId", ({ params }) =>
      HttpResponse.json(all.find((candidate) => candidate.id === params.stepId)),
    ),
    http.get("/api/v1/onboarding/me/steps/:stepId/tasks", () => HttpResponse.json([])),
    http.get("/api/v1/onboarding/me/steps/:stepId/resources", () => HttpResponse.json([])),
  );
}

/** The page opened on a phase by name, the way a link into it does. */
function renderOnPhase(openPhaseId: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/", state: { openPhaseId } }]}>
      <OnboardingJourneyContext.Provider value={journeyValue()}>
        <OnBoardingPage />
      </OnboardingJourneyContext.Provider>
    </MemoryRouter>,
  );
}

function row(name: RegExp) {
  return screen.getByRole("button", { name, expanded: false });
}

function rowIsOpen(itemId: string) {
  return document
    .querySelector(`[data-item-id="${itemId}"] button[aria-expanded]`)
    ?.getAttribute("aria-expanded");
}

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
});

describe("OnBoardingPage: what 'continue' says and does", () => {
  async function openDoneStep(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(await waitFor(() => row(name)));
    return screen.findByRole("button", { name: /Next|On to|Choose|Back to/ });
  }

  it("offers the next step of the same phase, and opens it", async () => {
    const phases = [
      phase("p1", 1, "Alpha", {
        steps: [
          step("a1", "p1", 1, "FINISHED", { title: "Done one" }),
          step("a2", "p1", 2, "WAITING", { title: "Fresh one" }),
        ],
      }),
    ];
    servePath(phases);
    serveSteps(phases);
    server.use(
      http.put(
        "/api/v1/onboarding/me/steps/:stepId/start",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const user = userEvent.setup();

    renderPage();
    const next = await openDoneStep(user, /Done one/);

    expect(next).toHaveTextContent("Next step");
    await user.click(next);

    await waitFor(() => expect(rowIsOpen("a2")).toBe("true"));
    expect(rowIsOpen("a1")).toBe("false");
  });

  it("offers a question of the same phase as 'Next: a question'", async () => {
    const phases = [
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED", { title: "Done one" })],
        questions: [question("q1", "p1", 2, "OPEN")],
      }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderPage();
    const next = await openDoneStep(user, /Done one/);

    expect(next).toHaveTextContent("Next: a question");
    await user.click(next);
    await waitFor(() => expect(rowIsOpen("q1")).toBe("true"));
  });

  it("offers the phase that is up next when this one is finished", async () => {
    const phases = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED", { title: "Done one" })] }),
      phase("p2", 2, "Beta", {
        blockerIds: ["p1"],
        steps: [step("b1", "p2", 1, "IN_PROGRESS", { title: "Beta work" })],
      }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderOnPhase("p1");
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    const next = await openDoneStep(user, /Done one/);

    expect(next).toHaveTextContent("On to Beta");
    await user.click(next);

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Beta"));
    await waitFor(() => expect(rowIsOpen("b1")).toBe("true"));
  });

  it("sends the hire to the chooser when finishing a phase opens several", async () => {
    const phases = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED", { title: "Done one" })] }),
      phase("p2", 2, "Beta", { steps: [step("b1", "p2", 1, "WAITING")] }),
      phase("p3", 3, "Gamma", { steps: [step("g1", "p3", 1, "WAITING")] }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderOnPhase("p1");
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    const next = await openDoneStep(user, /Done one/);

    expect(next).toHaveTextContent("Choose your next phase");
    await user.click(next);

    await waitFor(() => expect(rowIsOpen("a1")).toBe("false"));
    expect(document.getElementById("phase-chooser")).toBeInTheDocument();
  });

  it("closes the item when there is nothing left to do", async () => {
    const phases = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED", { title: "Done one" })] }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderPage();
    const next = await openDoneStep(user, /Done one/);

    expect(next).toHaveTextContent("Back to your path");
    await user.click(next);
    await waitFor(() => expect(rowIsOpen("a1")).toBe("false"));
  });

  it("says a passed question was answered and continues from it", async () => {
    const phases = [
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "WAITING", { title: "Fresh one" })],
        questions: [question("q1", "p1", 2, "PASSED")],
      }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderPage();
    await user.click(await waitFor(() => row(/Question q1/)));

    expect(await screen.findByText("You answered this one correctly.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next step" }));
    await waitFor(() => expect(rowIsOpen("a1")).toBe("true"));
  });
});

describe("OnBoardingPage: answering a question", () => {
  function serveAttempt(result: { correct: boolean; onboardingCompleted?: boolean }) {
    server.use(
      http.post("/api/v1/onboarding/me/questions/:questionId/attempts", () =>
        HttpResponse.json({
          attemptId: "att1",
          questionId: "q1",
          createdAt: new Date().toISOString(),
          correctOptionIds: [],
          correctAnswer: "42",
          explanation: null,
          feedback: null,
          status: result.correct ? "PASSED" : "RETRY",
          onboardingCompleted: false,
          ...result,
        }),
      ),
    );
  }

  async function answer(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await waitFor(() => row(/Question q1/)));
    await user.type(await screen.findByPlaceholderText("Your answer..."), "forty-two");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
  }

  function shortQuestion(status: QuestionStatus) {
    return { ...question("q1", "p1", 2, status), type: "SHORT_TEXT" };
  }

  it("celebrates the phase when the answer finishes its last open item", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [shortQuestion("OPEN")],
      }),
    ]);
    serveAttempt({ correct: true });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    await waitFor(() => expect(momentMocks.celebrate).toHaveBeenCalledTimes(1));
    expect(momentMocks.celebrate).toHaveBeenCalledWith({
      tone: "milestone",
      title: "Phase completed",
      message: "You completed the Alpha phase.",
      progress: { current: 1, total: 1 },
    });
    expect(momentMocks.completeMission).not.toHaveBeenCalled();
  });

  it("does not celebrate while a step of the phase is still open", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "IN_PROGRESS")],
        questions: [shortQuestion("OPEN")],
      }),
    ]);
    serveAttempt({ correct: true });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    expect(await screen.findByText(/Correct — nice work!/)).toBeInTheDocument();
    expect(momentMocks.celebrate).not.toHaveBeenCalled();
  });

  it("does not celebrate while another question of the phase is still open", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [shortQuestion("OPEN"), question("q2", "p1", 3, "OPEN")],
      }),
    ]);
    serveAttempt({ correct: true });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    expect(await screen.findByText(/Correct — nice work!/)).toBeInTheDocument();
    expect(momentMocks.celebrate).not.toHaveBeenCalled();
  });

  it("does not celebrate a wrong answer", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [shortQuestion("OPEN")],
      }),
    ]);
    serveAttempt({ correct: false });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    expect(await screen.findByText(/Not quite/)).toBeInTheDocument();
    expect(momentMocks.celebrate).not.toHaveBeenCalled();
    expect(momentMocks.completeMission).not.toHaveBeenCalled();
  });

  it("completes the mission, not the phase, when the answer finishes the whole onboarding", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [shortQuestion("OPEN")],
      }),
    ]);
    serveAttempt({ correct: true, onboardingCompleted: true });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    await waitFor(() => expect(momentMocks.completeMission).toHaveBeenCalledTimes(1));
    expect(momentMocks.celebrate).not.toHaveBeenCalled();
    expect(await screen.findByText("You have finished your onboarding!")).toBeInTheDocument();
  });

  it("counts the finished phases when celebrating the second one", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED")] }),
      phase("p2", 2, "Beta", {
        steps: [step("b1", "p2", 1, "FINISHED")],
        questions: [{ ...question("q1", "p2", 2, "OPEN"), type: "SHORT_TEXT" }],
      }),
    ]);
    serveAttempt({ correct: true });
    const user = userEvent.setup();

    renderPage();
    await answer(user);

    await waitFor(() => expect(momentMocks.celebrate).toHaveBeenCalledTimes(1));
    expect(momentMocks.celebrate).toHaveBeenCalledWith(
      expect.objectContaining({ progress: { current: 2, total: 2 } }),
    );
  });
});

describe("OnBoardingPage: starting a step", () => {
  it("sends the rocket and re-reads the path when a waiting step is started", async () => {
    const phases = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "WAITING", { title: "Fresh one" })] }),
    ];
    let reads = 0;
    server.use(
      http.get("/api/v1/onboarding/me/path", () => {
        reads += 1;
        return HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases,
        });
      }),
      http.put(
        "/api/v1/onboarding/me/steps/:stepId/start",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    serveSteps(phases);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Start now" }));

    await waitFor(() => expect(momentMocks.flyby).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("tells the hire when the step could not be started", async () => {
    const phases = [
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "WAITING", { title: "Fresh one" })] }),
    ];
    servePath(phases);
    serveSteps(phases);
    server.use(
      http.put(
        "/api/v1/onboarding/me/steps/:stepId/start",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Start now" }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "The step could not be started",
        expect.anything(),
      ),
    );
    expect(momentMocks.flyby).not.toHaveBeenCalled();
  });

  it("does not start a step that is already in progress", async () => {
    const started = vi.fn();
    server.use(
      http.put("/api/v1/onboarding/me/steps/:stepId/start", ({ params }) => {
        started(params.stepId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const phases = [
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "IN_PROGRESS", { title: "Running" })],
      }),
    ];
    servePath(phases);
    serveSteps(phases);
    const user = userEvent.setup();

    renderPage();
    await user.click(await waitFor(() => row(/Running/)));

    await waitFor(() => expect(rowIsOpen("a1")).toBe("true"));
    expect(started).not.toHaveBeenCalled();
  });
});

describe("OnBoardingPage: an answered skip request", () => {
  it("puts the 'new answer' back and says so when it could not be marked as seen", async () => {
    const skipped = step("a1", "p1", 1, "SKIPPED", {
      title: "Skipped one",
      skip: {
        id: "skip1",
        stepId: "a1",
        reason: "Did this last week",
        accepted: true,
        reviewComment: "Makes sense",
        reviewedAt: "2026-09-18T10:00:00Z",
        answerSeenAt: null,
      },
    });
    const phases = [phase("p1", 1, "Alpha", { steps: [skipped] })];
    servePath(phases);
    serveSteps(phases);
    server.use(
      http.post(
        "/api/v1/onboarding/me/skips/:skipId/seen",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    renderPage();
    expect(await screen.findByText(/new answer from your project manager/)).toBeInTheDocument();
    await user.click(row(/Skipped one/));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("The answer is still marked new", {
        description: "It could not be marked as seen. It will still be there next time.",
      }),
    );
    expect(await screen.findByText(/new answer from your project manager/)).toBeInTheDocument();
  });
});
