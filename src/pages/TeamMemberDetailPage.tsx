import {
    ArrowLeft,
    Check,
    MessageSquareText,
    Pencil,
    Plus,
    SkipForward,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
    OnboardingPathEndpoint,
    OnboardingStepEndpoint,
    OnboardingTaskEndpoint,
} from '../features/onboarding/types';
import type {
    ProjectRole,
    TeamOverviewUser,
} from '../features/team-management/types';
import type { KnowledgeGap } from '../features/knowledge-gaps/types';
import { knowledgeGapService } from '../services/knowledgeGapService';
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
    createOnboardingStepForPhase,
    createOnboardingTaskForStep,
    deleteOnboardingStep,
    deleteOnboardingTask,
    getOnboardingTasksByStep,
    updateOnboardingStep,
    updateOnboardingTask,
    type OnboardingFeedback,
    type UserSkillLevel,
} from '../services/teamManagementService';

type DetailOnboardingStep = OnboardingStepEndpoint & {
    startedAt?: string | null;
    durationMinutes?: number | null;
    skip?: {
        id?: string;
        status?: string;
        reason?: string;
    } | null;
};

function getElapsedDays(startedAt: string): number {
    const started = new Date(startedAt).getTime();

    return Math.max(
        0,
        Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24))
    );
}

import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/ui/Modal';
import { PanelPresence } from '../components/ui/PanelPresence';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { AddCustomStepModal } from '../features/team-management/components/detail/AddCustomStepModal';
import { MemberDetailDialogs } from '../features/team-management/components/detail/MemberDetailDialogs';
import { MemberGapsPanel } from '../features/team-management/components/detail/MemberGapsPanel';
import { MemberOnboardingSection } from '../features/team-management/components/detail/MemberOnboardingSection';
import { StepDetailsPanel } from '../features/team-management/components/detail/StepDetailsPanel';

function formatMinutes(minutes?: number | null): string {
    if (!minutes || minutes <= 0) return 'No estimate';
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
            (new Date(step.completedAt).getTime() -
                new Date(step.startedAt).getTime()) /
                (1000 * 60),
        ),
    );
}

function getStepStatusStyles(status: string) {
    if (status === 'FINISHED') {
        return 'border-app-success-border bg-app-success-bg text-app-success-text';
    }

    if (status === 'SKIPPED') {
        return 'border-app-danger-border bg-app-danger-bg text-app-danger-text';
    }

    if (status === 'IN_PROGRESS') {
        return 'border-app-brand bg-app-brand-soft text-app-brand-text';
    }

    return 'border-app-border bg-app-surface-muted text-app-text-muted';
}

/**
 * Full member detail + onboarding management. Bound to `/team/:userId`
 * (`userId` read via `useParams()`). Linked from TeamManagementPage cards.
 * PM/HR/ADMIN.
 */
