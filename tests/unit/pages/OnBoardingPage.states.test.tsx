import { render, screen, waitFor, within } from "@testing-library/react";
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
  extra: { steps?: unknown[]; questions?: unknown[]; [key: string]: unknown } = {},
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

function serveNoPath() {
  server.use(http.get("/api/v1/onboarding/me/path", () => new HttpResponse(null, { status: 404 })));
}

/** The selected phase's header card: the block around the phase title. */
function headerCard() {
  const card = document.getElementById("phase-title")?.parentElement;
  if (!card) throw new Error("no phase header on screen");
  return card;
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

describe("OnBoardingPage: no path yet", () => {
  beforeEach(serveNoPath);

  it("tells a hire with no project and no switcher to ask for access", async () => {
    projectContextState.selectedProjectId = "";
    projectContextState.isSwitcherEnabled = false;

    renderPage();

    expect(await screen.findByText("No project selected")).toBeInTheDocument();
    expect(screen.getByText(/You need to be assigned to a project/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Select a project from the project switcher/),
    ).not.toBeInTheDocument();
  });

  it("treats an unavailable 'no-project' like having no project, even with one selected", async () => {
    renderPage({ availability: "unavailable", unavailableReason: "no-project" });

    expect(await screen.findByText("No project selected")).toBeInTheDocument();
    expect(screen.getByText(/Select a project from the project switcher/)).toBeInTheDocument();
  });

  it.each([
    {
      reason: "no-blueprint" as const,
      title: "Onboarding isn't set up for this project yet",
      body: /doesn't have one/,
      link: "Open blueprints",
      href: "/blueprints",
    },
    {
      reason: "several-blueprints" as const,
      title: "This project has more than one onboarding blueprint",
      body: /this project has several/,
      link: "Open blueprints",
      href: "/blueprints",
    },
    {
      reason: "no-content" as const,
      title: "There's nothing to learn from yet",
      body: /nothing has been added to it yet/,
      link: "Add knowledge",
      href: "/data-ingestion",
    },
  ])(
    "explains $reason and sends a manager to the fix",
    async ({ reason, title, body, link, href }) => {
      projectContextState.canManageSelected = true;

      renderPage({ availability: "unavailable", unavailableReason: reason });

      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", href);
      expect(screen.queryByText(/Your project manager can set this up/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Start personalization" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["no-blueprint", "several-blueprints", "no-content"] as const)(
    "points a member at their manager for %s instead of a link",
    async (reason) => {
      renderPage({ availability: "unavailable", unavailableReason: reason });

      expect(await screen.findByText(/Your project manager can set this up/)).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );

  it("says the knowledge is not enough yet, and lets a member check again", async () => {
    const user = userEvent.setup();
    const startGeneration = vi.fn();

    renderPage({
      startGeneration,
      generation: { status: "error", message: "empty", reason: "not-enough-knowledge" },
    });

    expect(
      await screen.findByRole("heading", { name: "Not enough project knowledge yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/give it a few minutes/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add knowledge" })).not.toBeInTheDocument();
    expect(screen.getByText(/Your project manager can add documentation/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(startGeneration).toHaveBeenCalledWith("proj1");
  });

  it("offers a manager the knowledge base beside checking again", async () => {
    projectContextState.canManageSelected = true;

    renderPage({
      generation: { status: "error", message: "empty", reason: "not-enough-knowledge" },
    });

    expect(await screen.findByRole("link", { name: "Add knowledge" })).toHaveAttribute(
      "href",
      "/data-ingestion",
    );
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
    expect(
      screen.queryByText(/Your project manager can add documentation/),
    ).not.toBeInTheDocument();
  });

  it("says the blueprint has nothing for the hire's role, with no button to press", async () => {
    renderPage({ generation: { status: "error", message: "none", reason: "no-phases" } });

    expect(
      await screen.findByRole("heading", { name: "The blueprint has nothing for your role yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/meant for other roles or skills/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says the service is unreachable and hides the raw error", async () => {
    renderPage({
      generation: { status: "error", message: "ECONNRESET", reason: "ai-unavailable" },
    });

    expect(
      await screen.findByRole("heading", { name: "The onboarding service is not reachable" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the AI service did not answer/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("ECONNRESET")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("invites a first build with the plain heading and no alert", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Build your onboarding path" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/It takes a few minutes and keeps running/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start personalization" })).toBeEnabled();
  });

  it("shows the last generation's error with a 'Try again' that starts again", async () => {
    const user = userEvent.setup();
    const startGeneration = vi.fn();

    renderPage({ startGeneration, generation: { status: "error", message: "It broke" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("It broke");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(startGeneration).toHaveBeenCalledWith("proj1");
  });

  it("disables the button and says so while it works out whether a start could succeed", async () => {
    renderPage({ availability: "loading" });

    const button = await screen.findByRole("button", { name: /Checking the project/ });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Start personalization" })).not.toBeInTheDocument();
  });
});

describe("OnBoardingPage: the phase header", () => {
  it("numbers the phase, shows its description and progress, and marks where the hire is", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED")] }),
      phase("p2", 2, "Beta", {
        description: "Beta in words",
        steps: [step("b1", "p2", 1, "FINISHED"), step("b2", "p2", 2, "IN_PROGRESS")],
        questions: [question("bq", "p2", 3, "OPEN")],
      }),
    ]);

    renderPage();

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Beta"));
    const card = within(headerCard());
    expect(headerCard().querySelector("p")?.textContent).toBe("Phase 2 of 2 · You are here");
    expect(card.getByText("Beta in words")).toBeInTheDocument();
    expect(card.getByText("1/3 done")).toBeInTheDocument();
    expect(card.queryByText("Phase complete.")).not.toBeInTheDocument();
  });

  it("leaves out the 'You are here' mark and the description when there are none", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] }),
      phase("p2", 2, "Beta", { steps: [step("b1", "p2", 1, "WAITING")] }),
    ]);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Beta/ }));

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Beta"));
    expect(headerCard().querySelector("p")?.textContent).toBe("Phase 2 of 2");
    expect(headerCard().querySelector("p.max-w-3xl")).toBeNull();
  });

  it("says a finished phase is complete", async () => {
    servePath([phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "FINISHED")] })]);

    renderPage();

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    expect(within(headerCard()).getByText("Phase complete.")).toBeInTheDocument();
    expect(within(headerCard()).getByText("1/1 done")).toBeInTheDocument();
    expect(headerCard().querySelector("p")?.textContent).toBe("Phase 1 of 1");
  });

  it("names the one phase a locked phase waits on, and the two it waits on", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] }),
      phase("p2", 2, "Beta", { steps: [step("b1", "p2", 1, "IN_PROGRESS")] }),
      phase("p3", 3, "Gamma", {
        locked: true,
        blockerIds: ["p1"],
        steps: [step("g1", "p3", 1, "WAITING")],
      }),
      phase("p4", 4, "Delta", {
        locked: true,
        blockerIds: ["p1", "p2"],
        steps: [step("d1", "p4", 1, "WAITING")],
      }),
    ]);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(document.getElementById("phase-title")).toBeInTheDocument());

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Gamma/ }));
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Gamma"));
    expect(
      within(headerCard()).getByText(
        /Opens once Alpha is complete\. You can look around already\./,
      ),
    ).toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Delta/ }));
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Delta"));
    expect(
      within(headerCard()).getByText(
        /Opens once Alpha and Beta are complete\. You can look around already\./,
      ),
    ).toBeInTheDocument();
  });

  it("links to the phases it waits on and the ones it leads to, and follows a link", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] }),
      phase("p2", 2, "Beta", {
        locked: true,
        blockerIds: ["p1"],
        steps: [step("b1", "p2", 1, "WAITING")],
      }),
      phase("p3", 3, "Gamma", {
        locked: true,
        blockerIds: ["p2"],
        steps: [step("g1", "p3", 1, "WAITING")],
      }),
    ]);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    expect(within(headerCard()).queryByText("Waits on")).not.toBeInTheDocument();
    expect(within(headerCard()).getByText("Leads to")).toBeInTheDocument();

    await user.click(within(headerCard()).getByRole("button", { name: /Beta/ }));
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Beta"));
    const card = within(headerCard());
    expect(card.getByText("Waits on")).toBeInTheDocument();
    expect(card.getByText("Leads to")).toBeInTheDocument();
    expect(card.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(card.getByRole("button", { name: /Gamma/ })).toBeInTheDocument();
  });

  it("shows no links for a phase that stands alone", async () => {
    servePath([phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] })]);

    renderPage();
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));

    expect(within(headerCard()).queryByText("Waits on")).not.toBeInTheDocument();
    expect(within(headerCard()).queryByText("Leads to")).not.toBeInTheDocument();
  });

  it("offers the buddy as the way into a phase with content", async () => {
    servePath([phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] })]);

    renderPage();

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    expect(
      within(headerCard()).getByRole("button", { name: "Ask your buddy about this phase" }),
    ).toBeInTheDocument();
  });

  it("offers a different way in for an empty phase", async () => {
    servePath([phase("p1", 1, "Alpha")]);

    renderPage();

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    expect(
      within(headerCard()).getByRole("button", {
        name: "This phase is empty — talk it through with your buddy",
      }),
    ).toBeInTheDocument();
    expect(within(headerCard()).getByText("0/0 done")).toBeInTheDocument();
  });
});

