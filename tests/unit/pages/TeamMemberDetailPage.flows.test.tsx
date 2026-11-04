import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useImperativeHandle } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { TeamMemberDetailPage } from "../../../src/pages/TeamMemberDetailPage";
import type { TeamOverviewUser } from "../../../src/services/teamManagementTypes";
import { onboardingService } from "../../../src/services/onboardingService";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showPhase: vi.fn(),
  getTeamMember: vi.fn(),
  getTeamOverview: vi.fn(),
  getProjectRoles: vi.fn(),
  getUserSkillLevels: vi.fn(),
  getUserOnboardingPath: vi.fn(),
  getUserOnboardingFeedback: vi.fn(),
  getOnboardingTasksByStep: vi.fn(),
  assignProjectRoleToUser: vi.fn(),
  unassignProjectRoleFromUser: vi.fn(),
  acceptOnboardingSkipRequest: vi.fn(),
  denyOnboardingSkipRequest: vi.fn(),
  markOnboardingFeedbackRead: vi.fn(),
  deleteOnboardingStep: vi.fn(),
  deleteOnboardingTask: vi.fn(),
  createOnboardingTaskForStep: vi.fn(),
  updateOnboardingTask: vi.fn(),
  fetchKnowledgeGaps: vi.fn(),
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});

vi.mock("../../../src/services/onboardingService", () => ({
  onboardingService: { rebuildMemberPath: vi.fn() },
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "pm1", firstName: "PM", lastName: "User" } }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../../src/services/teamManagementService", () => ({
  getTeamMember: mocks.getTeamMember,
  getTeamOverview: mocks.getTeamOverview,
  getProjectRoles: mocks.getProjectRoles,
  getUserSkillLevels: mocks.getUserSkillLevels,
  getUserOnboardingPath: mocks.getUserOnboardingPath,
  getUserOnboardingFeedback: mocks.getUserOnboardingFeedback,
  getOnboardingTasksByStep: mocks.getOnboardingTasksByStep,
  assignProjectRoleToUser: mocks.assignProjectRoleToUser,
  unassignProjectRoleFromUser: mocks.unassignProjectRoleFromUser,
  acceptOnboardingSkipRequest: mocks.acceptOnboardingSkipRequest,
  denyOnboardingSkipRequest: mocks.denyOnboardingSkipRequest,
  markOnboardingFeedbackRead: mocks.markOnboardingFeedbackRead,
  deleteOnboardingStep: mocks.deleteOnboardingStep,
  deleteOnboardingTask: mocks.deleteOnboardingTask,
  createOnboardingTaskForStep: mocks.createOnboardingTaskForStep,
  updateOnboardingTask: mocks.updateOnboardingTask,
}));

vi.mock("../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { fetchKnowledgeGaps: mocks.fetchKnowledgeGaps },
}));

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="56" height="56" />,
}));

type JourneyProps = {
  ref?: React.Ref<{ showPhase: (phaseId?: string) => void }>;
  stepTaskCounts: Record<string, { done: number; total: number }>;
  onOpenStep: (stepId: string) => void;
  onOpenQuestions: (phaseId: string, tab: "results" | "questions") => void;
  onDeleteStep: (stepId: string) => void;
  onReviewSkip: (skipId: string, action: "accept" | "deny", comment?: string) => void;
  onMarkFeedbackRead: (feedbackId: string) => void;
  onPathChanged: () => void;
  markingFeedbackId: string | null;
};

vi.mock("../../../src/features/team-management/components/detail/MemberJourneySection", () => ({
  MemberJourneySection: (props: JourneyProps) => {
    useImperativeHandle(props.ref, () => ({ showPhase: mocks.showPhase }));
    return (
      <div data-testid="journey">
        <p>counts: {JSON.stringify(props.stepTaskCounts)}</p>
        <p>marking: {props.markingFeedbackId ?? "none"}</p>
        <button onClick={() => props.onOpenStep("st1")}>Open step st1</button>
        <button onClick={() => props.onOpenStep("ghost")}>Open step ghost</button>
        <button onClick={() => props.onDeleteStep("st1")}>Graph delete st1</button>
        <button onClick={() => props.onDeleteStep("ghost")}>Graph delete ghost</button>
        <button onClick={() => props.onOpenQuestions("ph1", "questions")}>Open questions</button>
        <button onClick={() => props.onReviewSkip("skip9", "deny", "no")}>Journey deny</button>
        <button onClick={() => props.onMarkFeedbackRead("fb1")}>Journey read</button>
        <button onClick={props.onPathChanged}>Path changed</button>
      </div>
    );
  },
}));

