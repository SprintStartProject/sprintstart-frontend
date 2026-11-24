import {
  computeRanks,
  orderedPhaseItems,
  phaseItems,
  phaseState,
  unlockedBy,
  type OnboardingPhaseEndpoint,
  type PhaseItem,
  type resolveNextAction,
} from "./journeyKit";

export const NEW_STEP_TITLE = "New step";

/** How many minutes a finished step took, at least one; null while it has no start or end. */
export function actualMinutesOf(item: PhaseItem): number | null {
  if (item.kind !== "step" || !item.step.startedAt || !item.step.completedAt) return null;
  return Math.max(
    1,
    Math.round(
      (new Date(item.step.completedAt).getTime() - new Date(item.step.startedAt).getTime()) / 60000,
    ),
  );
}

/** How far over (positive) or under (negative) the estimate a step took; null without both. */
export function minutesOverEstimate(item: PhaseItem): number | null {
  if (item.kind !== "step") return null;
  const actual = actualMinutesOf(item);
  return actual && item.step.estimatedMinutes ? actual - item.step.estimatedMinutes : null;
}

/** Groups a phase's items into the rows of its graph: each stage opens once the ones above it are done. */
export function stagesOf(phase: OnboardingPhaseEndpoint): PhaseItem[][] {
  const ranks = computeRanks(phaseItems(phase));
  const stages: PhaseItem[][] = [];
  orderedPhaseItems(phase).forEach((item) => {
    const rank = ranks.get(item.id) ?? 0;
    (stages[rank] ??= []).push(item);
  });
  return stages.filter(Boolean);
}

export type StepPlacement = {
  position: number;
  waitsOn: string[];
  unlocks: string[];
  graphX?: number;
  graphY?: number;
};

/** The request that adds a blank step the PM names next. */
export function blankStepRequest(target: OnboardingPhaseEndpoint, placement: StepPlacement) {
  return {
    step: {
      position: Math.min(placement.position, target.steps.length),
      title: NEW_STEP_TITLE,
      description: "",
      type: "TASK" as const,
      estimatedMinutes: 30,
      expectedOutcome: "",
    },
    waitsOn: placement.waitsOn,
    unlocks: placement.unlocks,
    graphX: placement.graphX,
    graphY: placement.graphY,
  };
}

/**
 * Where a step added from the list goes. After an item: in between it and what waited on it. At
 * the end: after everything that nothing else waits on, so it really comes last.
 */
export function listPlacement(
  target: OnboardingPhaseEndpoint,
  after: PhaseItem | null,
): StepPlacement {
  const items = phaseItems(target);
  const waitsOn = after
    ? [after.id]
    : items
        .filter((candidate) => !items.some((other) => other.blockerIds.includes(candidate.id)))
        .map((candidate) => candidate.id);

  return {
    position: after?.kind === "step" ? after.step.position + 1 : target.steps.length,
    waitsOn,
    unlocks: after ? unlockedBy(after, items).map((dependent) => dependent.id) : [],
  };
}

export const withBlocker = (blockers: string[], id: string) =>
  blockers.includes(id) ? blockers : [...blockers, id];

export const withoutBlocker = (blockers: string[], id: string) =>
  blockers.filter((blocker) => blocker !== id);

export function sameBlockers(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((blocker, i) => blocker === second[i]);
}

type NextAction = ReturnType<typeof resolveNextAction>;

/** The phase and the item the member is at, from what is next for them. */
export function focusOf(next: NextAction | null) {
  if (next?.kind === "step") return { focusPhaseId: next.phase.id, nextItemId: next.step.id };
  if (next?.kind === "question") {
    return { focusPhaseId: next.phase.id, nextItemId: next.question.id };
  }
  return { focusPhaseId: null, nextItemId: null };
}

/**
 * The phase shown: the one picked, else the one the member is at, else the first not done, else
 * the first.
 */
export function currentPhase(
  phases: OnboardingPhaseEndpoint[],
  selectedId: string | null,
  focusId: string | null,
) {
  return (
    phases.find((candidate) => candidate.id === selectedId) ??
    phases.find((candidate) => candidate.id === focusId) ??
    phases.find((candidate) => phaseState(candidate) !== "done") ??
    phases[0]
  );
}

/** The classes of an item row in the list: a step being named, a question, or the next one. */
export function rowTone(fresh: boolean, isQuestion: boolean, isNext: boolean): string {
  if (fresh) return "border-app-brand-border bg-app-surface shadow-lg";
  if (isQuestion) {
    return isNext
      ? "border-app-question-solid bg-app-question-bg/60"
      : "border-app-question-border/60 bg-app-question-bg/30 hover:bg-app-question-bg/60";
  }
  return isNext
    ? "border-app-brand bg-app-brand-soft/50"
    : "border-transparent hover:border-app-border hover:bg-app-surface";
}
