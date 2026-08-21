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
  OnboardingStepEndpoint,
} from "./types";

/** A step still waiting to be done — neither finished nor skipped. */
export function isStepOpen(step: OnboardingStepEndpoint): boolean {
  return step.status !== "FINISHED" && step.status !== "SKIPPED";
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
  | { kind: "check"; phase: OnboardingPhaseEndpoint; isFinalPhase: boolean }
  | { kind: "review"; openCount: number }
  | { kind: "done" };

function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Resolves the next action from a path and the size of the review pool.
 *
 * Walks the phases in order and stops at the first one with anything open, which is what
 * keeps the answer inside the phase the member is actually allowed to be in:
 *
 * - **Locked phases are skipped entirely.** Their steps exist but cannot be started, so
 *   offering one leads to a step the backend refuses. This is the difference to reading
 *   `currentStep` off the team overview, which reports the first unfinished step in the
 *   path regardless of locks — for someone standing in front of an unpassed check that is
 *   a step in the *next* phase, which is exactly where they may not go.
 * - **A phase's knowledge check comes before anything in a later phase.** Once its steps
 *   are done the check is that phase's last item, and while it is unpassed nothing behind
 *   it is reachable.
 * - **The review pool outlives the phases.** Questions missed earlier have to be answered
 *   correctly once, and the backend does not count the journey as finished while any are
 *   still open — so a path whose phases are all cleared can still have work left.
 *
 * @param path The member's own path, as returned by `GET /onboarding/me/path`.
 * @param openReviewCount Questions waiting in the review pool. Only consulted when the
 *   phases have nothing left, so callers may leave it out while they do not know it yet.
 */
export function resolveNextAction(
  path: OnboardingPathEndpoint,
  openReviewCount = 0,
): OnboardingNextAction {
  const phases = byPosition(path.phases);
  const finalPhaseId = phases.at(-1)?.id;

  for (const phase of phases) {
    if (phase.locked) continue;

    const openStep = byPosition(phase.steps).find(isStepOpen);
    if (openStep) return { kind: "step", phase, step: openStep };

    if (phase.checkSummary?.required && !phase.checkSummary.passed) {
      return { kind: "check", phase, isFinalPhase: phase.id === finalPhaseId };
    }
  }

  return openReviewCount > 0 ? { kind: "review", openCount: openReviewCount } : { kind: "done" };
}