vi.mock("../../../src/features/team-management/components/detail/MemberGapsPanel", () => ({
  MemberGapsPanel: (props: {
    knowledgeGaps: { id: string; component: string }[];
    onOpenKnowledgeGap: (gapId: string) => void;
  }) => (
    <div data-testid="gaps">
      {props.knowledgeGaps.map((gap) => (
        <button key={gap.id} onClick={() => props.onOpenKnowledgeGap(gap.id)}>
          Gap {gap.component}
        </button>
      ))}
    </div>
  ),
}));

type PanelProps = {
  step: { id: string; title: string };
  tasks: { id: string; title: string }[];
  doneTaskCount: number;
  actualMinutes: number | null;
  feedbackItems: { id: string; message: string; helpful?: boolean | null }[];
  skipReason: string;
  taskInsertTarget: { stepId: string; position: number } | null;
  newTaskTitle: string;
  newTaskDescription: string;
  addingTask: boolean;
  stepActionId: string | null;
  stepToDelete: { id: string } | null;
  taskToDelete: { id: string } | null;
  onClose: () => void;
  onRequestDeleteStep: (step: unknown) => void;
  onCancelDeleteStep: () => void;
  onConfirmDeleteStep: (step: unknown) => void;
  onRequestDeleteTask: (task: unknown) => void;
  onCancelDeleteTask: () => void;
  onConfirmDeleteTask: (task: unknown) => void;
  onTaskInsertTargetChange: (target: { stepId: string; position: number } | null) => void;
  onNewTaskTitleChange: (value: string) => void;
  onNewTaskDescriptionChange: (value: string) => void;
  onCreateTask: () => void;
  onReviewSkip: (skipId: string, action: "accept" | "deny", comment?: string) => void;
  onMarkFeedbackRead: (feedbackId: string) => void;
  onReorderTasks: (activeTaskId: string, overTaskId: string) => void;
};

vi.mock("../../../src/features/team-management/components/detail/StepDetailsPanel", () => ({
  StepDetailsPanel: (props: PanelProps) => (
    <div data-testid="panel">
      <p>panel: {props.step.title}</p>
      <p>tasks: {props.tasks.map((task) => task.id).join(",")}</p>
      <p>done: {props.doneTaskCount}</p>
      <p>minutes: {String(props.actualMinutes)}</p>
      <p>
        feedback:{" "}
        {props.feedbackItems.map((item) => `${item.message}/${String(item.helpful)}`).join(";")}
      </p>
      <p>skip reason: {props.skipReason}</p>
      <p>insert: {JSON.stringify(props.taskInsertTarget)}</p>
      <p>
        draft: {props.newTaskTitle}|{props.newTaskDescription}
      </p>
      <p>
        adding: {String(props.addingTask)} action: {props.stepActionId ?? "none"}
      </p>
      <p>step to delete: {props.stepToDelete?.id ?? "none"}</p>
      <p>task to delete: {props.taskToDelete?.id ?? "none"}</p>
      <button onClick={props.onClose}>Close panel</button>
      <button onClick={() => props.onRequestDeleteStep(props.step)}>Ask delete step</button>
      <button onClick={props.onCancelDeleteStep}>Cancel delete step</button>
      <button onClick={() => props.onConfirmDeleteStep(props.step)}>Confirm delete step</button>
      <button onClick={() => props.onRequestDeleteTask(props.tasks[0])}>Ask delete task</button>
      <button onClick={props.onCancelDeleteTask}>Cancel delete task</button>
      <button onClick={() => props.onConfirmDeleteTask(props.tasks[0])}>Confirm delete task</button>
      <button onClick={() => props.onTaskInsertTargetChange({ stepId: "st1", position: 2 })}>
        Target end
      </button>
      <button onClick={() => props.onNewTaskTitleChange("  Write tests  ")}>Type title</button>
      <button onClick={() => props.onNewTaskDescriptionChange("  properly  ")}>
        Type description
      </button>
      <button onClick={props.onCreateTask}>Create task</button>
      <button onClick={() => props.onReviewSkip("skip-panel", "accept")}>Panel accept</button>
      <button onClick={() => props.onMarkFeedbackRead("fb1")}>Panel read</button>
      <button onClick={() => props.onReorderTasks("t2", "t1")}>Reorder</button>
      <button onClick={() => props.onReorderTasks("t1", "t1")}>Reorder onto itself</button>
      <button onClick={() => props.onReorderTasks("t1", "nowhere")}>Reorder to nowhere</button>
    </div>
  ),
}));