describe("OnBoardingPage: up next", () => {
  function upNext() {
    const heading = screen.getAllByRole("heading", { level: 2 })[0];
    const card = heading.closest("div.relative.overflow-hidden");
    if (!card) throw new Error("no up-next card on screen");
    return within(card as HTMLElement);
  }

  it("offers a waiting step as 'Up next' with its description and 'Start now'", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [
          step("a1", "p1", 1, "WAITING", { title: "Read the readme", description: "Skim it" }),
        ],
      }),
    ]);

    renderPage();

    await waitFor(() => expect(upNext().getByText("Read the readme")).toBeInTheDocument());
    expect(upNext().getByText("Skim it")).toBeInTheDocument();
    expect(upNext().getByText(/Up next/)).toBeInTheDocument();
    expect(upNext().getByRole("button", { name: "Start now" })).toBeInTheDocument();
    expect(upNext().getByRole("button", { name: /Phase 1: Alpha/ })).toBeInTheDocument();
  });

  it("says 'In progress' with 'Continue' for the step the hire left open", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "IN_PROGRESS", { title: "Half done" })],
      }),
    ]);

    renderPage();

    await waitFor(() => expect(upNext().getByText("Half done")).toBeInTheDocument());
    expect(upNext().getByText(/In progress/)).toBeInTheDocument();
    expect(upNext().getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("leaves the description out for a step that has none", async () => {
    servePath([phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "WAITING")] })]);

    renderPage();

    await waitFor(() => expect(upNext().getByText("Step a1")).toBeInTheDocument());
    expect(document.querySelector("p.line-clamp-2")).toBeNull();
  });

  it("asks an open question as a 'Knowledge question' with 'Answer now'", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [question("q1", "p1", 2, "OPEN")],
      }),
    ]);

    renderPage();

    await waitFor(() => expect(upNext().getByText("Question q1?")).toBeInTheDocument());
    expect(upNext().getByText(/Knowledge question/)).toBeInTheDocument();
    expect(
      upNext().getByText("Answer this question to move on in your onboarding."),
    ).toBeInTheDocument();
    expect(upNext().getByRole("button", { name: "Answer now" })).toBeInTheDocument();
  });

  it("tells a hire who got a question wrong to answer it correctly, and offers 'Try again'", async () => {
    servePath([
      phase("p1", 1, "Alpha", {
        steps: [step("a1", "p1", 1, "FINISHED")],
        questions: [question("q1", "p1", 2, "RETRY")],
      }),
    ]);

    renderPage();

    await waitFor(() =>
      expect(
        upNext().getByText("You got this one wrong before — answer it correctly to move on."),
      ).toBeInTheDocument(),
    );
    expect(upNext().getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("takes the hire to the phase when its name is clicked", async () => {
    servePath([
      phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "IN_PROGRESS")] }),
      phase("p2", 2, "Beta", { steps: [step("b1", "p2", 1, "WAITING")] }),
    ]);
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Beta/ }));
    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Beta"));

    await user.click(upNext().getByRole("button", { name: /Phase 1: Alpha/ }));

    await waitFor(() => expect(document.getElementById("phase-title")).toHaveTextContent("Alpha"));
  });

  it("starts the step when 'Start now' is pressed", async () => {
    const startStep = vi.fn();
    server.use(
      http.put("/api/v1/onboarding/me/steps/:stepId/start", ({ params }) => {
        startStep(params.stepId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    servePath([phase("p1", 1, "Alpha", { steps: [step("a1", "p1", 1, "WAITING")] })]);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Start now" }));

    await waitFor(() => expect(startStep).toHaveBeenCalledWith("a1"));
  });
});
