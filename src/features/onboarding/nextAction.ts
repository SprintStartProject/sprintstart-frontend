// ============================================================
// features/onboarding/nextAction.ts
// ============================================================
// The one thing a member has to do next in their path, plus how
// far they have come. Shared by the onboarding views and the
// dashboard card, so every entry point sends them to the same
// place.
// ============================================================

import { isPhaseStarted, itemState, lastActivityAt, orderedPhaseItems } from "./journey";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "./types";

/** A step still waiting to be done — neither finished nor skipped nor locked. */
export function isStepOpen(step: OnboardingStepEndpoint): boolean {
  return step.status !== "FINISHED" && step.status !== "SKIPPED";
}

/** A question still waiting to be answered — not passed yet. */
export function isQuestionOpen(question: OnboardingQuestionEndpoint): boolean {
  return question.status !== "PASSED";
}

export type PathProgress = {
  completedSteps: number;
  totalSteps: number;
  /** Share of the path behind the user, rounded to whole percent. 0 for a path without steps. */
  percentage: number;
};

/**
 * Step counts across every phase, locked ones included: progress is about the whole
 * journey, not about the part currently reachable.
 */
export function countPathProgress(path: OnboardingPathEndpoint): PathProgress {
  const steps = path.phases.flatMap((phase) => phase.steps);
  const completedSteps = steps.filter((step) => !isStepOpen(step)).length;

  return {
    completedSteps,
    totalSteps: steps.length,
    percentage: steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0,
  };
}

/**
 * The next thing waiting for the member.
 *
 * One value rather than a list: every caller -- the dashboard card, the "next" button on a step --
 * has exactly one destination to offer, and each of them deciding for itself is how they end up
 * disagreeing. The one exception is a real fork in the path: when finishing a phase opens several
 * new ones at once, there is no single next thing, and pretending there is one takes the choice
 * away from the member. That is `choose`, and it carries the phases to choose from.
 */
export type OnboardingNextAction =
  | { kind: "step"; phase: OnboardingPhaseEndpoint; step: OnboardingStepEndpoint }
  | { kind: "question"; phase: OnboardingPhaseEndpoint; question: OnboardingQuestionEndpoint }
  | { kind: "choose"; phases: OnboardingPhaseEndpoint[] }
  | { kind: "done" };

function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * The item to do next inside one phase, or null when the phase has nothing reachable.
 *
 * A step already in progress comes first -- it is where the member left off. After that the first
 * open item in the order the phase graph reads, steps and questions mixed, because questions are
 * nodes of the same graph and often stand between two steps.
 */
export function nextItemInPhase(
  phase: OnboardingPhaseEndpoint,
):
  | { kind: "step"; step: OnboardingStepEndpoint }
  | { kind: "question"; question: OnboardingQuestionEndpoint }
  | null {
  if (phase.locked) return null;
  const inProgress = phase.steps.find((step) => step.status === "IN_PROGRESS");
  if (inProgress) return { kind: "step", step: inProgress };

  for (const item of orderedPhaseItems(phase)) {
    const state = itemState(item, false);
    // A step waiting on the PM's answer to a skip request is not what to do next.
    const skipPending =
      item.kind === "step" && !!item.step.skip && item.step.skip.accepted === null;
    if (item.kind === "step" && state === "open" && !skipPending) {
      return { kind: "step", step: item.step };
    }
    if (item.kind === "question" && (state === "open" || state === "retry")) {
      return { kind: "question", question: item.question };
    }
  }
  return null;
}

/**
 * Resolves the next action from a path.
 *
 * Phases can run side by side -- a blueprint often opens several at once -- so "the next phase" is
 * not the next one by position. In order of preference:
 *
 * 1. **The phase the member is in right now** (`preferPhaseId`), while it has anything left. Finish a
 *    step in phase 3 and "continue" stays in phase 3, even if phase 2 is open too.
 * 2. **A phase the member already started**, most recently touched first.
 * 3. **The only open phase**, when there is just one.
 * 4. Otherwise the member **chooses** between the phases that are open.
 *
 * Locked phases are never candidates: their items exist but the backend refuses to start them.
 *
 * @param path The member's own path, as returned by `GET /onboarding/me/path`.
 */
export function resolveNextAction(
  path: OnboardingPathEndpoint,
  { preferPhaseId = null }: { preferPhaseId?: string | null } = {},
): OnboardingNextAction {
  const candidates = byPosition(path.phases)
    .map((phase) => ({ phase, item: nextItemInPhase(phase) }))
    .filter(
      (
        candidate,
      ): candidate is {
        phase: OnboardingPhaseEndpoint;
        item: NonNullable<typeof candidate.item>;
      } => candidate.item !== null,
    );
  if (candidates.length === 0) return { kind: "done" };

  const preferred = candidates.find((candidate) => candidate.phase.id === preferPhaseId);
  const started = candidates
    .filter((candidate) => isPhaseStarted(candidate.phase))
    .sort((left, right) => lastActivityAt(right.phase) - lastActivityAt(left.phase));
  const pick = preferred ?? started[0] ?? (candidates.length === 1 ? candidates[0] : null);

  if (!pick) return { kind: "choose", phases: candidates.map((candidate) => candidate.phase) };
  return pick.item.kind === "step"
    ? { kind: "step", phase: pick.phase, step: pick.item.step }
    : { kind: "question", phase: pick.phase, question: pick.item.question };
}
