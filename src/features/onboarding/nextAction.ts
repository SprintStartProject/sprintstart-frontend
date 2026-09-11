// ============================================================
// features/onboarding/nextAction.ts
// ============================================================
// The one thing a member has to do next in their path, plus how
// far they have come. Shared by the onboarding views and the
// dashboard card, so every entry point sends them to the same
// place.
// ============================================================

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
 * The single next thing waiting for the member.
 *
 * Deliberately one value rather than a list: every caller — the dashboard card, the
 * "next" button on a step — has exactly one destination to offer, and each of them
 * deciding for itself is how they end up disagreeing.
 */
export type OnboardingNextAction =
  | { kind: "step"; phase: OnboardingPhaseEndpoint; step: OnboardingStepEndpoint }
  | { kind: "question"; phase: OnboardingPhaseEndpoint; question: OnboardingQuestionEndpoint }
  | { kind: "done" };

function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Resolves the next action from a path.
 *
 * Walks the phases in order and stops at the first one with anything open, which is what
 * keeps the answer inside the phase the member is actually allowed to be in:
 *
 * - **Locked phases are skipped entirely.** Their steps and questions exist but cannot be
 *   started, so offering one leads to a step the backend refuses.
 * - **Within a phase, position order wins, mixing steps and questions.** Questions are
 *   first-class nodes next to steps, so the next action is the first open, unlocked item —
 *   whichever kind it is.
 * - **A question that was answered wrong stays open** until answered correctly once; it
 *   has no separate review pool to fall back to.
 *
 * @param path The member's own path, as returned by `GET /onboarding/me/path`.
 */
export function resolveNextAction(path: OnboardingPathEndpoint): OnboardingNextAction {
  const phases = byPosition(path.phases);

  for (const phase of phases) {
    if (phase.locked) continue;

    const openStep = byPosition(phase.steps).find((step) => isStepOpen(step) && !step.locked);
    if (openStep) return { kind: "step", phase, step: openStep };

    const openQuestion = byPosition(phase.questions).find(
      (question) => isQuestionOpen(question) && question.status !== "LOCKED",
    );
    if (openQuestion) return { kind: "question", phase, question: openQuestion };
  }

  return { kind: "done" };
}