vi.mock("../../../src/features/team-management/components/detail/PhaseCheckAdminModal", () => ({
  PhaseCheckAdminModal: (props: {
    phaseTitle: string;
    initialTab: string;
    memberName: string;
    onSaved: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="check-modal">
      <p>
        modal: {props.phaseTitle} on {props.initialTab} for {props.memberName}
      </p>
      <button onClick={props.onSaved}>Modal saved</button>
      <button onClick={props.onClose}>Modal close</button>
    </div>
  ),
}));

vi.mock("../../../src/features/team-management/components/detail/MemberDetailDialogs", () => ({
  MemberDetailDialogs: (props: {
    roleToRemove: { id: string; name: string } | null;
    onCancelRoleRemove: () => void;
    onConfirmRoleRemove: (role: { id: string; name: string }) => void;
  }) => (
    <div>
      {props.roleToRemove && (
        <>
          <button onClick={() => props.onConfirmRoleRemove(props.roleToRemove!)}>
            Confirm remove {props.roleToRemove.name}
          </button>
          <button onClick={props.onCancelRoleRemove}>Cancel remove</button>
        </>
      )}
    </div>
  ),
}));

function member(over: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "user1",
    firstname: "Alice",
    lastname: "Smith",
    roles: [{ id: "role1", name: "Backend", description: "" }],
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "ph1", title: "Phase 1" },
    currentStep: null,
    hasFeedback: false,
    projects: [{ id: "proj1", name: "Project 1" }],
    ...over,
  };
}

const task = (id: string, position: number, finished: boolean) => ({
  id,
  stepId: "st1",
  position,
  title: `Task ${id}`,
  description: `about ${id}`,
  finished,
});

