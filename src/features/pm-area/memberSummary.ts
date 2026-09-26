import {
  isSkipPending,
  pathProgress,
  phaseProgress,
  phaseState,
  sortedPhases,
} from "../onboarding/journey";
import type { OnboardingPathEndpoint } from "../onboarding/types";
import type { OnboardingFeedback } from "../../services/teamManagementService";
import type { ChartDatum } from "./components/charts/chartTypes";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Everything the summary draws, derived from the member's path and what they said about it. */
export function memberSummaryData(
  path: OnboardingPathEndpoint | null,
  feedback: readonly OnboardingFeedback[],
) {
  const phases = path ? sortedPhases(path) : [];
  const steps = phases.flatMap((phase) => phase.steps ?? []);
  const progress = path ? pathProgress(path) : null;

  const stepStates: ChartDatum[] = [
    {
      key: "done",
      label: "Done",
      value: steps.filter((step) => step.status === "FINISHED").length,
      colorClassName: "text-app-success-solid",
    },
    {
      key: "active",
      label: "In progress",
      value: steps.filter((step) => step.status === "IN_PROGRESS").length,
      colorClassName: "text-app-brand",
    },
    {
      key: "skipped",
      label: "Skipped",
      value: steps.filter((step) => step.status === "SKIPPED").length,
      colorClassName: "text-app-severity-medium-solid",
    },
    {
      key: "todo",
      label: "To do",
      // Open and locked alike: both are still ahead of the member.
      value: steps.filter((step) => step.status === "WAITING").length,
      colorClassName: "text-app-border-strong",
    },
  ];

  // Workload by the steps' own estimates: what the member has closed against what the path asks.
  const estimated = steps.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
  const closedEstimate = steps
    .filter((step) => step.status === "FINISHED" || step.status === "SKIPPED")
    .reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);

  const helpful = steps.filter((step) => step.feedback?.helpful === true).length;
  const unhelpful = steps.filter((step) => step.feedback?.helpful === false).length;
  const comments = feedback.filter((item) => item.message?.trim()).length;

  const skips = steps.filter((step) => step.skip);
  const pendingSkips = skips.filter(
    (step) => isSkipPending(step.skip) && step.status !== "SKIPPED",
  ).length;
  const approvedSkips = skips.filter((step) => step.status === "SKIPPED").length;
  const declinedSkips = skips.filter(
    (step) => step.skip?.accepted === false && step.status !== "SKIPPED",
  ).length;

  const runningDays = path?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(path.createdAt).getTime()) / DAY_MS))
    : null;

  return {
    phases: phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      state: phaseState(phase),
      progress: phaseProgress(phase),
      /** The steps the member is on right now in this phase, for the summary's closer look. */
      currentSteps: [...(phase.steps ?? [])]
        .sort((a, b) => a.position - b.position)
        .filter((step) => step.status === "IN_PROGRESS")
        .map((step) => step.title),
    })),
    progress,
    stepStates,
    stepCount: steps.length,
    estimated,
    closedEstimate,
    helpful,
    unhelpful,
    comments,
    pendingSkips,
    approvedSkips,
    declinedSkips,
    runningDays,
  };
}