export function TeamMemberDetailPage() {
    const { userId } = useParams<{ userId: string }>();

    const navigate = useNavigate();

    const [user, setUser] = useState<TeamOverviewUser | undefined>(undefined);
    const [availableRoles, setAvailableRoles] = useState<ProjectRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [loading, setLoading] = useState(true);
    const [rolesModalOpen, setRolesModalOpen] = useState(false);
    const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
    const [roleToRemove, setRoleToRemove] = useState<ProjectRole | null>(null);
    const [skillLevels, setSkillLevels] = useState<UserSkillLevel[]>([]);
    const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
    const [feedbackItems, setFeedbackItems] = useState<OnboardingFeedback[]>([]);
    const [onboardingPath, setOnboardingPath] =
        useState<OnboardingPathEndpoint | null>(null);
    const [selectedPhaseId, setSelectedPhaseId] = useState('');
    const [selectedStepId, setSelectedStepId] = useState('');
    const [detailStepId, setDetailStepId] = useState('');
    const [stepToDelete, setStepToDelete] = useState<DetailOnboardingStep | null>(
        null,
    );
    const [taskToDelete, setTaskToDelete] = useState<OnboardingTaskEndpoint | null>(
        null,
    );
    const [stepInsertTarget, setStepInsertTarget] = useState<{
        phaseId: string;
        position: number;
    } | null>(null);
    const [customStepTitle, setCustomStepTitle] = useState('');
    const [customStepDescription, setCustomStepDescription] = useState('');
    const [customStepExpectedOutcome, setCustomStepExpectedOutcome] = useState('');
    const [customStepMinutes, setCustomStepMinutes] = useState('30');
    const [customStepTasks, setCustomStepTasks] = useState<
        Array<{ title: string; description: string }>
    >([{ title: '', description: '' }]);
    const [addingStep, setAddingStep] = useState(false);
    const [taskInsertTarget, setTaskInsertTarget] = useState<{
        stepId: string;
        position: number;
    } | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    const [stepActionId, setStepActionId] = useState<string | null>(null);
    const [stepTaskCounts, setStepTaskCounts] = useState<
        Record<string, { done: number; total: number }>
    >({});
    const [stepTasksById, setStepTasksById] = useState<
        Record<string, OnboardingTaskEndpoint[]>
    >({});
    const [onboardingError, setOnboardingError] = useState('');
    const [loadingFeedback, setLoadingFeedback] = useState(false);
    const [markingFeedbackId, setMarkingFeedbackId] = useState<string | null>(null);
    const [reviewingSkipAction, setReviewingSkipAction] = useState<
        'accept' | 'deny' | null
    >(null);
    const [skipReviewError, setSkipReviewError] = useState('');
    const [feedbackError, setFeedbackError] = useState('');

    useEffect(() => {
        async function loadMember() {
            if (!userId) {
                setLoading(false);
                return;
            }

            setLoadingFeedback(true);

            const [memberData, rolesData, skills, path, knowledgeGapOverview] = await Promise.all([
                getTeamMember(userId),
                getProjectRoles(),
                getUserSkillLevels(userId),
                getUserOnboardingPath(userId),
                knowledgeGapService.fetchKnowledgeGaps(),
            ]);
            let feedback: OnboardingFeedback[] = [];
            try {
                feedback = await getUserOnboardingFeedback(userId);
            } catch (error) {
                setFeedbackError(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load feedback.',
                );
            }

            setUser(memberData);
            setAvailableRoles(rolesData);
            setSkillLevels(skills);
            setKnowledgeGaps(knowledgeGapOverview.gaps);
            setFeedbackItems(feedback);
            setOnboardingPath(path);
            setSelectedPhaseId(path?.phases?.[0]?.id ?? '');
            setSelectedStepId(
                memberData?.currentStep?.id ??
                    path?.phases?.[0]?.steps?.[0]?.id ??
                    '',
            );
            setLoadingFeedback(false);
            setLoading(false);
        }

        void loadMember();
    }, [userId]);

    useEffect(() => {
        async function loadPathTaskCounts() {
            const steps =
                onboardingPath?.phases.flatMap((phase) => phase.steps ?? []) ?? [];

            if (steps.length === 0) {
                setStepTaskCounts({});
                return;
            }

            const taskEntries = await Promise.all(
                steps.map(async (step) => {
                    const tasks = await getOnboardingTasksByStep(step.id);

                    return [
                        step.id,
                        tasks,
                    ] as const;
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

    async function refreshFeedback() {
        if (!userId) return;

        setLoadingFeedback(true);
        setFeedbackError('');

        try {
            const feedback = await getUserOnboardingFeedback(userId);
            setFeedbackItems(feedback);
        } catch (error) {
            setFeedbackError(
                error instanceof Error
                    ? error.message
                    : 'Unable to load feedback.',
            );
        } finally {
            setLoadingFeedback(false);
        }
    }

    async function refreshOnboardingPath() {
        if (!userId) return;

        const path = await getUserOnboardingPath(userId);
        setOnboardingPath(path);

        if (path?.phases?.length && !path.phases.some((phase) => phase.id === selectedPhaseId)) {
            setSelectedPhaseId(path.phases[0].id);
        }

        const refreshedSteps = path?.phases.flatMap((phase) => phase.steps ?? []) ?? [];
        if (refreshedSteps.length && !refreshedSteps.some((step) => step.id === selectedStepId)) {
            setSelectedStepId(refreshedSteps[0].id);
        }
    }

    const unassignedRoles = useMemo(() => {
        if (!user) return [];

        return availableRoles.filter(
            (role) =>
                !user.roles.some((assignedRole) => assignedRole.id === role.id)
        );
    }, [availableRoles, user]);

    async function handleAddRole() {
        if (!user || !selectedRoleId) return;

        const roleToAdd = availableRoles.find(
            (role) => role.id === selectedRoleId
        );

        if (!roleToAdd) return;

        setSavingRoleId(selectedRoleId);

        await assignProjectRoleToUser(user.userId, selectedRoleId);

        setUser({
            ...user,
            roles: [...user.roles, roleToAdd],
        });

        setSelectedRoleId('');
        setSavingRoleId(null);
    }

    async function handleRemoveRole(roleId: string) {
        if (!user) return;

        setSavingRoleId(roleId);

        await unassignProjectRoleFromUser(user.userId, roleId);

        setUser({
            ...user,
            roles: user.roles.filter((role) => role.id !== roleId),
        });

        setSavingRoleId(null);
    }

    async function handleSkipReview(action: 'accept' | 'deny') {
        const skipId = user?.currentStep?.skip?.id;
        if (!skipId) return;

        setReviewingSkipAction(action);
        setSkipReviewError('');

        try {
            if (action === 'accept') {
                await acceptOnboardingSkipRequest(skipId);
            } else {
                await denyOnboardingSkipRequest(skipId);
            }

            await Promise.all([refreshMember(), refreshOnboardingPath()]);
        } catch (error) {
            setSkipReviewError(
                error instanceof Error
                    ? error.message
                    : 'Unable to review skip request.',
            );
        } finally {
            setReviewingSkipAction(null);
        }
    }

    async function handleDeleteStep(step: DetailOnboardingStep) {
        setStepActionId(step.id);
        setOnboardingError('');

        try {
            await deleteOnboardingStep(step.id);
            setStepToDelete(null);
            if (detailStepId === step.id) {
                setDetailStepId('');
            }
            await refreshOnboardingPath();
        } catch (error) {
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to delete step.',
            );
        } finally {
            setStepActionId(null);
        }
    }

    async function handleReorderSteps(
        phaseId: string,
        activeStepId: string,
        overStepId: string,
    ) {
        if (activeStepId === overStepId) return;

        const phase = onboardingPath?.phases.find((item) => item.id === phaseId);
        const currentSteps = [...(phase?.steps ?? [])].sort(
            (a, b) => a.position - b.position,
        );
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
                currentSteps.find((currentStep) => currentStep.id === step.id)
                    ?.position !== step.position,
        );

        setStepActionId(activeStepId);
        setOnboardingError('');
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
                    expectedOutcome: step.expectedOutcomes?.[0] ?? '',
                    status: step.status,
                    skip: step.skip ?? null,
                });
            }

            await refreshOnboardingPath();
        } catch (error) {
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to reorder onboarding steps.',
            );
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

    async function handleReorderTasks(
        stepId: string,
        activeTaskId: string,
        overTaskId: string,
    ) {
        if (activeTaskId === overTaskId) return;

        const currentTasks = [...(stepTasksById[stepId] ?? [])].sort(
            (a, b) => a.position - b.position,
        );
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
                currentTasks.find((currentTask) => currentTask.id === task.id)
                    ?.position !== task.position,
        );

        setStepActionId(stepId);
        setOnboardingError('');
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
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to reorder tasks.',
            );
            await refreshStepTasks(stepId);
        } finally {
            setStepActionId(null);
        }
    }

    async function handleDeleteTask(task: OnboardingTaskEndpoint) {
        setStepActionId(task.stepId);
        setOnboardingError('');

        try {
            await deleteOnboardingTask(task.id);
            setTaskToDelete(null);
            await refreshStepTasks(task.stepId);
            await refreshOnboardingPath();
        } catch (error) {
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to delete task.',
            );
        } finally {
            setStepActionId(null);
        }
    }

    async function handleCreateTask() {
        if (!taskInsertTarget || !newTaskTitle.trim()) return;

        setAddingTask(true);
        setStepActionId(taskInsertTarget.stepId);
        setOnboardingError('');

        try {
            await createOnboardingTaskForStep(taskInsertTarget.stepId, {
                position: taskInsertTarget.position,
                title: newTaskTitle.trim(),
                description: newTaskDescription.trim(),
                finished: false,
            });

            setTaskInsertTarget(null);
            setNewTaskTitle('');
            setNewTaskDescription('');
            await refreshStepTasks(taskInsertTarget.stepId);
            // Adding a task reopens a completed step on the backend (status back to
            // IN_PROGRESS). Refresh the path so the step cards update, and the team-overview
            // member data so the header progress bar and current step reflect the change too.
            await Promise.all([refreshOnboardingPath(), refreshMember()]);
        } catch (error) {
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to create task.',
            );
        } finally {
            setAddingTask(false);
            setStepActionId(null);
        }
    }

    async function handleMarkFeedbackRead(feedbackId: string) {
        setMarkingFeedbackId(feedbackId);
        setFeedbackError('');

        try {
            await markOnboardingFeedbackRead(feedbackId);
            setFeedbackItems((current) =>
                current.map((feedback) =>
                    feedback.id === feedbackId
                        ? { ...feedback, read: true }
                        : feedback,
                ),
            );
            await Promise.all([refreshFeedback(), refreshMember()]);
        } catch (error) {
            setFeedbackError(
                error instanceof Error
                    ? error.message
                    : 'Unable to mark feedback as read.',
            );
        } finally {
            setMarkingFeedbackId(null);
        }
    }

    async function handleCreateCustomStep() {
        const targetPhaseId = stepInsertTarget?.phaseId ?? selectedPhaseId;

        if (!targetPhaseId || !customStepTitle.trim()) return;

        const selectedPhase = onboardingPath?.phases.find(
            (phase) => phase.id === targetPhaseId,
        );

        if (!selectedPhase) return;

        setAddingStep(true);
        setOnboardingError('');

        try {
            const createdStep = await createOnboardingStepForPhase(targetPhaseId, {
                position:
                    stepInsertTarget?.position ?? selectedPhase.steps?.length ?? 0,
                isAiAssisted: false,
                title: customStepTitle.trim(),
                description: customStepDescription.trim(),
                type: 'TASK',
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

            setCustomStepTitle('');
            setCustomStepDescription('');
            setCustomStepExpectedOutcome('');
            setCustomStepMinutes('30');
            setCustomStepTasks([{ title: '', description: '' }]);
            setStepInsertTarget(null);
            setSelectedStepId(createdStep.id);
            setDetailStepId(createdStep.id);
            await refreshOnboardingPath();
            if (tasksToCreate.length > 0) {
                await refreshStepTasks(createdStep.id);
            }
        } catch (error) {
            setOnboardingError(
                error instanceof Error
                    ? error.message
                    : 'Unable to create custom onboarding step.',
            );
        } finally {
            setAddingStep(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-sm text-app-text-muted">
                    Loading team member...
                </p>
            </div>
        );
    }

    function goBack() {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            void navigate(-1);
        } else {
            void navigate('/team-management');
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <button
                        onClick={goBack}
                        className="inline-flex items-center gap-1.5 text-sm text-app-text-muted hover:text-app-text"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    <SpotlightCard roundedClassName="rounded-3xl" className="mt-6 p-8">
                                            <p className="text-sm text-app-text">
                                                Team member not found.
                                            </p>
                                        </SpotlightCard>
                </main>
            </div>
        );
    }

    const elapsedDays = user.currentStep?.startedAt ? getElapsedDays(user.currentStep.startedAt) : 0;
    const progressPercentage = Math.round(user.progressPercentage * 100);
    const pendingSkip = user.currentStep?.skip?.status === 'PENDING'
        ? user.currentStep.skip
        : null;
    const unreadFeedback = feedbackItems.filter(
        (item) => item.read !== true && !item.readAt,
    );
    const phases = [...(onboardingPath?.phases ?? [])].sort(
        (a, b) => a.position - b.position,
    );
    const allSteps = phases.flatMap((phase) =>
        [...(phase.steps ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((step) => step as DetailOnboardingStep),
    );
    const finishedSteps = allSteps.filter((step) => step.status === 'FINISHED').length;
    const skippedSteps = allSteps.filter((step) => step.status === 'SKIPPED').length;
    const pathPendingSkips = allSteps.filter(
        (step) => step.skip?.status === 'PENDING',
    ).length;
    const estimatedMinutes = allSteps.reduce(
        (sum, step) => sum + (step.estimatedMinutes || 0),
        0,
    );
    const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0];
    const selectedPhaseSteps = [...(selectedPhase?.steps ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((step) => step as DetailOnboardingStep);
    const selectedStep =
        allSteps.find((step) => step.id === selectedStepId) ??
        selectedPhaseSteps[0] ??
        null;
    const detailStep = allSteps.find((step) => step.id === detailStepId) ?? null;
    const detailStepTasks = detailStep ? stepTasksById[detailStep.id] ?? [] : [];
    const sortedDetailStepTasks = [...detailStepTasks].sort(
        (a, b) => a.position - b.position,
    );
    const detailStepDoneTasks = detailStepTasks.filter((task) => task.finished).length;
    const detailStepActualMinutes = detailStep ? getActualMinutes(detailStep) : null;

    const detailStepFeedback = detailStep
        ? feedbackItems
            .filter((feedback) => feedback.stepId === detailStep.id)
            .map((feedback) => ({
                ...feedback,
                helpful:
                    feedback.helpful ??
                    (detailStep.feedback?.id === feedback.id
                        ? detailStep.feedback.helpful
                        : undefined),
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
    const detailStepSkipReason = detailStep?.skip?.reason || '';
    const skillGaps = skillLevels.filter(
        (skill) => skill.level === 'BEGINNER' || skill.level === 'INTERMEDIATE',
    );
    const severityOrder: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
    };
    const topKnowledgeGaps = [...knowledgeGaps]
        .sort(
            (a, b) =>
                (severityOrder[a.severity] ?? 3) -
                (severityOrder[b.severity] ?? 3),
        )
        .slice(0, 3);
    const nextStep =
        allSteps.find(
            (step) => step.status !== 'FINISHED' && step.status !== 'SKIPPED',
        ) ?? null;

    return (
        <div className="min-h-screen">
            <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <button
                        onClick={goBack}
                        className="inline-flex items-center gap-1.5 text-sm text-app-text-muted hover:text-app-text mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex shrink-0 items-center justify-center">
                                <UserAvatar profileIcon={user.profileIcon} fallbackName={`${user.firstname} ${user.lastname}`.trim()} seed={user.userId} size={56} />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold text-app-text">
                                    {user.firstname} {user.lastname}
                                </h1>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {user.roles.length > 0 ? (
                                        user.roles.map((role) => (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => setRolesModalOpen(true)}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand hover:text-app-brand"
                                                title="Edit roles"
                                            >
                                                <span>{role.name}</span>
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        ))
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setRolesModalOpen(true)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-border px-3 py-1 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand hover:text-app-brand"
                                            title="Choose role"
                                        >
                                            <span>Choose role</span>
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-app-text-muted">
                                Current Step
                                {user.currentStep?.startedAt && (
                                    <span className="ml-2 font-normal normal-case">
                                        · {elapsedDays}{' '}
                                        {elapsedDays === 1 ? 'day' : 'days'} ago
                                    </span>
                                )}
                            </p>

                            <p className="mt-2 text-sm font-medium text-app-text">
                                {user.currentStep?.title || 'Onboarding Completed'}
                            </p>

                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-app-border-muted">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-all duration-500"
                                style={{
                                    width: `${progressPercentage}%`,
                                }}
                            />
                        </div>

                        <span className="text-sm font-medium tabular-nums text-app-text">
                            {progressPercentage}%
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
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
                            void handleReorderSteps(
                                phaseId,
                                activeStepId,
                                overStepId,
                            )
                        }
                        formatMinutes={formatMinutes}
                        getActualMinutes={getActualMinutes}
                        getStepStatusStyles={getStepStatusStyles}
                    />
                    <aside aria-label="Member insights" className="space-y-4">
                    <SpotlightCard roundedClassName="rounded-3xl" className="p-6">
                                            <h2 className="text-lg font-semibold text-app-text">
                                                Feedback & Skip Requests
                                            </h2>

                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <MessageSquareText className="h-4 w-4 text-app-text-muted" />
                                    <p className="text-sm font-semibold text-app-text">
                                        Open items
                                    </p>
                                </div>

                                {(unreadFeedback.length > 0 || pendingSkip) && (
                                    <span className="rounded-full bg-app-warning-bg px-2.5 py-1 text-xs font-medium text-app-warning-text">
                                        {unreadFeedback.length + (pendingSkip ? 1 : 0)} open
                                    </span>
                                )}
                            </div>

                            {pendingSkip && (
                                <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 gap-3">
                                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface text-app-warning-text">
                                                <SkipForward className="h-4 w-4" />
                                            </span>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-app-text">
                                                        Skip request
                                                    </p>
                                                    <span className="rounded-full bg-app-surface px-2 py-0.5 text-xs font-medium text-app-warning-text">
                                                        Pending
                                                    </span>
                                                </div>

                                                {user.currentStep?.title && (
                                                    <p className="mt-1 text-xs text-app-text-muted">
                                                        {user.currentStep.title}
                                                    </p>
                                                )}

                                                <p className="mt-2 text-sm text-app-text">
                                                    {pendingSkip.reason}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleSkipReview('accept')}
                                                disabled={reviewingSkipAction !== null}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-app-success-solid px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-app-success-solid/90 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                {reviewingSkipAction === 'accept'
                                                    ? 'Accepting...'
                                                    : 'Accept'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => void handleSkipReview('deny')}
                                                disabled={reviewingSkipAction !== null}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                {reviewingSkipAction === 'deny'
                                                    ? 'Denying...'
                                                    : 'Deny'}
                                            </button>
                                        </div>
                                    </div>

                                    {skipReviewError && (
                                        <p className="mt-3 text-xs text-app-danger-text">
                                            {skipReviewError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {loadingFeedback ? (
                                <p className="rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                                    Loading feedback...
                                </p>
                            ) : unreadFeedback.length > 0 ? (
                                unreadFeedback.map((feedback) => {
                                    const isUnread =
                                        feedback.read !== true && !feedback.readAt;

                                    return (
                                        <div
                                            key={feedback.id}
                                            className={`rounded-2xl border p-4 ${
                                                isUnread
                                                    ? 'border-app-warning-border bg-app-warning-bg'
                                                    : 'border-app-border bg-app-surface-muted'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 gap-3">
                                                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                                        isUnread
                                                            ? 'bg-app-surface text-app-warning-text'
                                                            : 'bg-app-surface text-app-text-muted'
                                                    }`}>
                                                        <MessageSquareText className="h-4 w-4" />
                                                    </span>

                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-semibold text-app-text">
                                                                Feedback
                                                            </p>
                                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                isUnread
                                                                    ? 'bg-app-surface text-app-warning-text'
                                                                    : 'bg-app-border-muted text-app-text-muted'
                                                            }`}>
                                                                {isUnread ? 'Unread' : 'Read'}
                                                            </span>
                                                        </div>

                                                        <p className="mt-2 text-sm text-app-text">
                                                            {feedback.message}
                                                        </p>

                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-app-text-muted">
                                                            {feedback.stepTitle && (
                                                                <span className="rounded-full bg-app-surface px-2 py-0.5">
                                                                    {feedback.stepTitle}
                                                                </span>
                                                            )}
                                                            {feedback.createdAt && (
                                                                <span>
                                                                    {new Date(feedback.createdAt).toLocaleDateString(
                                                                        'en-US',
                                                                        {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                        },
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isUnread && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleMarkFeedbackRead(feedback.id)
                                                        }
                                                        disabled={markingFeedbackId === feedback.id}
                                                        className="shrink-0 rounded-lg border border-app-warning-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-warning-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {markingFeedbackId === feedback.id
                                                            ? 'Marking...'
                                                            : 'Mark read'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : user.hasFeedback && feedbackItems.length === 0 ? (
                                <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface text-app-warning-text">
                                            <MessageSquareText className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-app-text">
                                                    Feedback
                                                </p>
                                                <span className="rounded-full bg-app-surface px-2 py-0.5 text-xs font-medium text-app-warning-text">
                                                    Unread
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm text-app-text">
                                                {user.firstname} has left feedback on their onboarding path.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : !pendingSkip ? (
                                <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                                    No open feedback or skip requests.
                                </p>
                            ) : null}

                            {feedbackError && (
                                <p className="text-xs text-app-danger-text">
                                    {feedbackError}
                                </p>
                            )}
                        </div>
                                            </SpotlightCard>
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
            </main>

            <Modal
                isOpen={rolesModalOpen}
                title="Manage Roles"
                description={`Add or remove roles for ${user.firstname}.`}
                closeLabel="Close roles modal"
                onClose={() => setRolesModalOpen(false)}
            >
                        <div className="space-y-2">
                            {user.roles.length > 0 ? (
                                user.roles.map((role) => (
                                    <div
                                        key={role.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3"
                                    >
                                        <span className="text-sm font-medium text-app-text">
                                            {role.name}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => setRoleToRemove(role)}
                                            disabled={savingRoleId === role.id}
                                            className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            aria-label={`Remove ${role.name}`}
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                                    No role assigned yet. Choose a role below.
                                </p>
                            )}
                        </div>

                        <div className="mt-6 flex gap-2">
                            <select
                                value={selectedRoleId}
                                onChange={(event) =>
                                    setSelectedRoleId(event.target.value)
                                }
                                className="min-w-0 flex-1 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand"
                            >
                                <option value="">Choose role</option>

                                {unassignedRoles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => void handleAddRole()}
                                disabled={
                                    !selectedRoleId || savingRoleId !== null
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
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
                errorMessage={onboardingError}
                onTitleChange={setCustomStepTitle}
                onDescriptionChange={setCustomStepDescription}
                onExpectedOutcomeChange={setCustomStepExpectedOutcome}
                onEstimatedMinutesChange={setCustomStepMinutes}
                onTasksChange={(updater) => setCustomStepTasks(updater)}
                onClose={() => setStepInsertTarget(null)}
                onSubmit={() => void handleCreateCustomStep()}
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
                    onClose={() => setDetailStepId('')}
                    onRequestDeleteStep={(step: DetailOnboardingStep) =>
                        setStepToDelete(step)
                    }
                    onCancelDeleteStep={() => setStepToDelete(null)}
                    onConfirmDeleteStep={(step: DetailOnboardingStep) =>
                        void handleDeleteStep(step)
                    }
                    onRequestDeleteTask={(task: OnboardingTaskEndpoint) =>
                        setTaskToDelete(task)
                    }
                    onCancelDeleteTask={() => setTaskToDelete(null)}
                    onConfirmDeleteTask={(task: OnboardingTaskEndpoint) =>
                        void handleDeleteTask(task)
                    }
                    onTaskInsertTargetChange={setTaskInsertTarget}
                    onNewTaskTitleChange={setNewTaskTitle}
                    onNewTaskDescriptionChange={setNewTaskDescription}
                    onCreateTask={() => void handleCreateTask()}
                    formatMinutes={formatMinutes}
                    getStepStatusStyles={getStepStatusStyles}
                    onReorderTasks={(activeTaskId, overTaskId) =>
                        void handleReorderTasks(
                            step.id,
                            activeTaskId,
                            overTaskId,
                        )
                    }
                />
                )}
            </PanelPresence>
        </div>

    );
}
