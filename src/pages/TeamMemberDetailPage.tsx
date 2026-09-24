import { ArrowLeft, Hand } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/useToast";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
} from "../features/onboarding/types";
import type { ProjectRole, TeamOverviewUser } from "../features/team-management/types";
import type { KnowledgeGap } from "../features/knowledge-gaps/types";
import { knowledgeGapService } from "../services/knowledgeGapService";
import {
  assignProjectRoleToUser,
  getProjectRoles,
  getTeamMember,
  unassignProjectRoleFromUser,
  getUserSkillLevels,
  acceptOnboardingSkipRequest,
  denyOnboardingSkipRequest,
  getUserOnboardingFeedback,
  markOnboardingFeedbackRead,
  getUserOnboardingPath,
  createOnboardingTaskForStep,
  deleteOnboardingStep,
  deleteOnboardingTask,
  getOnboardingTasksByStep,
  updateOnboardingTask,
  type OnboardingFeedback,
  type UserSkillLevel,
} from "../services/teamManagementService";

type DetailOnboardingStep = OnboardingStepEndpoint & {
  startedAt?: string | null;
  durationMinutes?: number | null;
  skip?: {
    id?: string;
    status?: string;
    reason?: string;
  } | null;
};

import { Button } from "../components/ui/Button";
import { MemberHero } from "../features/pm-area/components/MemberHero";
import { MemberOpenItems } from "../features/pm-area/components/MemberOpenItems";
import { PmCard, PmCardHeader } from "../features/pm-area/components/PmCard";
import { waitingOn } from "../features/pm-area/memberStatus";
import type { SkipDecision } from "../features/pm-area/useMemberOpenItems";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { PanelPresence } from "../components/ui/PanelPresence";
import { MemberDetailDialogs } from "../features/team-management/components/detail/MemberDetailDialogs";
import { MemberGapsPanel } from "../features/team-management/components/detail/MemberGapsPanel";
import { MemberJourneySection } from "../features/team-management/components/detail/MemberJourneySection";
import { AlertDialog } from "../components/ui/AlertDialog";
import {
  PhaseCheckAdminModal,
  type PhaseCheckAdminTab,
} from "../features/team-management/components/detail/PhaseCheckAdminModal";
import { StepDetailsPanel } from "../features/team-management/components/detail/StepDetailsPanel";
import { useProjectContext } from "../features/projects/useProjectContext";

function BackToTeam({ onBack }: { onBack: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      icon={<ArrowLeft className="h-4 w-4" />}
      className="mb-3 -ml-2"
    >
      Team
    </Button>
  );
}

function formatMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "No estimate";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function getActualMinutes(step: DetailOnboardingStep): number | null {
  if (step.durationMinutes) return step.durationMinutes;

  if (!step.startedAt || !step.completedAt) return null;

  return Math.max(
    1,
    Math.round(
      (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / (1000 * 60),
    ),
  );
}

function getStepStatusStyles(status: string) {
  if (status === "FINISHED") {
    return "border-app-success-border bg-app-success-bg text-app-success-text";
  }

  if (status === "SKIPPED") {
    return "border-app-danger-border bg-app-danger-bg text-app-danger-text";
  }

  if (status === "IN_PROGRESS") {
    return "border-app-brand bg-app-brand-soft text-app-brand-text";
  }

  return "border-app-border bg-app-surface-muted text-app-text-muted";
}

/**
 * A member's full profile, shown inside the PM workspace's Team section (`/team/:userId`).
 */
export function TeamMemberDetailPage({ userId }: { userId?: string }) {
  const { selectedProjectId } = useProjectContext();

  const navigate = useNavigate();

  const [user, setUser] = useState<TeamOverviewUser | undefined>(undefined);
  const [availableRoles, setAvailableRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<ProjectRole | null>(null);
  const [skillLevels, setSkillLevels] = useState<UserSkillLevel[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<OnboardingFeedback[]>([]);
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPathEndpoint | null>(null);
  const [detailStepId, setDetailStepId] = useState("");
  // A step asked to be deleted from the graph, where there is no details panel to confirm in.
  const [graphStepToDelete, setGraphStepToDelete] = useState<string | null>(null);
  const [stepToDelete, setStepToDelete] = useState<DetailOnboardingStep | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<OnboardingTaskEndpoint | null>(null);
  // The phase whose knowledge-check modal is open, and on which tab (null = closed).
  const [checkModal, setCheckModal] = useState<{ phaseId: string; tab: PhaseCheckAdminTab } | null>(
    null,
  );
  const [taskInsertTarget, setTaskInsertTarget] = useState<{
    stepId: string;
    position: number;
  } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [stepActionId, setStepActionId] = useState<string | null>(null);
  const [stepTaskCounts, setStepTaskCounts] = useState<
    Record<string, { done: number; total: number }>
  >({});
  const [stepTasksById, setStepTasksById] = useState<Record<string, OnboardingTaskEndpoint[]>>({});
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [markingFeedbackId, setMarkingFeedbackId] = useState<string | null>(null);
  // Keyed on the skip, not on the page: the same request is answerable from the card below and
  // from the step it belongs to. The ref is the guard (a second click in the same tick still sees
  // it), the state is what disables both controls.
  const skipsInReview = useRef(new Set<string>());
  // Which member the page is about right now, for the refreshes below to check themselves against.
  const shownUserId = useRef(userId);
  useEffect(() => {
    shownUserId.current = userId;
  }, [userId]);
  // Which decision is in flight for which skip, so the button that was pressed shows the spinner.
  const [reviewingSkips, setReviewingSkips] = useState<Readonly<Record<string, SkipDecision>>>({});
  // `feedbackError` stays for the feedback *load* failure (shown inline where the
  // list would be); every action outcome on this page is a toast instead.
  const [feedbackError, setFeedbackError] = useState("");
  const [loadError, setLoadError] = useState("");
  const toast = useToast();
  const { data: roster } = useTeamRoster();

  useEffect(() => {
    // A response for the member (or project) this page has since moved away from is dropped: it
    // would otherwise render member A's journey, with A's step and skip ids, under B's URL.
    let cancelled = false;

    async function loadMember() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");
      setLoadingFeedback(true);

      try {
        const [memberData, rolesData, skills, path, knowledgeGapOverview] = await Promise.all([
          getTeamMember(userId),
          getProjectRoles(),
          getUserSkillLevels(userId),
          getUserOnboardingPath(userId),
          knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
        ]);
        let feedback: OnboardingFeedback[] = [];
        try {
          feedback = await getUserOnboardingFeedback(userId);
        } catch (error) {
          if (!cancelled) {
            setFeedbackError(error instanceof Error ? error.message : "Unable to load feedback.");
          }
        }
        if (cancelled) return;
        applyMember(memberData, rolesData, skills, path, knowledgeGapOverview, feedback);
      } catch (error) {
        if (cancelled) return;
        setUser(undefined);
        setLoadError(
          error instanceof Error ? error.message : "The team member could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoadingFeedback(false);
          setLoading(false);
        }
      }
    }

    function applyMember(
      memberData: Awaited<ReturnType<typeof getTeamMember>>,
      rolesData: Awaited<ReturnType<typeof getProjectRoles>>,
      skills: Awaited<ReturnType<typeof getUserSkillLevels>>,
      path: Awaited<ReturnType<typeof getUserOnboardingPath>>,
      knowledgeGapOverview: Awaited<ReturnType<typeof knowledgeGapService.fetchKnowledgeGaps>>,
      feedback: OnboardingFeedback[],
    ) {
      setUser(memberData);
      setAvailableRoles(rolesData);
      setSkillLevels(skills);
      // Covered components are dropped rather than shown: the overview is the
      // project's full roster now, but this panel is headed "Knowledge gaps"
      // and counting repositories that are missing nothing would overstate
      // what the member has to answer for.
      setKnowledgeGaps(knowledgeGapOverview.gaps.filter((gap) => gap.severity !== "covered"));
      setFeedbackItems(feedback);
      setOnboardingPath(path);
    }

    void loadMember();
    return () => {
      cancelled = true;
    };
    // Knowledge gaps are project-scoped, so switching projects has to reload them —
    // otherwise this page keeps showing the previous project's gaps for the member.
  }, [userId, selectedProjectId]);

  useEffect(() => {
    // Re-run on every path change (each PM edit); an older run finishing last must not win.
    let cancelled = false;

    async function loadPathTaskCounts() {
      const steps = onboardingPath?.phases.flatMap((phase) => phase.steps ?? []) ?? [];

      if (steps.length === 0) {
        setStepTaskCounts({});
        // Cleared together: leaving the lists behind meant the previous member's tasks survived a
        // switch to a member with no steps at all.
        setStepTasksById({});
        return;
      }

      // Settled, not all-or-nothing: one step's request failing used to blank every count on the
      // page, including the ones that had just been read successfully.
      const results = await Promise.allSettled(
        steps.map(async (step) => {
          const tasks = await getOnboardingTasksByStep(step.id);

          return [step.id, tasks] as const;
        }),
      );
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        console.error(
          `Failed to load the tasks of ${failures.length} of ${steps.length} steps:`,
          failures[0].reason,
        );
      }
      const taskEntries = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const tasksByStepId = Object.fromEntries(taskEntries);
      const counts = Object.fromEntries(
        taskEntries.map(([stepId, tasks]) => [
          stepId,
          {
            done: tasks.filter((task) => task.finished).length,
            total: tasks.length,
          },
        ]),
      );

      if (cancelled) return;
      setStepTasksById(tasksByStepId);
      setStepTaskCounts(counts);
    }

    void loadPathTaskCounts().catch((error: unknown) => {
      console.error("Failed to load the member's task counts:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [onboardingPath]);

  /**
   * The three post-action refreshes, each dropped when the page has moved on to another member.
   *
   * The initial load has the same guard and names the risk: member A's journey, with A's step and
   * skip ids, rendered under B's URL -- after which the next action sends A's ids. These run from
   * every action handler, so they need it just as much.
   */
  async function refreshMember() {
    if (!userId) return;
    const forUser = userId;

    const memberData = await getTeamMember(forUser);
    if (shownUserId.current !== forUser) return;
    setUser(memberData);
  }

  async function refreshFeedback() {
    if (!userId) return;
    const forUser = userId;

    setLoadingFeedback(true);
    setFeedbackError("");

    try {
      const feedback = await getUserOnboardingFeedback(forUser);
      if (shownUserId.current !== forUser) return;
      setFeedbackItems(feedback);
    } catch (error) {
      if (shownUserId.current !== forUser) return;
      setFeedbackError(error instanceof Error ? error.message : "Unable to load feedback.");
    } finally {
      if (shownUserId.current === forUser) setLoadingFeedback(false);
    }
  }

  async function refreshOnboardingPath() {
    if (!userId) return;
    const forUser = userId;

    const path = await getUserOnboardingPath(forUser);
    if (shownUserId.current !== forUser) return;
    setOnboardingPath(path);
  }

  const unassignedRoles = useMemo(() => {
    if (!user) return [];

    return availableRoles.filter(
      (role) => !user.roles.some((assignedRole) => assignedRole.id === role.id),
    );
  }, [availableRoles, user]);

  async function handleAddRole(roleId: string) {
    if (!user) return;

    const roleToAdd = availableRoles.find((role) => role.id === roleId);

    if (!roleToAdd) return;

    setSavingRoleId(roleId);

    try {
      await assignProjectRoleToUser(user.userId, roleId);
      setUser({
        ...user,
        roles: [...user.roles, roleToAdd],
      });
      toast.success("Role assigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't assign the role.");
    } finally {
      setSavingRoleId(null);
    }
  }

  async function handleRemoveRole(roleId: string) {
    if (!user) return;

    setSavingRoleId(roleId);

    try {
      await unassignProjectRoleFromUser(user.userId, roleId);
      setUser({
        ...user,
        roles: user.roles.filter((role) => role.id !== roleId),
      });
      toast.success("Role removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove the role.");
    } finally {
      setSavingRoleId(null);
    }
  }

  /**
   * Answers a skip request -- the current step's from the card below, or any step's from where the
   * step is shown. Phases run side by side, so the one waiting is not always the current step.
   *
   * One decision per request, and only one in flight: both surfaces can be on screen at once, the
   * answer cannot be retried once it is in, and a skip accepted and declined within the same
   * second would be settled by whichever call the server happened to finish last.
   */
  async function reviewSkip(skipId: string, action: "accept" | "deny", comment = "") {
    if (skipsInReview.current.has(skipId)) return;
    skipsInReview.current.add(skipId);
    setReviewingSkips((current) => ({ ...current, [skipId]: action }));
    const release = () => {
      skipsInReview.current.delete(skipId);
      setReviewingSkips((current) => {
        const next = { ...current };
        delete next[skipId];
        return next;
      });
    };

    try {
      if (action === "accept") {
        await acceptOnboardingSkipRequest(skipId, comment);
      } else {
        await denyOnboardingSkipRequest(skipId, comment);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't review the skip request.");
      // Only a decision that never landed can be made again.
      release();
      return;
    }

    toast.success(action === "accept" ? "Skip request approved" : "Skip request declined");
    // Told apart from a failed decision: the answer is in, and retrying it would be refused.
    try {
      await Promise.all([refreshMember(), refreshOnboardingPath()]);
      // Held until here, not released when the request came back: until the refresh lands, both
      // surfaces still draw the request as pending, and a second decision would be sent against
      // one the server has already answered.
      release();
    } catch {
      toast.error("The answer was saved, but the page could not refresh. Reload to see it.");
      // The guard stays on for good in this case, for the same reason: what is on screen is a
      // request that has in fact been answered.
    }
  }

  async function handleDeleteStep(step: DetailOnboardingStep) {
    setStepActionId(step.id);

    try {
      await deleteOnboardingStep(step.id);
      setStepToDelete(null);
      if (detailStepId === step.id) {
        setDetailStepId("");
      }
      // The member too: the deleted step may have been their current one.
      await Promise.all([refreshOnboardingPath(), refreshMember()]);
      toast.success("Step deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the step.");
    } finally {
      setStepActionId(null);
    }
  }

  async function refreshStepTasks(stepId: string) {
    const nextTasks = await getOnboardingTasksByStep(stepId);

    setStepTasksById((current) => ({
      ...current,
      [stepId]: nextTasks,
    }));
    setStepTaskCounts((current) => ({
      ...current,
      [stepId]: {
        done: nextTasks.filter((item) => item.finished).length,
        total: nextTasks.length,
      },
    }));

    return nextTasks;
  }

  async function handleReorderTasks(stepId: string, activeTaskId: string, overTaskId: string) {
    if (activeTaskId === overTaskId) return;
    // A second drag while the first is still being written would compute its move from the
    // optimistic list and send positions against the same stale state.
    if (stepActionId === stepId) return;

    const currentTasks = [...(stepTasksById[stepId] ?? [])].sort((a, b) => a.position - b.position);
    const activeIndex = currentTasks.findIndex((task) => task.id === activeTaskId);
    const overIndex = currentTasks.findIndex((task) => task.id === overTaskId);

    if (activeIndex < 0 || overIndex < 0) return;

    const reorderedTasks = [...currentTasks];
    const [movedTask] = reorderedTasks.splice(activeIndex, 1);
    reorderedTasks.splice(overIndex, 0, movedTask);

    const nextTasks = reorderedTasks.map((task, index) => ({
      ...task,
      position: index,
    }));
    const changedTasks = nextTasks.filter(
      (task) =>
        currentTasks.find((currentTask) => currentTask.id === task.id)?.position !== task.position,
    );

    setStepActionId(stepId);
    setStepTasksById((current) => ({
      ...current,
      [stepId]: nextTasks,
    }));

    try {
      // One request per moved task: there is no batch endpoint, so a failure halfway through
      // leaves the ones before it written. The refresh in both branches is what the list then
      // shows -- the server's order, not this optimistic one.
      for (const task of changedTasks) {
        await updateOnboardingTask(task.id, {
          position: task.position,
          title: task.title,
          description: task.description,
          finished: task.finished,
        });
      }

      await refreshStepTasks(stepId);
    } catch (error) {
      toast.error("The new order could not be saved in full", {
        description:
          error instanceof Error
            ? `${error.message} The list now shows what the server has.`
            : "The list now shows what the server has.",
      });
      await refreshStepTasks(stepId);
    } finally {
      setStepActionId(null);
    }
  }

  async function handleDeleteTask(task: OnboardingTaskEndpoint) {
    setStepActionId(task.stepId);

    try {
      await deleteOnboardingTask(task.id);
      setTaskToDelete(null);
      await refreshStepTasks(task.stepId);
      await refreshOnboardingPath();
      toast.success("Task deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the task.");
    } finally {
      setStepActionId(null);
    }
  }

  async function handleCreateTask() {
    if (!taskInsertTarget || !newTaskTitle.trim()) return;

    setAddingTask(true);
    setStepActionId(taskInsertTarget.stepId);

    try {
      await createOnboardingTaskForStep(taskInsertTarget.stepId, {
        position: taskInsertTarget.position,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        finished: false,
      });

      setTaskInsertTarget(null);
      setNewTaskTitle("");
      setNewTaskDescription("");
      await refreshStepTasks(taskInsertTarget.stepId);
      // Adding a task reopens a completed step on the backend (status back to
      // IN_PROGRESS). Refresh the path so the step cards update, and the team-overview
      // member data so the header progress bar and current step reflect the change too.
      await Promise.all([refreshOnboardingPath(), refreshMember()]);
      toast.success("Task added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the task.");
    } finally {
      setAddingTask(false);
      setStepActionId(null);
    }
  }

  async function handleMarkFeedbackRead(feedbackId: string) {
    setMarkingFeedbackId(feedbackId);

    try {
      await markOnboardingFeedbackRead(feedbackId);
      setFeedbackItems((current) =>
        current.map((feedback) =>
          feedback.id === feedbackId ? { ...feedback, read: true } : feedback,
        ),
      );
      await Promise.all([refreshFeedback(), refreshMember()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't mark the feedback as read.");
    } finally {
      setMarkingFeedbackId(null);
    }
  }

  // Always to the roster, not back through history: the button says "Team", and history could
  // just as well lead to the overview or to the previous member.
  function goBack() {
    void navigate("/team-management");
  }

  // Loading and not-found keep the back button, so it never disappears and reappears while the
  // member loads.
  if (loading || !user) {
    return (
      <section aria-label="Team member">
        <BackToTeam onBack={goBack} />
        {loading ? (
          <div className="flex min-h-96 items-center justify-center">
            <p className="text-sm text-app-text-muted">Loading team member...</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-app-border bg-app-surface p-8">
            <p className="text-sm text-app-text">
              {loadError
                ? `The team member could not be loaded: ${loadError}`
                : "Team member not found."}
            </p>
          </div>
        )}
      </section>
    );
  }

  const openItemCount = waitingOn(user).length;
  const phases = [...(onboardingPath?.phases ?? [])].sort((a, b) => a.position - b.position);
  const allSteps = phases.flatMap((phase) =>
    [...(phase.steps ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((step) => step as DetailOnboardingStep),
  );
  const checkModalPhase = checkModal
    ? (phases.find((phase) => phase.id === checkModal.phaseId) ?? null)
    : null;
  const detailStep = allSteps.find((step) => step.id === detailStepId) ?? null;
  const detailStepTasks = detailStep ? (stepTasksById[detailStep.id] ?? []) : [];
  const sortedDetailStepTasks = [...detailStepTasks].sort((a, b) => a.position - b.position);
  const detailStepDoneTasks = detailStepTasks.filter((task) => task.finished).length;
  const detailStepActualMinutes = detailStep ? getActualMinutes(detailStep) : null;

  const detailStepFeedback = detailStep
    ? feedbackItems
        .filter((feedback) => feedback.stepId === detailStep.id)
        .map((feedback) => ({
          ...feedback,
          helpful:
            feedback.helpful ??
            (detailStep.feedback?.id === feedback.id ? detailStep.feedback.helpful : undefined),
        }))
    : [];
  const displayedDetailStepFeedback =
    detailStepFeedback.length > 0 || !detailStep?.feedback
      ? detailStepFeedback
      : [
          {
            id: detailStep.feedback.id,
            stepId: detailStep.id,
            stepTitle: detailStep.title,
            message: detailStep.feedback.comment,
            helpful: detailStep.feedback.helpful,
            createdAt: detailStep.feedback.createdAt,
          },
        ];
  const detailStepSkipReason = detailStep?.skip?.reason || "";
  const skillGaps = skillLevels.filter(
    (skill) => skill.level === "BEGINNER" || skill.level === "INTERMEDIATE",
  );
  const severityOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const topKnowledgeGaps = [...knowledgeGaps]
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
    .slice(0, 3);

  return (
    <>
      <section aria-label={`${user.firstname} ${user.lastname}`}>
        <BackToTeam onBack={goBack} />
        <div className="mb-5">
          <MemberHero
            member={user}
            roster={roster ?? []}
            assignableRoles={unassignedRoles}
            savingRoleId={savingRoleId}
            onAddRole={(roleId) => void handleAddRole(roleId)}
            onRemoveRole={setRoleToRemove}
          />
        </div>
        <div className="space-y-5">
          {/* Only while something is open: an empty "waiting on you" card at the top of every
              profile would push the path down to say nothing. Fed from this page's own feedback
              and skip handling, so it shares the guard with the journey and the step panel. */}
          {openItemCount > 0 && (
            <PmCard aria-label="Waiting on you" tone="warning">
              <PmCardHeader
                icon={Hand}
                tone="warning"
                title="Waiting on you"
                meta={`${openItemCount} open`}
              />
              <MemberOpenItems
                member={user}
                feedback={feedbackItems}
                feedbackLoading={loadingFeedback}
                feedbackError={Boolean(feedbackError)}
                reviewingSkip={
                  user.currentStep?.skip?.id
                    ? (reviewingSkips[user.currentStep.skip.id] ?? null)
                    : null
                }
                markingFeedbackId={markingFeedbackId}
                onReviewSkip={(skipId, decision) => void reviewSkip(skipId, decision)}
                onMarkRead={(feedbackId) => void handleMarkFeedbackRead(feedbackId)}
              />
            </PmCard>
          )}

          <MemberJourneySection
            userId={user.userId}
            memberName={`${user.firstname} ${user.lastname}`.trim()}
            path={onboardingPath}
            stepTaskCounts={stepTaskCounts}
            onOpenStep={setDetailStepId}
            onOpenQuestions={(phaseId, tab) => setCheckModal({ phaseId, tab })}
            onDeleteStep={setGraphStepToDelete}
            onReviewSkip={reviewSkip}
            feedbackItems={feedbackItems}
            onMarkFeedbackRead={(feedbackId) => void handleMarkFeedbackRead(feedbackId)}
            markingFeedbackId={markingFeedbackId}
            onPathChanged={refreshOnboardingPath}
          />

          {/* Below the journey rather than beside it: the graph needs the width. */}
          <aside aria-label="Member insights">
            <MemberGapsPanel
              skillLevels={skillLevels}
              skillGaps={skillGaps}
              knowledgeGaps={topKnowledgeGaps}
              onOpenKnowledgeGap={(gapId) => {
                void navigate(`/insights/knowledge-gaps/${gapId}`);
              }}
            />
          </aside>
        </div>
      </section>
      <MemberDetailDialogs
        firstName={user.firstname}
        roleToRemove={roleToRemove}
        savingRoleId={savingRoleId}
        onCancelRoleRemove={() => setRoleToRemove(null)}
        onConfirmRoleRemove={(role) => {
          void handleRemoveRole(role.id);
          setRoleToRemove(null);
        }}
      />
      {checkModal && checkModalPhase && userId && (
        <PhaseCheckAdminModal
          userId={userId}
          phaseId={checkModalPhase.id}
          phaseTitle={checkModalPhase.title}
          memberName={`${user.firstname} ${user.lastname}`.trim()}
          initialTab={checkModal.tab}
          onSaved={() => void refreshOnboardingPath()}
          onClose={() => setCheckModal(null)}
        />
      )}
      <AlertDialog
        isOpen={graphStepToDelete !== null}
        title="Delete this step?"
        description={`"${allSteps.find((step) => step.id === graphStepToDelete)?.title ?? "The step"}" is removed from ${user.firstname}'s path. Whatever waited on it waits on what it waited on instead.`}
        confirmLabel="Delete step"
        variant="danger"
        isLoading={stepActionId === graphStepToDelete}
        onClose={() => setGraphStepToDelete(null)}
        onConfirm={() => {
          const step = allSteps.find((candidate) => candidate.id === graphStepToDelete);
          // Gone since the dialog opened (a refetch): nothing left to delete, so just close.
          if (!step) setGraphStepToDelete(null);
          else void handleDeleteStep(step).finally(() => setGraphStepToDelete(null));
        }}
      />
      <PanelPresence value={detailStep}>
        {(step) => (
          <StepDetailsPanel
            step={step}
            tasks={sortedDetailStepTasks}
            doneTaskCount={detailStepDoneTasks}
            actualMinutes={detailStepActualMinutes}
            feedbackItems={displayedDetailStepFeedback}
            skipReason={detailStepSkipReason}
            taskInsertTarget={taskInsertTarget}
            newTaskTitle={newTaskTitle}
            newTaskDescription={newTaskDescription}
            addingTask={addingTask}
            stepActionId={stepActionId}
            stepToDelete={stepToDelete}
            taskToDelete={taskToDelete}
            onClose={() => setDetailStepId("")}
            onRequestDeleteStep={(step: DetailOnboardingStep) => setStepToDelete(step)}
            onCancelDeleteStep={() => setStepToDelete(null)}
            onConfirmDeleteStep={(step: DetailOnboardingStep) => void handleDeleteStep(step)}
            onRequestDeleteTask={(task: OnboardingTaskEndpoint) => setTaskToDelete(task)}
            onCancelDeleteTask={() => setTaskToDelete(null)}
            onConfirmDeleteTask={(task: OnboardingTaskEndpoint) => void handleDeleteTask(task)}
            onTaskInsertTargetChange={setTaskInsertTarget}
            onNewTaskTitleChange={setNewTaskTitle}
            onNewTaskDescriptionChange={setNewTaskDescription}
            onCreateTask={() => void handleCreateTask()}
            formatMinutes={formatMinutes}
            getStepStatusStyles={getStepStatusStyles}
            onReviewSkip={reviewSkip}
            onMarkFeedbackRead={(feedbackId) => void handleMarkFeedbackRead(feedbackId)}
            markingFeedbackId={markingFeedbackId}
            onReorderTasks={(activeTaskId, overTaskId) =>
              void handleReorderTasks(step.id, activeTaskId, overTaskId)
            }
          />
        )}
      </PanelPresence>
    </>
  );
}