const path = {
  id: "path1",
  userId: "user1",
  createdAt: "",
  phases: [
    {
      id: "ph2",
      title: "Phase 2",
      position: 2,
      steps: [{ id: "st9", title: "Later", position: 1 }],
    },
    {
      id: "ph1",
      title: "Phase 1",
      position: 1,
      steps: [
        {
          id: "st2",
          title: "Second",
          position: 2,
          feedback: { id: "fbs", comment: "from the step", helpful: true, createdAt: "t" },
        },
        {
          id: "st1",
          title: "Install",
          position: 1,
          status: "FINISHED",
          startedAt: "2026-01-01T10:00:00Z",
          completedAt: "2026-01-01T10:45:00Z",
          skip: { id: "skip1", status: "PENDING", reason: "Know it already" },
        },
      ],
    },
  ],
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderPage(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/team/user1${search}`]}>
      <TeamMemberDetailPage userId="user1" />
      <Where />
    </MemoryRouter>,
    { wrapper: ToastProvider },
  );
}

async function openStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Open step st1" }));
  await screen.findByTestId("panel");
}

describe("TeamMemberDetailPage flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTeamMember.mockResolvedValue(member());
    mocks.getTeamOverview.mockResolvedValue([member()]);
    mocks.getProjectRoles.mockResolvedValue([
      { id: "role1", name: "Backend", description: "" },
      { id: "role2", name: "Frontend", description: "" },
    ]);
    mocks.getUserSkillLevels.mockResolvedValue([]);
    mocks.getUserOnboardingPath.mockResolvedValue(path);
    mocks.getUserOnboardingFeedback.mockResolvedValue([]);
    mocks.getOnboardingTasksByStep.mockImplementation((stepId: string) =>
      Promise.resolve(stepId === "st1" ? [task("t2", 2, true), task("t1", 1, false)] : []),
    );
    mocks.fetchKnowledgeGaps.mockResolvedValue({ gaps: [] });
    mocks.assignProjectRoleToUser.mockResolvedValue(undefined);
    mocks.unassignProjectRoleFromUser.mockResolvedValue(undefined);
    mocks.acceptOnboardingSkipRequest.mockResolvedValue(undefined);
    mocks.denyOnboardingSkipRequest.mockResolvedValue(undefined);
    mocks.markOnboardingFeedbackRead.mockResolvedValue(undefined);
    mocks.deleteOnboardingStep.mockResolvedValue(undefined);
    mocks.deleteOnboardingTask.mockResolvedValue(undefined);
    mocks.createOnboardingTaskForStep.mockResolvedValue(undefined);
    mocks.updateOnboardingTask.mockResolvedValue(undefined);
  });

  describe("loading", () => {
    it("says it is loading, then shows the member", async () => {
      renderPage();
      expect(screen.getByText("Loading team member...")).toBeInTheDocument();
      expect(await screen.findByLabelText("Alice Smith")).toBeInTheDocument();
    });

    it("says the member was not found", async () => {
      mocks.getTeamMember.mockResolvedValue(undefined);
      renderPage();
      expect(await screen.findByText("Team member not found.")).toBeInTheDocument();
    });

    it("says why the member could not be loaded", async () => {
      mocks.getUserSkillLevels.mockRejectedValue(new Error("skills are down"));
      renderPage();
      expect(
        await screen.findByText("The team member could not be loaded: skills are down"),
      ).toBeInTheDocument();
    });

    it("says it in general words when the failure carries no message", async () => {
      mocks.getProjectRoles.mockRejectedValue("nope");
      renderPage();
      expect(
        await screen.findByText(
          "The team member could not be loaded: The team member could not be loaded.",
        ),
      ).toBeInTheDocument();
    });

    it("still shows the member when only the feedback cannot be loaded", async () => {
      mocks.getUserOnboardingFeedback.mockRejectedValue(new Error("no feedback"));
      renderPage();
      expect(await screen.findByLabelText("Alice Smith")).toBeInTheDocument();
    });

    it("goes back to the roster, and from the loading state too", async () => {
      mocks.getTeamMember.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      const { unmount } = renderPage();
      await user.click(screen.getByRole("button", { name: "Team" }));
      expect(mocks.navigate).toHaveBeenCalledWith("/team-management");
      unmount();

      mocks.navigate.mockClear();
      mocks.getTeamMember.mockResolvedValue(member());
      renderPage();
      await screen.findByLabelText("Alice Smith");
      await user.click(screen.getByRole("button", { name: "Team" }));
      expect(mocks.navigate).toHaveBeenCalledWith("/team-management");
    });

    it("keeps only the gaps of components the member owns", async () => {
      mocks.fetchKnowledgeGaps.mockResolvedValue({
        gaps: [
          { id: "g1", component: "api", severity: "high", owners: [{ id: "user1" }] },
          { id: "g2", component: "web", severity: "covered", owners: [{ id: "user1" }] },
          { id: "g3", component: "db", severity: "low", owners: [{ id: "other" }] },
        ],
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Gap api" }));

      expect(screen.queryByRole("button", { name: "Gap web" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Gap db" })).not.toBeInTheDocument();
      expect(mocks.navigate).toHaveBeenCalledWith("/insights/knowledge-gaps/g1");
    });
  });

  describe("roles", () => {
    async function addFrontend(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByLabelText("Alice Smith");
      await user.click(screen.getByRole("combobox", { name: "Choose a role to add" }));
      await user.click(await screen.findByRole("option", { name: "Frontend" }));
    }

    it("adds a role, and the member then holds it", async () => {
      const user = userEvent.setup();
      renderPage();

      await addFrontend(user);

      await waitFor(() =>
        expect(mocks.assignProjectRoleToUser).toHaveBeenCalledWith("user1", "role2"),
      );
      expect(await screen.findByText("Role assigned")).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Remove Frontend" })).toBeInTheDocument();
    });

    it("tells why assigning a role failed, and the member does not hold it", async () => {
      mocks.assignProjectRoleToUser.mockRejectedValue(new Error("role is locked"));
      const user = userEvent.setup();
      renderPage();

      await addFrontend(user);

      expect(await screen.findByText("role is locked")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove Frontend" })).not.toBeInTheDocument();
    });

    it("says it in general words when assigning fails without a message", async () => {
      mocks.assignProjectRoleToUser.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();

      await addFrontend(user);

      expect(await screen.findByText("Couldn't assign the role.")).toBeInTheDocument();
    });

    it("removes a role after it was confirmed", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByLabelText("Alice Smith");

      await user.click(screen.getByRole("button", { name: "Remove Backend" }));
      await user.click(await screen.findByRole("button", { name: "Confirm remove Backend" }));

      await waitFor(() =>
        expect(mocks.unassignProjectRoleFromUser).toHaveBeenCalledWith("user1", "role1"),
      );
      expect(await screen.findByText("Role removed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove Backend" })).not.toBeInTheDocument();
    });

    it("tells why removing failed, and the member keeps the role", async () => {
      mocks.unassignProjectRoleFromUser.mockRejectedValue(new Error("last role"));
      const user = userEvent.setup();
      renderPage();
      await screen.findByLabelText("Alice Smith");

      await user.click(screen.getByRole("button", { name: "Remove Backend" }));
      await user.click(await screen.findByRole("button", { name: "Confirm remove Backend" }));

      expect(await screen.findByText("last role")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Backend" })).toBeInTheDocument();
    });

    it("says it in general words when removing fails without a message", async () => {
      mocks.unassignProjectRoleFromUser.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await screen.findByLabelText("Alice Smith");

      await user.click(screen.getByRole("button", { name: "Remove Backend" }));
      await user.click(await screen.findByRole("button", { name: "Confirm remove Backend" }));

      expect(await screen.findByText("Couldn't remove the role.")).toBeInTheDocument();
    });

    it("cancels removing a role", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByLabelText("Alice Smith");

      await user.click(screen.getByRole("button", { name: "Remove Backend" }));
      await user.click(await screen.findByRole("button", { name: "Cancel remove" }));

      expect(mocks.unassignProjectRoleFromUser).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Cancel remove" })).not.toBeInTheDocument();
    });
  });

  describe("the tasks of the path", () => {
    it("counts the done tasks of every step", async () => {
      renderPage();
      expect(await screen.findByText(/counts: .*"st1":\{"done":1,"total":2\}/)).toBeInTheDocument();
      expect(screen.getByText(/"st2":\{"done":0,"total":0\}/)).toBeInTheDocument();
    });

    it("keeps the counts that were read when one step fails", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.getOnboardingTasksByStep.mockImplementation((stepId: string) =>
        stepId === "st2"
          ? Promise.reject(new Error("one step down"))
          : Promise.resolve(stepId === "st1" ? [task("t1", 1, true)] : []),
      );
      renderPage();

      expect(await screen.findByText(/"st1":\{"done":1,"total":1\}/)).toBeInTheDocument();
      expect(screen.queryByText(/"st2"/)).not.toBeInTheDocument();
      expect(spy).toHaveBeenCalledWith(
        "Failed to load the tasks of 1 of 3 steps:",
        expect.any(Error),
      );
      spy.mockRestore();
    });

    it("shows no counts for a member without a path", async () => {
      mocks.getUserOnboardingPath.mockResolvedValue(null);
      renderPage();
      expect(await screen.findByText("counts: {}")).toBeInTheDocument();
      expect(mocks.getOnboardingTasksByStep).not.toHaveBeenCalled();
    });
  });

  describe("the open step", () => {
    it("opens from the journey into the URL, shows the step, and closes by replacing", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      expect(screen.getByTestId("where")).toHaveTextContent("?step=st1");
      expect(screen.getByText("panel: Install")).toBeInTheDocument();
      expect(screen.getByText("tasks: t1,t2")).toBeInTheDocument();
      expect(screen.getByText("done: 1")).toBeInTheDocument();
      expect(screen.getByText("minutes: 45")).toBeInTheDocument();
      expect(screen.getByText("skip reason: Know it already")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close panel" }));
      await waitFor(() => expect(screen.queryByTestId("panel")).not.toBeInTheDocument());
      expect(screen.getByTestId("where")).not.toHaveTextContent("step=");
    });

    it("opens from the URL", async () => {
      renderPage("?step=st1");
      expect(await screen.findByText("panel: Install")).toBeInTheDocument();
    });

    it("shows nothing for a step that is not on the path", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Open step ghost" }));

      expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
    });

    it("takes the feedback of the step from the step itself when the list has none", async () => {
      renderPage("?step=st2");
      expect(await screen.findByText("feedback: from the step/true")).toBeInTheDocument();
    });

    it("lists the feedback of the member for the step, with the step's verdict filled in", async () => {
      mocks.getUserOnboardingFeedback.mockResolvedValue([
        { id: "fbs", stepId: "st2", message: "from the list", read: false },
        { id: "other", stepId: "st1", message: "elsewhere", read: false },
      ]);
      renderPage("?step=st2");

      expect(await screen.findByText("feedback: from the list/true")).toBeInTheDocument();
    });

    it("shows the phase asked for on the way in, then drops it from the URL", async () => {
      renderPage("?phase=ph2");

      await waitFor(() => expect(mocks.showPhase).toHaveBeenCalledWith("ph2"));
      await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("phase="));
    });
  });

  describe("deleting a step", () => {
    it("asks in the panel, then deletes, closes the panel and reads the path and the member again", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Ask delete step" }));
      expect(screen.getByText("step to delete: st1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel delete step" }));
      expect(screen.getByText("step to delete: none")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Confirm delete step" }));

      await waitFor(() => expect(mocks.deleteOnboardingStep).toHaveBeenCalledWith("st1"));
      expect(await screen.findByText("Step deleted")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByTestId("panel")).not.toBeInTheDocument());
      expect(mocks.getUserOnboardingPath).toHaveBeenCalledTimes(2);
      expect(mocks.getTeamMember).toHaveBeenCalledTimes(2);
    });

    it("says why deleting failed and keeps the panel", async () => {
      mocks.deleteOnboardingStep.mockRejectedValue(new Error("step is in use"));
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Confirm delete step" }));

      expect(await screen.findByText("step is in use")).toBeInTheDocument();
      expect(screen.getByTestId("panel")).toBeInTheDocument();
    });

    it("says it in general words when the failure carries no message", async () => {
      mocks.deleteOnboardingStep.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Confirm delete step" }));

      expect(await screen.findByText("Couldn't delete the step.")).toBeInTheDocument();
    });

    it("asks from the graph, naming the step, and deletes on confirmation", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Graph delete st1" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent('"Install" is removed from Alice\'s path.');
      await user.click(within(dialog).getByRole("button", { name: "Delete step" }));

      await waitFor(() => expect(mocks.deleteOnboardingStep).toHaveBeenCalledWith("st1"));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("cancels the graph question", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Graph delete st1" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(mocks.deleteOnboardingStep).not.toHaveBeenCalled();
    });

    it("just closes the question when the step is gone since it was asked", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Graph delete ghost" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent('"The step" is removed');
      await user.click(within(dialog).getByRole("button", { name: "Delete step" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(mocks.deleteOnboardingStep).not.toHaveBeenCalled();
    });
  });

  describe("the tasks of a step", () => {
    it("adds a task from the trimmed draft, then reads everything again", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);
      await user.click(screen.getByRole("button", { name: "Target end" }));
      await user.click(screen.getByRole("button", { name: "Type title" }));
      await user.click(screen.getByRole("button", { name: "Type description" }));
      expect(screen.getByText(/draft:\s*\s*Write tests\s*\|\s*properly/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Create task" }));

      await waitFor(() =>
        expect(mocks.createOnboardingTaskForStep).toHaveBeenCalledWith("st1", {
          position: 2,
          title: "Write tests",
          description: "properly",
          finished: false,
        }),
      );
      expect(await screen.findByText("Task added")).toBeInTheDocument();
      expect(screen.getByText("insert: null")).toBeInTheDocument();
      expect(screen.getByText(/draft: \|/)).toBeInTheDocument();
      expect(mocks.getUserOnboardingPath).toHaveBeenCalledTimes(2);
      expect(mocks.getTeamMember).toHaveBeenCalledTimes(2);
      expect(screen.getByText("adding: false action: none")).toBeInTheDocument();
    });

    it("does nothing without a target or without a title", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Create task" }));
      await user.click(screen.getByRole("button", { name: "Target end" }));
      await user.click(screen.getByRole("button", { name: "Create task" }));

      expect(mocks.createOnboardingTaskForStep).not.toHaveBeenCalled();
    });

    it("keeps the draft and says why when adding fails", async () => {
      mocks.createOnboardingTaskForStep.mockRejectedValue(new Error("no room"));
      const user = userEvent.setup();
      renderPage();
      await openStep(user);
      await user.click(screen.getByRole("button", { name: "Target end" }));
      await user.click(screen.getByRole("button", { name: "Type title" }));

      await user.click(screen.getByRole("button", { name: "Create task" }));

      expect(await screen.findByText("no room")).toBeInTheDocument();
      expect(screen.getByText(/insert: \{"stepId":"st1","position":2\}/)).toBeInTheDocument();
    });

    it("says it in general words when adding fails without a message", async () => {
      mocks.createOnboardingTaskForStep.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await openStep(user);
      await user.click(screen.getByRole("button", { name: "Target end" }));
      await user.click(screen.getByRole("button", { name: "Type title" }));

      await user.click(screen.getByRole("button", { name: "Create task" }));

      expect(await screen.findByText("Couldn't create the task.")).toBeInTheDocument();
    });

    it("asks, cancels, and deletes a task, reading the step's tasks and the path again", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Ask delete task" }));
      expect(screen.getByText("task to delete: t1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel delete task" }));
      expect(screen.getByText("task to delete: none")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Confirm delete task" }));

      await waitFor(() => expect(mocks.deleteOnboardingTask).toHaveBeenCalledWith("t1"));
      expect(await screen.findByText("Task deleted")).toBeInTheDocument();
      expect(mocks.getUserOnboardingPath).toHaveBeenCalledTimes(2);
    });

    it("says why deleting a task failed", async () => {
      mocks.deleteOnboardingTask.mockRejectedValue(new Error("task is locked"));
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Confirm delete task" }));

      expect(await screen.findByText("task is locked")).toBeInTheDocument();
    });

    it("says it in general words when deleting a task fails without a message", async () => {
      mocks.deleteOnboardingTask.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Confirm delete task" }));

      expect(await screen.findByText("Couldn't delete the task.")).toBeInTheDocument();
    });

    it("writes the tasks whose position changed, then reads the step's tasks again", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Reorder" }));

      await waitFor(() => expect(mocks.updateOnboardingTask).toHaveBeenCalledTimes(1));
      expect(mocks.updateOnboardingTask).toHaveBeenCalledWith("t2", {
        position: 0,
        title: "Task t2",
        description: "about t2",
        finished: true,
      });
      await waitFor(() => expect(mocks.getOnboardingTasksByStep).toHaveBeenCalledTimes(4));
    });

    it("writes nothing for a move that is not one", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Reorder onto itself" }));
      await user.click(screen.getByRole("button", { name: "Reorder to nowhere" }));

      expect(mocks.updateOnboardingTask).not.toHaveBeenCalled();
    });

    it("says the order was not saved in full, and shows what the server has", async () => {
      mocks.updateOnboardingTask.mockRejectedValue(new Error("half way"));
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Reorder" }));

      expect(
        await screen.findByText("The new order could not be saved in full"),
      ).toBeInTheDocument();
      expect(
        await screen.findByText("half way The list now shows what the server has."),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText("tasks: t1,t2")).toBeInTheDocument());
    });

    it("says so without a reason when the failure carries no message", async () => {
      mocks.updateOnboardingTask.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Reorder" }));

      expect(
        await screen.findByText("The list now shows what the server has."),
      ).toBeInTheDocument();
    });
  });

  describe("feedback and skips", () => {
    it("marks feedback read and reads the feedback and the member again", async () => {
      mocks.getUserOnboardingFeedback.mockResolvedValue([
        { id: "fb1", stepId: "st1", message: "hard", read: false },
      ]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey read" }));

      await waitFor(() => expect(mocks.markOnboardingFeedbackRead).toHaveBeenCalledWith("fb1"));
      await waitFor(() => expect(mocks.getUserOnboardingFeedback).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByText("marking: none")).toBeInTheDocument());
    });

    it("marks feedback read from the panel too", async () => {
      const user = userEvent.setup();
      renderPage();
      await openStep(user);

      await user.click(screen.getByRole("button", { name: "Panel read" }));

      await waitFor(() => expect(mocks.markOnboardingFeedbackRead).toHaveBeenCalledWith("fb1"));
    });

    it("says why marking failed", async () => {
      mocks.markOnboardingFeedbackRead.mockRejectedValue(new Error("not now"));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey read" }));

      expect(await screen.findByText("not now")).toBeInTheDocument();
    });

    it("says it in general words when marking fails without a message", async () => {
      mocks.markOnboardingFeedbackRead.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey read" }));

      expect(await screen.findByText("Couldn't mark the feedback as read.")).toBeInTheDocument();
    });

    it("answers a skip from the journey and from the panel", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey deny" }));
      await waitFor(() =>
        expect(mocks.denyOnboardingSkipRequest).toHaveBeenCalledWith("skip9", "no"),
      );
      expect(await screen.findByText("Skip request declined")).toBeInTheDocument();

      await openStep(user);
      await user.click(screen.getByRole("button", { name: "Panel accept" }));
      await waitFor(() =>
        expect(mocks.acceptOnboardingSkipRequest).toHaveBeenCalledWith("skip-panel", ""),
      );
    });

    it("lets a failed decision be made again, and says why it failed", async () => {
      mocks.denyOnboardingSkipRequest.mockRejectedValueOnce(new Error("busy"));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey deny" }));
      expect(await screen.findByText("busy")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Journey deny" }));

      await waitFor(() => expect(mocks.denyOnboardingSkipRequest).toHaveBeenCalledTimes(2));
    });

    it("says it in general words when a decision fails without a message", async () => {
      mocks.denyOnboardingSkipRequest.mockRejectedValueOnce("nope");
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Journey deny" }));

      expect(await screen.findByText("Couldn't review the skip request.")).toBeInTheDocument();
    });

    it("shows the waiting strip with the unread feedback, counting items", async () => {
      mocks.getTeamMember.mockResolvedValue(member({ hasFeedback: true }));
      mocks.getUserOnboardingFeedback.mockResolvedValue([
        { id: "a", stepId: "st1", message: "one", read: false },
        { id: "b", stepId: "st1", message: "two", read: false },
        { id: "c", stepId: "st1", message: "three", read: true },
      ]);
      renderPage();

      const strip = await screen.findByRole("region", { name: "Waiting on you" });
      expect(within(strip).getByText("2")).toBeInTheDocument();
    });

    it("counts the member's own feedback flag when the list could not load", async () => {
      mocks.getTeamMember.mockResolvedValue(member({ hasFeedback: true }));
      mocks.getUserOnboardingFeedback.mockRejectedValue(new Error("down"));
      renderPage();

      const strip = await screen.findByRole("region", { name: "Waiting on you" });
      expect(within(strip).getByText("1")).toBeInTheDocument();
    });

    it("shows no strip when nothing waits", async () => {
      renderPage();
      await screen.findByLabelText("Alice Smith");

      expect(screen.queryByRole("region", { name: "Waiting on you" })).not.toBeInTheDocument();
    });
  });

  describe("the knowledge checks", () => {
    it("opens a phase's modal on its tab, reads the path again when saved, and closes", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Open questions" }));
      expect(
        await screen.findByText("modal: Phase 1 on questions for Alice Smith"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Modal saved" }));
      await waitFor(() => expect(mocks.getUserOnboardingPath).toHaveBeenCalledTimes(2));

      await user.click(screen.getByRole("button", { name: "Modal close" }));
      await waitFor(() => expect(screen.queryByTestId("check-modal")).not.toBeInTheDocument());
    });

    it("reads the path again when the journey changed it", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Path changed" }));

      await waitFor(() => expect(mocks.getUserOnboardingPath).toHaveBeenCalledTimes(2));
    });
  });

  describe("rebuilding the path", () => {
    async function rebuild(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: /Rebuild path/ }));
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Rebuild path",
        }),
      );
    }

    it("offers to build a path for a member without one", async () => {
      mocks.getUserOnboardingPath.mockResolvedValue(null);
      renderPage();

      expect(await screen.findByRole("button", { name: /Build path/ })).toBeInTheDocument();
    });

    it("cancels the question", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: /Rebuild path/ }));

      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
      );

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onboardingService.rebuildMemberPath).not.toHaveBeenCalled();
    });

    it("says it runs in the background, and that it finished", async () => {
      vi.mocked(onboardingService.rebuildMemberPath).mockImplementation((_p, _u, handlers) => {
        handlers.onDone();
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderPage();

      await rebuild(user);

      expect(await screen.findByText("Rebuilding Alice's onboarding path")).toBeInTheDocument();
      expect(await screen.findByText("Alice's onboarding path was rebuilt")).toBeInTheDocument();
      await waitFor(() => expect(mocks.getTeamMember).toHaveBeenCalledTimes(2));
    });

    it("explains a failure in the manager's words", async () => {
      vi.mocked(onboardingService.rebuildMemberPath).mockImplementation((_p, _u, handlers) => {
        handlers.onError?.("There is no active blueprint", undefined);
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderPage();

      await rebuild(user);

      expect(await screen.findByText("Alice's path could not be rebuilt")).toBeInTheDocument();
      expect(await screen.findByText(/no published onboarding blueprint yet/)).toBeInTheDocument();
    });

    it("says it kept running when the watch was interrupted", async () => {
      vi.mocked(onboardingService.rebuildMemberPath).mockImplementation((_p, _u, handlers) => {
        handlers.onInterrupted?.();
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderPage();

      await rebuild(user);

      expect(await screen.findByText("Lost track of the rebuild")).toBeInTheDocument();
    });

    it("says why starting failed", async () => {
      vi.mocked(onboardingService.rebuildMemberPath).mockRejectedValue(new Error("no stream"));
      const user = userEvent.setup();
      renderPage();

      await rebuild(user);

      expect(await screen.findByText("Alice's path could not be rebuilt")).toBeInTheDocument();
      expect(await screen.findByText("no stream")).toBeInTheDocument();
    });

    it("lets a second rebuild start once the first one finished", async () => {
      vi.mocked(onboardingService.rebuildMemberPath).mockImplementation((_p, _u, handlers) => {
        handlers.onDone();
        return Promise.resolve();
      });
      const user = userEvent.setup();
      renderPage();

      await rebuild(user);
      await waitFor(() => expect(onboardingService.rebuildMemberPath).toHaveBeenCalledTimes(1));
      await rebuild(user);

      await waitFor(() => expect(onboardingService.rebuildMemberPath).toHaveBeenCalledTimes(2));
    });
  });
});
