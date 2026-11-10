import type { KnowledgeGap } from "../../services/knowledgeGapTypes";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
} from "../../services/onboardingTypes";
import { waitingOn } from "../../features/pm-area/memberStatus";
import { isUnread } from "../../features/pm-area/useMemberOpenItems";
import type { OnboardingFeedback } from "../../services/teamManagementService";
import type { ProjectRole, TeamOverviewUser } from "../../services/teamManagementTypes";

/** A step as the member page reads it: with the timing and skip fields the API adds. */
export type DetailOnboardingStep = OnboardingStepEndpoint & {
  startedAt?: string | null;
  durationMinutes?: number | null;
  skip?: {
    id?: string;
    status?: string;
    reason?: string;
  } | null;
};

export type TaskCount = { done: number; total: number };

/** A rebuild failure, in the PM's words rather than the member's. */
export function describeRebuildError(message: string, reason?: string): string {
  if (reason === "not-enough-knowledge") {
    return "The project's knowledge base does not cover any phase yet. The current path is unchanged.";
  }
  if (/no active blueprint/i.test(message)) {
    return "This project has no published onboarding blueprint yet. Publish one, then try again.";
  }
  if (/multiple active blueprints/i.test(message)) {
    return "This project has more than one published onboarding blueprint. Archive all but one, then try again.";
  }
  if (/status: 403/.test(message)) {
    return "Only the project's manager can rebuild paths, and only for members of the project.";
  }
  return `${message || "The generation failed."} The current path is unchanged.`;
}

export function formatMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "No estimate";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function getActualMinutes(step: DetailOnboardingStep): number | null {
  if (step.durationMinutes) return step.durationMinutes;

  if (!step.startedAt || !step.completedAt) return null;

  return Math.max(
    1,
    Math.round(
      (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / (1000 * 60),
    ),
  );
}

export function getStepStatusStyles(status: string) {
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

/** The roles of the project the member does not hold yet. */
export function unassignedRolesOf(roles: ProjectRole[], user: TeamOverviewUser): ProjectRole[] {
  return roles.filter((role) => !user.roles.some((assigned) => assigned.id === role.id));
}

/** The phases in path order. */
export function sortedPhases(path: OnboardingPathEndpoint | null) {
  return [...(path?.phases ?? [])].sort((a, b) => a.position - b.position);
}

/** Every step of the path, phase by phase, each phase in step order. */
export function allStepsOf(phases: ReturnType<typeof sortedPhases>): DetailOnboardingStep[] {
  return phases.flatMap((phase) =>
    [...(phase.steps ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((step) => step as DetailOnboardingStep),
  );
}

/**
 * How many things wait on the PM. Items, not kinds: three unread comments are three things to
 * read. The member's own flag stands in for feedback that has not loaded (or could not be), so the
 * strip never under-reports.
 */
export function openItemCount(user: TeamOverviewUser, feedback: OnboardingFeedback[]): number {
  const unread = feedback.filter(isUnread).length;

  return (
    (waitingOn(user).includes("skip") ? 1 : 0) + (unread > 0 ? unread : user.hasFeedback ? 1 : 0)
  );
}

/**
 * The feedback shown for one step: the member's feedback items for it, each with its `helpful`
 * from the step when the item lacks one; and the step's own feedback when the list has none.
 */
export function stepFeedbackFor(
  step: DetailOnboardingStep | null,
  items: OnboardingFeedback[],
): OnboardingFeedback[] {
  if (!step) return [];

  const forStep = items
    .filter((feedback) => feedback.stepId === step.id)
    .map((feedback) => ({
      ...feedback,
      helpful:
        feedback.helpful ?? (step.feedback?.id === feedback.id ? step.feedback.helpful : undefined),
    }));

  if (forStep.length > 0 || !step.feedback) return forStep;

  return [
    {
      id: step.feedback.id,
      stepId: step.id,
      stepTitle: step.title,
      message: step.feedback.comment,
      helpful: step.feedback.helpful,
      createdAt: step.feedback.createdAt,
    },
  ];
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** The three most severe gaps. */
export function topKnowledgeGaps(gaps: KnowledgeGap[]): KnowledgeGap[] {
  return [...gaps]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
    .slice(0, 3);
}

/**
 * The gaps this member answers for. Covered components are dropped rather than shown: counting
 * repositories that are missing nothing would overstate what the member has to answer for. And
 * only the components the member owns: the overview is project-wide, and listing every gap on
 * every profile made each member look answerable for all of them.
 */
export function gapsOwnedBy(gaps: KnowledgeGap[], userId: string | undefined): KnowledgeGap[] {
  return gaps.filter(
    (gap) => gap.severity !== "covered" && gap.owners.some((owner) => owner.id === userId),
  );
}

/** Done and total of a step's tasks. */
export function taskCount(tasks: OnboardingTaskEndpoint[]): TaskCount {
  return { done: tasks.filter((task) => task.finished).length, total: tasks.length };
}

export type TaskMove = { next: OnboardingTaskEndpoint[]; changed: OnboardingTaskEndpoint[] };

/**
 * The tasks after dragging one over another, renumbered from zero, and the ones whose position
 * actually changed. `null` when the move is not one: the same task, or one that is not there.
 */
export function moveTask(
  tasks: OnboardingTaskEndpoint[],
  activeTaskId: string,
  overTaskId: string,
): TaskMove | null {
  if (activeTaskId === overTaskId) return null;

  const current = [...tasks].sort((a, b) => a.position - b.position);
  const activeIndex = current.findIndex((task) => task.id === activeTaskId);
  const overIndex = current.findIndex((task) => task.id === overTaskId);
  if (activeIndex < 0 || overIndex < 0) return null;

  const reordered = [...current];
  const [moved] = reordered.splice(activeIndex, 1);
  reordered.splice(overIndex, 0, moved);

  const next = reordered.map((task, index) => ({ ...task, position: index }));
  const changed = next.filter(
    (task) => current.find((existing) => existing.id === task.id)?.position !== task.position,
  );

  return { next, changed };
}
