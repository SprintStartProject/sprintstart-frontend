import type { TeamOverviewUser } from "../../features/team-management/types";
import {
  allStepsOf,
  getActualMinutes,
  openItemCount,
  sortedPhases,
  stepFeedbackFor,
  topKnowledgeGaps,
} from "./memberRules";
import type { MemberPageModel } from "./useMemberPage";

/** What the page draws, worked out from the loaded data and the open step. */
export function memberView(model: MemberPageModel, user: TeamOverviewUser) {
  const { data, tasks, route, checkModal } = model;
  const phases = sortedPhases(data.onboardingPath);
  const allSteps = allStepsOf(phases);
  const detailStep = allSteps.find((step) => step.id === route.detailStepId) ?? null;
  const detailTasks = detailStep ? (tasks.tasksById[detailStep.id] ?? []) : [];

  return {
    phases,
    allSteps,
    detailStep,
    openItems: openItemCount(user, data.feedbackItems),
    checkModalPhase: checkModal
      ? (phases.find((phase) => phase.id === checkModal.phaseId) ?? null)
      : null,
    detailTasks: [...detailTasks].sort((a, b) => a.position - b.position),
    detailDoneTasks: detailTasks.filter((task) => task.finished).length,
    detailActualMinutes: detailStep ? getActualMinutes(detailStep) : null,
    detailFeedback: stepFeedbackFor(detailStep, data.feedbackItems),
    detailSkipReason: detailStep?.skip?.reason || "",
    topGaps: topKnowledgeGaps(data.knowledgeGaps),
  };
}

export type MemberView = ReturnType<typeof memberView>;
