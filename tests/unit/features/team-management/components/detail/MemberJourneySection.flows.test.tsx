import { createRef } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../../src/context/ToastProvider";
import { onboardingGraphService } from "../../../../../../src/services/onboardingGraphService";
import {
  MemberJourneySection,
  type MemberJourneyHandle,
} from "../../../../../../src/features/team-management/components/detail/MemberJourneySection";
import { phaseProgress } from "../../../../../../src/features/onboarding/journey";
import { resolveNextAction } from "../../../../../../src/features/onboarding/nextAction";
import { memberJourneyViewKey } from "../../../../../../src/features/onboarding/journeyViewMemory";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../../../../../../src/features/onboarding/types";

vi.mock("../../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "pm-1" } }),
}));

vi.mock("../../../../../../src/services/onboardingGraphService", () => ({
  onboardingGraphService: {
    createConnectedStep: vi.fn(),
    replaceNodeBlockers: vi.fn(),
    replacePhaseBlockers: vi.fn(),
    arrangePhase: vi.fn(),
    arrangeUserPath: vi.fn(),
  },
}));

const spies = vi.hoisted(() => ({ lastPhases: [] as unknown[] }));

vi.mock("../../../../../../src/features/onboarding/components/journey/JourneyGraph", () => ({
  JourneyGraph: (props: {
    phases: { id: string; steps: { id: string }[]; questions?: { id: string }[] }[];
    openPhaseId: string | null;
    focusPhaseId: string | null;
    nextItemId?: string | null;
    selectedItemId: string | null;
    onOpenPhaseChange: (id: string | null) => void;
    onSelectItem: (id: string | null) => void;
    onOpenItem: (item: unknown) => void;
    renderItemAside: (item: unknown, phase: unknown) => React.ReactNode;
    saveLayout: {
      phase: (id: string, nodes: unknown[]) => Promise<void>;
      path: (nodes: unknown[]) => Promise<void>;
    };
    editing: {
      connectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
      disconnectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
      connectPhases: (blockerId: string, phaseId: string) => Promise<void>;
      disconnectPhases: (blockerId: string, phaseId: string) => Promise<void>;
      addStep: (phaseId: string, point: { x: number; y: number }) => Promise<void>;
    };
  }) => {
    spies.lastPhases = props.phases;
    const first = props.phases[0];
    const items = [
      ...first.steps.map((s) => ({ kind: "step", id: s.id, step: s, blockerIds: [] })),
      ...(first.questions ?? []).map((q) => ({
        kind: "question",
        id: q.id,
        question: q,
        blockerIds: [],
      })),
    ];
    const find = (id: string) => items.find((entry) => entry.id === id);
    return (
      <div data-testid="graph">
        <p>
          graph open={props.openPhaseId ?? "map"} focus={props.focusPhaseId ?? "none"} next=
          {props.nextItemId ?? "none"} selected={props.selectedItemId ?? "none"}
        </p>
        <button onClick={() => props.onOpenPhaseChange("phase2")}>Open phase2</button>
        <button onClick={() => props.onOpenPhaseChange(null)}>Back to the map</button>
        <button onClick={() => props.onSelectItem("run")}>Select run</button>
        <button onClick={() => props.onSelectItem("new-step")}>Select new step</button>
        <button onClick={() => props.onSelectItem(null)}>Select nothing</button>
        <button onClick={() => props.onOpenItem(find("run"))}>Open step item</button>
        <button onClick={() => props.onOpenItem(find("q1"))}>Open question item</button>
        <button onClick={() => void props.editing.connectItems("phase1", "clone", "verify")}>
          Connect clone to verify
        </button>
        <button onClick={() => void props.editing.connectItems("phase1", "run", "verify")}>
          Connect run to verify (already)
        </button>
        <button onClick={() => void props.editing.connectItems("phase1", "x", "ghost")}>
          Connect to a ghost
        </button>
        <button onClick={() => void props.editing.disconnectItems("phase1", "run", "verify")}>
          Disconnect run from verify
        </button>
        <button onClick={() => void props.editing.disconnectItems("phase1", "x", "ghost")}>
          Disconnect a ghost
        </button>
        <button onClick={() => void props.editing.connectPhases("phase1", "phase2")}>
          Connect phases
        </button>
        <button onClick={() => void props.editing.connectPhases("phase1", "ghost")}>
          Connect to a ghost phase
        </button>
        <button onClick={() => void props.editing.disconnectPhases("phase1", "phase2")}>
          Disconnect phases
        </button>
        <button onClick={() => void props.editing.addStep("phase1", { x: 10, y: 20 })}>
          Drop a step
        </button>
        <button onClick={() => void props.editing.addStep("ghost", { x: 1, y: 1 })}>
          Drop a step in a ghost phase
        </button>
        <button onClick={() => void props.saveLayout.phase("phase1", [{ id: "run" }])}>
          Save phase layout
        </button>
        <button onClick={() => void props.saveLayout.path([{ id: "phase1" }])}>
          Save path layout
        </button>
        {props.renderItemAside(find("run"), first)}
        {props.renderItemAside(find("q1"), first)}
      </div>
    );
  },
}));

