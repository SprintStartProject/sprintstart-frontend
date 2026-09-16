import { Inbox, Plus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../context/useToast";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
} from "../features/onboarding/types";
import { findActivePhaseIndex } from "../features/onboarding/activePhase";
import type { ProjectRole, TeamOverviewUser } from "../features/team-management/types";
import type { KnowledgeGap } from "../features/knowledge-gaps/types";
import { knowledgeGapService } from "../services/knowledgeGapService";
import {
  assignProjectRoleToUser,
  getProjectRoles,
  getTeamMember,
  unassignProjectRoleFromUser,
  getUserSkillLevels,
  getUserOnboardingPath,
  createOnboardingStepForPhase,
  createOnboardingTaskForStep,
  deleteOnboardingStep,
  deleteOnboardingTask,
  getOnboardingTasksByStep,
  updateOnboardingStep,
  updateOnboardingTask,
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
import { FilterSelect } from "../components/ui/FilterSelect";
import { Modal } from "../components/ui/Modal";
import { MemberHero } from "../features/pm-area/components/MemberHero";
import { MemberOpenItems } from "../features/pm-area/components/MemberOpenItems";
import { PmCard, PmCardHeader } from "../features/pm-area/components/PmCard";
import { PmPageShell } from "../features/pm-area/components/PmPageShell";
import { waitingOn } from "../features/pm-area/memberStatus";
import { useMemberOpenItems } from "../features/pm-area/useMemberOpenItems";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { PanelPresence } from "../components/ui/PanelPresence";
import { AddCustomStepModal } from "../features/team-management/components/detail/AddCustomStepModal";
import { MemberDetailDialogs } from "../features/team-management/components/detail/MemberDetailDialogs";
import { MemberGapsPanel } from "../features/team-management/components/detail/MemberGapsPanel";
import { MemberOnboardingSection } from "../features/team-management/components/detail/MemberOnboardingSection";
import { MemberReviewPoolPanel } from "../features/team-management/components/detail/MemberReviewPoolPanel";
import {
  PhaseCheckAdminModal,
  type PhaseCheckAdminTab,
} from "../features/team-management/components/detail/PhaseCheckAdminModal";
import { StepDetailsPanel } from "../features/team-management/components/detail/StepDetailsPanel";
import { useProjectContext } from "../features/projects/useProjectContext";

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

export function TeamMemberDetailPage() {
  const { selectedProjectId } = useProjectContext();
  const { userId } = useParams<{ userId: string }>();

  const navigate = useNavigate();

  const [user, setUser] = useState<TeamOverviewUser | undefined>(undefined);
  const [availableRoles, setAvailableRoles] = useState<ProjectRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<ProjectRole | null>(null);
  const [skillLevels, setSkillLevels] = useState<UserSkillLevel[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPathEndpoint | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedStepId, setSelectedStepId] = useState("");
  const [detailStepId, setDetailStepId] = useState("");
  const [stepToDelete, setStepToDelete] = useState<DetailOnboardingStep | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<OnboardingTaskEndpoint | null>(null);
  const [stepInsertTarget, setStepInsertTarget] = useState<{
    phaseId: string;
    position: number;
  } | null>(null);
  // Which tab of the knowledge-check modal is open for the selected phase (null = closed).
  const [checkModalTab, setCheckModalTab] = useState<PhaseCheckAdminTab | null>(null);
  const [customStepTitle, setCustomStepTitle] = useState("");
  const [customStepDescription, setCustomStepDescription] = useState("");
  const [customStepExpectedOutcome, setCustomStepExpectedOutcome] = useState("");
  const [customStepMinutes, setCustomStepMinutes] = useState("30");
  const [customStepTasks, setCustomStepTasks] = useState<
    Array<{ title: string; description: string }>
  >([{ title: "", description: "" }]);
  const [addingStep, setAddingStep] = useState(false);
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
  const toast = useToast();
  const { data: roster } = useTeamRoster();
  // Skip decisions and feedback, shared with the member side panel. This page reads its member
  // through `getTeamMember` rather than the roster, so it reloads both itself after an answer.
  const openItems = useMemberOpenItems(userId ?? null, () =>
    Promise.all([refreshMember(), refreshOnboardingPath()]),
  );

  useEffect(() => {
    async function loadMember() {
      if (!userId) {
        setLoading(false);
        return;
      }

      const [memberData, rolesData, skills, path, knowledgeGapOverview] = await Promise.all([
        getTeamMember(userId),
        getProjectRoles(),
        getUserSkillLevels(userId),
        getUserOnboardingPath(userId),
        knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
      ]);
      setUser(memberData);
      setAvailableRoles(rolesData);
      setSkillLevels(skills);
      // Covered components are dropped rather than shown: the overview is the
      // project's full roster now, but this panel is headed "Knowledge gaps"
      // and counting repositories that are missing nothing would overstate
      // what the member has to answer for.
      setKnowledgeGaps(knowledgeGapOverview.gaps.filter((gap) => gap.severity !== "covered"));
      setOnboardingPath(path);
      // Open on the phase the member is actually working on. Phase 1 is almost never
      // the interesting one for a reviewer, and it hides how far along they really are.
      const activePhase = path?.phases?.[findActivePhaseIndex(path)];
      setSelectedPhaseId(activePhase?.id ?? "");
      setSelectedStepId(memberData?.currentStep?.id ?? activePhase?.steps?.[0]?.id ?? "");
      setLoading(false);
    }

    void loadMember();
    // Knowledge gaps are project-scoped, so switching projects has to reload them —
    // otherwise this page keeps showing the previous project's gaps for the member.
  }, [userId, selectedProjectId]);

  useEffect(() => {
    async function loadPathTaskCounts() {
      const steps = onboardingPath?.phases.flatMap((phase) => phase.steps ?? []) ?? [];

      if (steps.length === 0) {
        setStepTaskCounts({});
        return;
      }

      const taskEntries = await Promise.all(
        steps.map(async (step) => {
          const tasks = await getOnboardingTasksByStep(step.id);

          return [step.id, tasks] as const;
        }),
      );
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

      setStepTasksById(tasksByStepId);
      setStepTaskCounts(counts);
    }

    void loadPathTaskCounts();
  }, [onboardingPath]);

  async function refreshMember() {
    if (!userId) return;

    const memberData = await getTeamMember(userId);
    setUser(memberData);
  }

  async function refreshOnboardingPath() {
    if (!userId) return;

    const path = await getUserOnboardingPath(userId);
    setOnboardingPath(path);

    // Only when the selected phase disappeared; fall back to the active one rather than
    // to phase 1, for the same reason as on load.
    if (path?.phases?.length && !path.phases.some((phase) => phase.id === selectedPhaseId)) {
      setSelectedPhaseId(path.phases[findActivePhaseIndex(path)].id);
    }

    const refreshedSteps = path?.phases.flatMap((phase) => phase.steps ?? []) ?? [];
    if (refreshedSteps.length && !refreshedSteps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(refreshedSteps[0].id);
    }
  }

  const unassignedRoles = useMemo(() => {
    if (!user) return [];

    return availableRoles.filter(
      (role) => !user.roles.some((assignedRole) => assignedRole.id === role.id),
    );
  }, [availableRoles, user]);

  async function handleAddRole() {
    if (!user || !selectedRoleId) return;

    const roleToAdd = availableRoles.find((role) => role.id === selectedRoleId);

    if (!roleToAdd) return;

    setSavingRoleId(selectedRoleId);

    try {
      await assignProjectRoleToUser(user.userId, selectedRoleId);
      setUser({
        ...user,
        roles: [...user.roles, roleToAdd],
      });
      setSelectedRoleId("");
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

  async function handleDeleteStep(step: DetailOnboardingStep) {
    setStepActionId(step.id);

    try {
      await deleteOnboardingStep(step.id);
      setStepToDelete(null);
      if (detailStepId === step.id) {
        setDetailStepId("");
      }
      await refreshOnboardingPath();
      toast.success("Step deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the step.");
    } finally {
      setStepActionId(null);
    }
  }

  async function handleReorderSteps(phaseId: string, activeStepId: string, overStepId: string) {
    if (activeStepId === overStepId) return;

    const phase = onboardingPath?.phases.find((item) => item.id === phaseId);
    const currentSteps = [...(phase?.steps ?? [])].sort((a, b) => a.position - b.position);
    const activeIndex = currentSteps.findIndex((step) => step.id === activeStepId);
    const overIndex = currentSteps.findIndex((step) => step.id === overStepId);

    if (!phase || activeIndex < 0 || overIndex < 0) return;

    const reorderedSteps = [...currentSteps];
    const [movedStep] = reorderedSteps.splice(activeIndex, 1);
    reorderedSteps.splice(overIndex, 0, movedStep);

    const nextSteps = reorderedSteps.map((step, index) => ({
      ...step,
      position: index,
    }));
    const changedSteps = nextSteps.filter(
      (step) =>
        currentSteps.find((currentStep) => currentStep.id === step.id)?.position !== step.position,
    );

    setStepActionId(activeStepId);
    setOnboardingPath((currentPath) =>
      currentPath
        ? {
            ...currentPath,
            phases: currentPath.phases.map((currentPhase) =>
              currentPhase.id === phaseId
                ? {
                    ...currentPhase,
                    steps: nextSteps,
                  }
                : currentPhase,
            ),
          }
        : currentPath,
    );

    try {
      for (const step of changedSteps) {
        await updateOnboardingStep(step.id, {
          position: step.position,
          title: step.title,
          description: step.description,
          type: step.type,
          estimatedMinutes: step.estimatedMinutes,
          expectedOutcome: step.expectedOutcomes?.[0] ?? "",
          status: step.status,
          skip: step.skip ?? null,
        });
      }

      await refreshOnboardingPath();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reorder the steps.");
      await refreshOnboardingPath();
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
      toast.error(error instanceof Error ? error.message : "Couldn't reorder the tasks.");
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

  async function handleCreateCustomStep() {
    const targetPhaseId = stepInsertTarget?.phaseId ?? selectedPhaseId;

    if (!targetPhaseId || !customStepTitle.trim()) return;

    const selectedPhase = onboardingPath?.phases.find((phase) => phase.id === targetPhaseId);

    if (!selectedPhase) return;

    setAddingStep(true);

    try {
      const createdStep = await createOnboardingStepForPhase(targetPhaseId, {
        position: stepInsertTarget?.position ?? selectedPhase.steps?.length ?? 0,
        isAiAssisted: false,
        title: customStepTitle.trim(),
        description: customStepDescription.trim(),
        type: "TASK",
        estimatedMinutes: Number(customStepMinutes) || 30,
        expectedOutcome: customStepExpectedOutcome.trim(),
      });
      const tasksToCreate = customStepTasks
        .map((task) => ({
          title: task.title.trim(),
          description: task.description.trim(),
        }))
        .filter((task) => task.title.length > 0);

      // Create tasks sequentially: the backend validates each task's position
      // against the current task count, so creating them in parallel makes every
      // task after the first fail ("Position must be between 0 and 0").
      for (const [index, task] of tasksToCreate.entries()) {
        await createOnboardingTaskForStep(createdStep.id, {
          position: index,
          title: task.title,
          description: task.description,
          finished: false,
        });
      }

      setCustomStepTitle("");
      setCustomStepDescription("");
      setCustomStepExpectedOutcome("");
      setCustomStepMinutes("30");
      setCustomStepTasks([{ title: "", description: "" }]);
      setStepInsertTarget(null);
      setSelectedStepId(createdStep.id);
      setDetailStepId(createdStep.id);
      await refreshOnboardingPath();
      if (tasksToCreate.length > 0) {
        await refreshStepTasks(createdStep.id);
      }
      toast.success("Step added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create the custom onboarding step.",
      );
    } finally {
      setAddingStep(false);
    }
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      void navigate(-1);
    } else {
      void navigate("/team-management");
    }
  }

  // Loading and not-found share the shell with the success render below, so the band (and the
  // section bar in it) never disappears and reappears while the member loads.
  if (loading || !user) {
    return (
      <PmPageShell icon={Users} title="Team member" subtitle="">
        {loading ? (
          <div className="flex min-h-96 items-center justify-center">
            <p className="text-sm text-app-text-muted">Loading team member...</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-app-border bg-app-surface p-8">
            <p className="text-sm text-app-text">Team member not found.</p>
          </div>
        )}
      </PmPageShell>
    );
  }

  const openItemCount = waitingOn(user).length;
  const phases = [...(onboardingPath?.phases ?? [])].sort((a, b) => a.position - b.position);
  const allSteps = phases.flatMap((phase) =>
    [...(phase.steps ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((step) => step as DetailOnboardingStep),
  );
  const finishedSteps = allSteps.filter((step) => step.status === "FINISHED").length;
  const skippedSteps = allSteps.filter((step) => step.status === "SKIPPED").length;
  const pathPendingSkips = allSteps.filter((step) => step.skip?.status === "PENDING").length;
  const estimatedMinutes = allSteps.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
  const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0];
  const selectedPhaseSteps = [...(selectedPhase?.steps ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((step) => step as DetailOnboardingStep);
  const selectedStep =
    allSteps.find((step) => step.id === selectedStepId) ?? selectedPhaseSteps[0] ?? null;
  const detailStep = allSteps.find((step) => step.id === detailStepId) ?? null;
  const detailStepTasks = detailStep ? (stepTasksById[detailStep.id] ?? []) : [];
  const sortedDetailStepTasks = [...detailStepTasks].sort((a, b) => a.position - b.position);
  const detailStepDoneTasks = detailStepTasks.filter((task) => task.finished).length;
  const detailStepActualMinutes = detailStep ? getActualMinutes(detailStep) : null;

  const detailStepFeedback = detailStep
    ? openItems.feedback
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
  const nextStep =
    allSteps.find((step) => step.status !== "FINISHED" && step.status !== "SKIPPED") ?? null;

  return (
    <>
      <PmPageShell
        icon={Users}
        title={`${user.firstname} ${user.lastname}`}
        subtitle={
          user.roles.length > 0
            ? `${user.roles.map((role) => role.name).join(", ")} · full profile`
            : "Full profile"
        }
        back={{ label: "Back", onClick: goBack }}
        bandExtra={
          <MemberHero
            member={user}
            roster={roster ?? []}
            onEditRoles={() => setRolesModalOpen(true)}
          />
        }
      >
        <div className="space-y-5">
          {/* Only while something is open: an empty "waiting on you" card at the top of every
              profile would push the path down to say nothing. */}
          {openItemCount > 0 && (
            <PmCard aria-label="Waiting on you">
              <PmCardHeader icon={Inbox} title="Waiting on you" meta={`${openItemCount} open`} />
              <MemberOpenItems
                member={user}
                feedback={openItems.feedback}
                feedbackLoading={openItems.feedbackLoading}
                feedbackError={openItems.feedbackError}
                reviewingSkip={openItems.reviewingSkip}
                markingFeedbackId={openItems.markingFeedbackId}
                onReviewSkip={(skipId, decision) => void openItems.reviewSkip(skipId, decision)}
                onMarkRead={(feedbackId) => void openItems.markRead(feedbackId)}
              />
            </PmCard>
          )}

          <MemberOnboardingSection
            phases={phases}
            selectedPhase={selectedPhase}
            selectedPhaseSteps={selectedPhaseSteps}
            selectedStep={selectedStep}
            nextStep={nextStep}
            finishedSteps={finishedSteps}
            totalSteps={allSteps.length}
            estimatedMinutes={estimatedMinutes}
            skippedSteps={skippedSteps}
            pendingSkipCount={pathPendingSkips}
            stepTaskCounts={stepTaskCounts}
            onSelectPhase={(phaseId, firstStepId) => {
              setSelectedPhaseId(phaseId);
              setSelectedStepId(firstStepId);
            }}
            onSelectStep={(stepId) => {
              setSelectedStepId(stepId);
              setDetailStepId(stepId);
            }}
            onAddStep={setStepInsertTarget}
            onReorderSteps={(phaseId, activeStepId, overStepId) =>
              void handleReorderSteps(phaseId, activeStepId, overStepId)
            }
            onOpenCheck={setCheckModalTab}
            formatMinutes={formatMinutes}
            getActualMinutes={getActualMinutes}
            getStepStatusStyles={getStepStatusStyles}
          />

          {/* Below the path rather than beside it: the path needs the width, and these read
              fine as a row of cards. items-start keeps each card at its own height. */}
          <aside aria-label="Member insights" className="grid items-start gap-5 lg:grid-cols-3">
            {userId && <MemberReviewPoolPanel userId={userId} />}
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
      </PmPageShell>
      <Modal
        isOpen={rolesModalOpen}
        title="Manage roles"
        description={`Add or remove roles for ${user.firstname}.`}
        closeLabel="Close roles modal"
        onClose={() => setRolesModalOpen(false)}
      >
        <ul className="divide-y divide-app-border-muted rounded-2xl border border-app-border">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <li key={role.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-app-text">{role.name}</span>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  iconOnly
                  onClick={() => setRoleToRemove(role)}
                  disabled={savingRoleId === role.id}
                  aria-label={`Remove ${role.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-app-text-muted">
              No role assigned yet. Choose a role below.
            </li>
          )}
        </ul>

        <div className="mt-5 flex gap-2">
          <FilterSelect
            label="Choose a role to add"
            value={selectedRoleId}
            options={[
              { value: "", label: "Choose role" },
              ...unassignedRoles.map((role) => ({ value: role.id, label: role.name })),
            ]}
            onChange={setSelectedRoleId}
            disabled={unassignedRoles.length === 0}
            className="min-w-0 flex-1"
          />
          <Button
            variant="primary"
            onClick={() => void handleAddRole()}
            disabled={!selectedRoleId || savingRoleId !== null}
            icon={<Plus className="h-4 w-4" />}
          >
            Add
          </Button>
        </div>

        {unassignedRoles.length === 0 && (
          <p className="mt-3 text-xs text-app-text-muted">
            All available roles are already assigned.
          </p>
        )}
      </Modal>
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
      <AddCustomStepModal
        open={Boolean(stepInsertTarget)}
        title={customStepTitle}
        description={customStepDescription}
        expectedOutcome={customStepExpectedOutcome}
        estimatedMinutes={customStepMinutes}
        tasks={customStepTasks}
        addingStep={addingStep}
        onTitleChange={setCustomStepTitle}
        onDescriptionChange={setCustomStepDescription}
        onExpectedOutcomeChange={setCustomStepExpectedOutcome}
        onEstimatedMinutesChange={setCustomStepMinutes}
        onTasksChange={(updater) => setCustomStepTasks(updater)}
        onClose={() => setStepInsertTarget(null)}
        onSubmit={() => void handleCreateCustomStep()}
      />
      {checkModalTab && selectedPhase && userId && (
        <PhaseCheckAdminModal
          userId={userId}
          phaseId={selectedPhase.id}
          phaseTitle={selectedPhase.title}
          memberName={`${user.firstname} ${user.lastname}`.trim()}
          initialTab={checkModalTab}
          onSaved={() => void refreshOnboardingPath()}
          onClose={() => setCheckModalTab(null)}
        />
      )}
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
            onReorderTasks={(activeTaskId, overTaskId) =>
              void handleReorderTasks(step.id, activeTaskId, overTaskId)
            }
          />
        )}
      </PanelPresence>
    </>
  );
}