vi.mock("../../../../../../src/features/onboarding/components/journey/ItemAside", () => ({
  ItemAside: (props: {
    item: { id: string };
    onClose: () => void;
    onSelect: (id: string) => void;
    actions: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid={`aside-${props.item.id}`}>
      <button onClick={props.onClose}>Close aside {props.item.id}</button>
      <button onClick={() => props.onSelect("clone")}>Select clone from {props.item.id}</button>
      {props.actions}
      {props.children}
    </div>
  ),
}));

vi.mock("../../../../../../src/features/onboarding/components/journey/PhaseNavigator", () => ({
  PhaseNavigator: (props: {
    phases: { id: string; title: string }[];
    selectedPhaseId: string;
    focusPhaseId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <nav>
      <p>
        nav selected={props.selectedPhaseId} focus={props.focusPhaseId ?? "none"}
      </p>
      {props.phases.map((phase) => (
        <button key={phase.id} onClick={() => props.onSelect(phase.id)}>
          Nav {phase.title}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock("../../../../../../src/features/team-management/components/detail/StepQuickEdit", () => ({
  StepQuickEdit: (props: {
    step: { id: string };
    startEditing?: boolean;
    onSaved: () => Promise<void>;
  }) => (
    <div>
      <p>
        quick edit {props.step.id} start={String(Boolean(props.startEditing))}
      </p>
      <button onClick={() => void props.onSaved()}>Save {props.step.id}</button>
    </div>
  ),
}));

vi.mock("../../../../../../src/features/team-management/components/detail/SkipReview", () => ({
  SkipReview: (props: {
    reason?: string;
    onReview: (action: "accept" | "deny", comment: string) => Promise<void>;
  }) => (
    <div>
      <p>skip review: {props.reason}</p>
      <button onClick={() => void props.onReview("accept", "fine")}>Accept the skip</button>
    </div>
  ),
}));

vi.mock("../../../../../../src/features/team-management/components/detail/FeedbackNote", () => ({
  FeedbackNote: (props: {
    feedback: { id: string; message: string };
    marking: boolean;
    onMarkRead?: (id: string) => void;
  }) => (
    <div>
      <p>
        feedback: {props.feedback.message} marking={String(props.marking)}
      </p>
      <button onClick={() => props.onMarkRead?.(props.feedback.id)}>
        Read {props.feedback.id}
      </button>
    </div>
  ),
}));

function step(over: Partial<OnboardingStepEndpoint>): OnboardingStepEndpoint {
  return {
    id: "s",
    phaseId: "phase1",
    position: 0,
    title: "Step",
    description: "",
    type: "TASK",
    estimatedMinutes: 30,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    blockerIds: [],
    ...over,
  };
}

const phase1 = {
  id: "phase1",
  pathId: "path1",
  position: 0,
  title: "Environment Setup",
  description: "Get the project running.",
  locked: false,
  blockerIds: [],
  steps: [
    step({
      id: "clone",
      title: "Clone the repository",
      status: "FINISHED",
      startedAt: "2026-01-01T10:00:00Z",
      completedAt: "2026-01-01T10:45:00Z",
    }),
    step({
      id: "run",
      position: 1,
      title: "Start the app",
      blockerIds: ["clone"],
      skip: { id: "skip1", reason: "Know it", accepted: null } as never,
    }),
    step({
      id: "verify",
      position: 2,
      title: "Verify it works",
      blockerIds: ["run"],
      locked: true,
    }),
  ],
  questions: [
    {
      id: "q1",
      phaseId: "phase1",
      position: 0,
      type: "MULTIPLE_CHOICE",
      question: "What is a hook?",
      status: "PASSED",
      blockerIds: ["clone"],
    },
    {
      id: "q2",
      phaseId: "phase1",
      position: 1,
      type: "SHORT_TEXT",
      question: "Why?",
      status: "UNANSWERED",
      blockerIds: ["clone"],
    },
  ],
} as unknown as OnboardingPhaseEndpoint;

const phase2 = {
  id: "phase2",
  pathId: "path1",
  position: 1,
  title: "Architecture",
  description: "",
  locked: true,
  blockerIds: ["phase1"],
  steps: [step({ id: "adr", phaseId: "phase2", title: "Read the ADRs" })],
  questions: [],
} as unknown as OnboardingPhaseEndpoint;

const emptyPhase = {
  id: "phase3",
  pathId: "path1",
  position: 2,
  title: "Empty",
  description: "",
  locked: false,
  blockerIds: [],
  steps: [],
  questions: [],
} as unknown as OnboardingPhaseEndpoint;

const path = {
  id: "path1",
  userId: "user1",
  createdAt: "",
  phases: [phase1, phase2, emptyPhase],
} as OnboardingPathEndpoint;

const feedback = [
  { id: "f1", stepId: "run", message: "too hard", read: false },
  { id: "f2", stepId: "clone", message: "fine", read: true },
];

type Props = Parameters<typeof MemberJourneySection>[0];

function renderSection(over: Partial<Props> = {}) {
  const props: Props = {
    userId: "user1",
    memberName: "Alice Smith",
    path,
    stepTaskCounts: { run: { done: 1, total: 3 } },
    onOpenStep: vi.fn(),
    onOpenQuestions: vi.fn(),
    onDeleteStep: vi.fn(),
    onReviewSkip: vi.fn().mockResolvedValue(undefined),
    feedbackItems: feedback,
    onMarkFeedbackRead: vi.fn(),
    onPathChanged: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const utils = render(<MemberJourneySection {...props} />, { wrapper: ToastProvider });
  return { props, ...utils };
}

function remember(mode: "list" | "graph", graphPhaseId: string | null = null) {
  localStorage.setItem(
    memberJourneyViewKey("pm-1", "user1"),
    JSON.stringify({ mode, graphPhaseId }),
  );
}

describe("MemberJourneySection flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(onboardingGraphService.createConnectedStep).mockResolvedValue({
      id: "new-step",
    } as never);
    vi.mocked(onboardingGraphService.replaceNodeBlockers).mockResolvedValue(undefined);
    vi.mocked(onboardingGraphService.replacePhaseBlockers).mockResolvedValue(undefined);
    vi.mocked(onboardingGraphService.arrangePhase).mockResolvedValue(undefined);
    vi.mocked(onboardingGraphService.arrangeUserPath).mockResolvedValue(undefined);
  });

  describe("the list", () => {
    beforeEach(() => remember("list"));

    it("opens on the phase the member is in and says so", () => {
      renderSection();

      expect(screen.getByText(/Phase 1 of 3/)).toBeInTheDocument();
      expect(screen.getByText(/Alice is here/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Environment Setup" })).toBeInTheDocument();
      expect(screen.getByText("Get the project running.")).toBeInTheDocument();
      expect(screen.getByText(/nav selected=phase1 focus=phase1/)).toBeInTheDocument();
    });

    it("shows the phase's progress and how many questions were passed", () => {
      renderSection();

      const progress = phaseProgress(phase1);
      expect(screen.getByText(`${progress.completed}/${progress.total} done`)).toBeInTheDocument();
      expect(screen.getByText("1/2 questions passed")).toBeInTheDocument();
    });

    it("says what a locked phase opens after, and that it has no questions", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Nav Architecture" }));

      expect(screen.getByText("Opens for Alice after Environment Setup")).toBeInTheDocument();
      expect(screen.getByText("No questions")).toBeInTheDocument();
      expect(screen.queryByText(/is here/)).not.toBeInTheDocument();
    });

    it("groups the items in stages, naming those that can be done in any order", () => {
      renderSection();

      expect(screen.getByRole("region", { name: "Stage 1" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Stage 2" })).toBeInTheDocument();
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getAllByText("Then").length).toBeGreaterThan(0);
      expect(screen.getByText(/in any order/)).toBeInTheDocument();
    });

    it("marks the item the member is at, and what a locked one waits on", () => {
      renderSection();

      expect(screen.getByText("Member is here")).toBeInTheDocument();
      expect(screen.getByText("Waits on Start the app")).toBeInTheDocument();
    });

    it("shows the task count and how long a finished step took against its estimate", () => {
      renderSection();

      expect(screen.getByText("1/3 tasks")).toBeInTheDocument();
      expect(screen.getByText(/Took 45 min \(\+15 min\)/)).toBeInTheDocument();
    });

    it("says a step took less than its estimate with a minus", () => {
      const quick = {
        ...phase1,
        steps: [
          step({
            id: "clone",
            status: "FINISHED",
            estimatedMinutes: 60,
            startedAt: "2026-01-01T10:00:00Z",
            completedAt: "2026-01-01T10:45:00Z",
          }),
        ],
        questions: [],
      } as unknown as OnboardingPhaseEndpoint;
      renderSection({ path: { ...path, phases: [quick] } });

      expect(screen.getByText(/Took 45 min \(-15 min\)/)).toBeInTheDocument();
    });

    it("opens a step, and a question's results", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(screen.getByText("Start the app", { selector: "span" }));
      expect(props.onOpenStep).toHaveBeenCalledWith("run");

      await user.click(screen.getByRole("button", { name: /^(?!Add a step).*What is a hook\?/ }));
      expect(props.onOpenQuestions).toHaveBeenCalledWith("phase1", "results");
    });

    it("offers the question tools, worded by whether there are questions", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(screen.getByRole("button", { name: "Question results" }));
      await user.click(screen.getByRole("button", { name: "Edit questions" }));
      expect(props.onOpenQuestions).toHaveBeenNthCalledWith(1, "phase1", "results");
      expect(props.onOpenQuestions).toHaveBeenNthCalledWith(2, "phase1", "questions");

      await user.click(screen.getByRole("button", { name: "Nav Architecture" }));
      expect(screen.getByRole("button", { name: "Add questions" })).toBeInTheDocument();
    });

    it("says a phase is empty and offers the first step", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Nav Empty" }));

      expect(screen.getByText("This phase has no steps or questions yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add the first step" })).toBeInTheDocument();
    });

    it("adds a step at the end of the phase, nothing else waiting on it", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(screen.getByRole("button", { name: "Add a step at the end" }));

      await waitFor(() =>
        expect(onboardingGraphService.createConnectedStep).toHaveBeenCalledWith("phase1", {
          step: {
            position: 3,
            title: "New step",
            description: "",
            type: "TASK",
            estimatedMinutes: 30,
            expectedOutcome: "",
          },
          waitsOn: ["verify", "q1", "q2"],
          unlocks: [],
          graphX: undefined,
          graphY: undefined,
        }),
      );
      expect(props.onPathChanged).toHaveBeenCalled();
    });

    it("adds a step from the toolbar", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Add step" }));

      await waitFor(() =>
        expect(onboardingGraphService.createConnectedStep).toHaveBeenCalledTimes(1),
      );
    });

    it("adds a step in between an item and what waited on it", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(
        screen.getByRole("button", { name: "Add a step after Clone the repository" }),
      );

      await waitFor(() => expect(onboardingGraphService.createConnectedStep).toHaveBeenCalled());
      const [phaseId, request] = vi.mocked(onboardingGraphService.createConnectedStep).mock
        .calls[0];
      expect(phaseId).toBe("phase1");
      expect(request.waitsOn).toEqual(["clone"]);
      expect([...request.unlocks].sort()).toEqual(["q1", "q2", "run"]);
    });

    it("creates one step however fast the PM clicks", async () => {
      let finish: (value: unknown) => void = () => {};
      vi.mocked(onboardingGraphService.createConnectedStep).mockReturnValue(
        new Promise((resolve) => (finish = resolve)) as never,
      );
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Add step" }));
      await user.click(screen.getByRole("button", { name: "Add a step at the end" }));
      expect(screen.getByRole("button", { name: "Add step" })).toBeDisabled();
      finish({ id: "new-step" });

      await waitFor(() => expect(screen.getByRole("button", { name: "Add step" })).toBeEnabled());
      expect(onboardingGraphService.createConnectedStep).toHaveBeenCalledTimes(1);
    });

    it("opens the new step for naming, saying what it waits on and leads to", async () => {
      vi.mocked(onboardingGraphService.createConnectedStep).mockResolvedValue({
        id: "run",
      } as never);
      const user = userEvent.setup();
      renderSection();

      await user.click(
        screen.getByRole("button", { name: "Add a step after Clone the repository" }),
      );

      expect(await screen.findByText("quick edit run start=true")).toBeInTheDocument();
      expect(screen.getByText(/Opens after Clone the repository · leads to/)).toBeInTheDocument();
      expect(screen.getByText(/Connections can be changed in the graph\./)).toBeInTheDocument();
    });

    it("says a new step opens from the start when it waits on nothing", async () => {
      vi.mocked(onboardingGraphService.createConnectedStep).mockResolvedValue({
        id: "clone",
      } as never);
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Add a step at the end" }));

      expect(await screen.findByText("quick edit clone start=true")).toBeInTheDocument();
    });

    it("stops naming the step once it was saved, and reads the path again", async () => {
      vi.mocked(onboardingGraphService.createConnectedStep).mockResolvedValue({
        id: "run",
      } as never);
      const user = userEvent.setup();
      const { props } = renderSection();
      await user.click(screen.getByRole("button", { name: "Add step" }));

      await user.click(await screen.findByRole("button", { name: "Save run" }));

      await waitFor(() => expect(screen.queryByText(/quick edit run/)).not.toBeInTheDocument());
      expect(props.onPathChanged).toHaveBeenCalledTimes(2);
    });

    it("says why adding a step failed, and lets the PM try again", async () => {
      vi.mocked(onboardingGraphService.createConnectedStep).mockRejectedValueOnce(
        new Error("no room"),
      );
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Add step" }));
      expect(await screen.findByText("Couldn't add the step")).toBeInTheDocument();
      expect(screen.getByText("no room")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add step" }));
      await waitFor(() =>
        expect(onboardingGraphService.createConnectedStep).toHaveBeenCalledTimes(2),
      );
    });

    it("says it without a reason when the failure carries none", async () => {
      vi.mocked(onboardingGraphService.createConnectedStep).mockRejectedValueOnce("nope");
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Add step" }));

      expect(await screen.findByText("Couldn't add the step")).toBeInTheDocument();
    });

    it("selects another phase from the navigator", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Nav Architecture" }));

      expect(screen.getByText(/Phase 2 of 3/)).toBeInTheDocument();
      expect(screen.getByText(/nav selected=phase2/)).toBeInTheDocument();
    });
  });

  describe("choosing the reading", () => {
    it("switches to the graph and back, forgetting the selected item", async () => {
      remember("list");
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Graph" }));
      expect(await screen.findByTestId("graph")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Select run" }));
      expect(screen.getByText(/selected=run/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "List" }));
      await user.click(screen.getByRole("button", { name: "Graph" }));

      expect(await screen.findByText(/selected=none/)).toBeInTheDocument();
    });

    it("remembers the reading per manager and member", async () => {
      remember("list");
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole("button", { name: "Graph" }));

      await waitFor(() =>
        expect(
          JSON.parse(localStorage.getItem(memberJourneyViewKey("pm-1", "user1"))!),
        ).toMatchObject({ mode: "graph" }),
      );
    });

    it("opens a phase's graph that was remembered, and forgets one of another path", async () => {
      remember("graph", "phase2");
      const { unmount } = renderSection();
      expect(await screen.findByText(/graph open=phase2/)).toBeInTheDocument();
      unmount();

      remember("graph", "not-on-this-path");
      renderSection();
      expect(await screen.findByText(/graph open=map/)).toBeInTheDocument();
    });

    it("says so when there is no path, and when the member has no first name", () => {
      renderSection({ path: null, memberName: "" });

      expect(screen.getByText(/This member has no onboarding path yet/)).toBeInTheDocument();
      expect(screen.getByText(/this member’s copy only/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Graph" })).not.toBeInTheDocument();
    });

    it("says so for a path without phases", () => {
      renderSection({ path: { ...path, phases: [] } });

      expect(screen.getByText(/Alice has no onboarding path yet/)).toBeInTheDocument();
    });
  });

  describe("the graph", () => {
    beforeEach(() => remember("graph"));

    it("hands the graph the phase and the item the member is at", async () => {
      renderSection();

      const next = resolveNextAction(path);
      const nextId =
        next.kind === "step" ? next.step.id : next.kind === "question" ? next.question.id : "none";
      expect(
        await screen.findByText(new RegExp(`focus=phase1 next=${nextId} selected=none`)),
      ).toBeInTheDocument();
    });

    it("opens a phase and selects it for the list too", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Open phase2" }));
      expect(screen.getByText(/graph open=phase2/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "List" }));
      expect(screen.getByText(/Phase 2 of 3/)).toBeInTheDocument();
    });

    it("goes back to the map without changing the phase", async () => {
      const user = userEvent.setup();
      renderSection();
      await user.click(await screen.findByRole("button", { name: "Open phase2" }));

      await user.click(screen.getByRole("button", { name: "Back to the map" }));

      expect(screen.getByText(/graph open=map/)).toBeInTheDocument();
    });

    it("opens a step, and a question's results from the question's own phase", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(await screen.findByRole("button", { name: "Open step item" }));
      expect(props.onOpenStep).toHaveBeenCalledWith("run");

      await user.click(screen.getByRole("button", { name: "Open question item" }));
      expect(props.onOpenQuestions).toHaveBeenCalledWith("phase1", "results");
    });

    it("keeps the step being named when it is selected, and drops it for another", async () => {
      const user = userEvent.setup();
      renderSection();
      await user.click(await screen.findByRole("button", { name: "Drop a step" }));
      await waitFor(() => expect(screen.getByText(/selected=new-step/)).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Select new step" }));
      await user.click(screen.getByRole("button", { name: "Select run" }));

      expect(screen.getByText(/selected=run/)).toBeInTheDocument();
    });

    it("shows the aside of a step: facts, actions, a pending skip, its feedback and a quick edit", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      const aside = await screen.findByTestId("aside-run");
      expect(within(aside).getByText("1/3 tasks")).toBeInTheDocument();
      expect(within(aside).getByText("skip review: Know it")).toBeInTheDocument();
      expect(within(aside).getByText(/feedback: too hard marking=false/)).toBeInTheDocument();
      expect(within(aside).queryByText(/feedback: fine/)).not.toBeInTheDocument();
      expect(within(aside).getByText("quick edit run start=false")).toBeInTheDocument();

      await user.click(within(aside).getByRole("button", { name: "Tasks & details" }));
      expect(props.onOpenStep).toHaveBeenCalledWith("run");
      await user.click(within(aside).getByRole("button", { name: "Delete" }));
      expect(props.onDeleteStep).toHaveBeenCalledWith("run");
      await user.click(within(aside).getByRole("button", { name: "Accept the skip" }));
      expect(props.onReviewSkip).toHaveBeenCalledWith("skip1", "accept", "fine");
      await user.click(within(aside).getByRole("button", { name: "Read f1" }));
      expect(props.onMarkFeedbackRead).toHaveBeenCalledWith("f1");
    });

    it("shows which feedback is being marked", async () => {
      renderSection({ markingFeedbackId: "f1" });

      expect(await screen.findByText(/feedback: too hard marking=true/)).toBeInTheDocument();
    });

    it("shows no skip review without a way to answer it", async () => {
      renderSection({ onReviewSkip: undefined });

      const aside = await screen.findByTestId("aside-run");
      expect(within(aside).queryByText(/skip review/)).not.toBeInTheDocument();
    });

    it("shows the aside of a question with its own action and none of a step's", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      const aside = await screen.findByTestId("aside-q1");
      expect(within(aside).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
      expect(within(aside).queryByText(/quick edit/)).not.toBeInTheDocument();
      await user.click(within(aside).getByRole("button", { name: "View attempts" }));
      expect(props.onOpenQuestions).toHaveBeenCalledWith("phase1", "results");
    });

    it("closes and moves the selection from the aside", async () => {
      const user = userEvent.setup();
      renderSection();
      await user.click(await screen.findByRole("button", { name: "Select run" }));

      await user.click(
        within(screen.getByTestId("aside-run")).getByRole("button", {
          name: "Select clone from run",
        }),
      );
      expect(screen.getByText(/selected=clone/)).toBeInTheDocument();

      await user.click(
        within(screen.getByTestId("aside-run")).getByRole("button", { name: "Close aside run" }),
      );
      expect(screen.getByText(/selected=none/)).toBeInTheDocument();
    });

    it("names the step being named in the aside", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Drop a step" }));

      await waitFor(() => expect(onboardingGraphService.createConnectedStep).toHaveBeenCalled());
      vi.mocked(onboardingGraphService.createConnectedStep).mockResolvedValue({
        id: "run",
      } as never);
    });
  });

  describe("drawing on the graph", () => {
    beforeEach(() => remember("graph"));

    it("connects a step to another and reads the path again", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(await screen.findByRole("button", { name: "Connect clone to verify" }));

      await waitFor(() =>
        expect(onboardingGraphService.replaceNodeBlockers).toHaveBeenCalledWith("verify", [
          "run",
          "clone",
        ]),
      );
      expect(props.onPathChanged).toHaveBeenCalled();
    });

    it("sends nothing for a connection that is already there, or to a node that is not", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(
        await screen.findByRole("button", { name: "Connect run to verify (already)" }),
      );
      await user.click(screen.getByRole("button", { name: "Connect to a ghost" }));
      await user.click(screen.getByRole("button", { name: "Disconnect a ghost" }));

      expect(onboardingGraphService.replaceNodeBlockers).not.toHaveBeenCalled();
    });

    it("removes a connection", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Disconnect run from verify" }));

      await waitFor(() =>
        expect(onboardingGraphService.replaceNodeBlockers).toHaveBeenCalledWith("verify", []),
      );
    });

    it("connects and disconnects phases", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Connect phases" }));
      await waitFor(() =>
        expect(onboardingGraphService.replacePhaseBlockers).not.toHaveBeenCalled(),
      );

      await user.click(screen.getByRole("button", { name: "Disconnect phases" }));
      await waitFor(() =>
        expect(onboardingGraphService.replacePhaseBlockers).toHaveBeenCalledWith("phase2", []),
      );
    });

    it("connects a phase that does not wait yet", async () => {
      const onlyPhase1 = { ...phase2, blockerIds: [] } as unknown as OnboardingPhaseEndpoint;
      const user = userEvent.setup();
      renderSection({ path: { ...path, phases: [phase1, onlyPhase1] } });

      await user.click(await screen.findByRole("button", { name: "Connect phases" }));

      await waitFor(() =>
        expect(onboardingGraphService.replacePhaseBlockers).toHaveBeenCalledWith("phase2", [
          "phase1",
        ]),
      );
    });

    it("sends nothing for a phase that is not there", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Connect to a ghost phase" }));

      expect(onboardingGraphService.replacePhaseBlockers).not.toHaveBeenCalled();
    });

    it("keeps two quick edits of one node from dropping the first", async () => {
      let release: () => void = () => {};
      vi.mocked(onboardingGraphService.replaceNodeBlockers).mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve(undefined))) as never,
      );
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Connect clone to verify" }));
      await user.click(screen.getByRole("button", { name: "Disconnect run from verify" }));
      release();

      await waitFor(() =>
        expect(onboardingGraphService.replaceNodeBlockers).toHaveBeenNthCalledWith(2, "verify", [
          "clone",
        ]),
      );
    });

    it("drops a step on the graph, connected to nothing, and selects it", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Drop a step" }));

      await waitFor(() =>
        expect(onboardingGraphService.createConnectedStep).toHaveBeenCalledWith(
          "phase1",
          expect.objectContaining({ waitsOn: [], unlocks: [], graphX: 10, graphY: 20 }),
        ),
      );
      expect(await screen.findByText(/selected=new-step/)).toBeInTheDocument();
    });

    it("drops nothing in a phase that is not there", async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole("button", { name: "Drop a step in a ghost phase" }));

      expect(onboardingGraphService.createConnectedStep).not.toHaveBeenCalled();
    });

    it("saves where the nodes were put, for a phase and for the path", async () => {
      const user = userEvent.setup();
      const { props } = renderSection();

      await user.click(await screen.findByRole("button", { name: "Save phase layout" }));
      await waitFor(() =>
        expect(onboardingGraphService.arrangePhase).toHaveBeenCalledWith("phase1", [{ id: "run" }]),
      );

      await user.click(screen.getByRole("button", { name: "Save path layout" }));
      await waitFor(() =>
        expect(onboardingGraphService.arrangeUserPath).toHaveBeenCalledWith("user1", [
          { id: "phase1" },
        ]),
      );
      expect(props.onPathChanged).toHaveBeenCalledTimes(2);
    });
  });

  describe("showing a phase on request", () => {
    it("selects the phase in the list and clears the selected item", () => {
      remember("list");
      const ref = createRef<MemberJourneyHandle>();
      renderSection({ ref });
      const scroll = vi.fn();
      document.getElementById("member-journey-title")!.closest("section")!.scrollIntoView = scroll;

      act(() => ref.current?.showPhase("phase2"));

      expect(screen.getByText(/Phase 2 of 3/)).toBeInTheDocument();
      expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    });

    it("opens the phase in the graph when the graph is open", async () => {
      remember("graph");
      const ref = createRef<MemberJourneyHandle>();
      renderSection({ ref });
      await screen.findByTestId("graph");
      document.getElementById("member-journey-title")!.closest("section")!.scrollIntoView = vi.fn();

      act(() => ref.current?.showPhase("phase2"));

      expect(await screen.findByText(/graph open=phase2/)).toBeInTheDocument();
    });

    it("only scrolls without a phase", () => {
      remember("list");
      const ref = createRef<MemberJourneyHandle>();
      renderSection({ ref });
      const scroll = vi.fn();
      document.getElementById("member-journey-title")!.closest("section")!.scrollIntoView = scroll;

      act(() => ref.current?.showPhase());

      expect(scroll).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Phase 1 of 3/)).toBeInTheDocument();
      expect(spies.lastPhases).toBeDefined();
    });
  });
});
