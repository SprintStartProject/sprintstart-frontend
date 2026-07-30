// ============================================================
// features/onboarding/activePhase.ts
// ============================================================
// Works out which phase someone is currently sitting in.
// Shared by the member's own onboarding view and the PM member
// view so both land on the same phase.
// ============================================================

import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "./types";

/**
 * Whether a phase still has something left to do.
 *
 * Open steps count, and so does an unpassed knowledge check. The check half matters:
 * finishing the last step of a phase leaves the member standing in front of that phase's
 * check, and going by steps alone would treat the phase as done and move on to the next
 * one — which is exactly where they cannot go until the check is passed.
 */
export function isPhaseOpen(phase: OnboardingPhaseEndpoint): boolean {
  const hasOpenStep = phase.steps.some(
    (step) => step.status !== "FINISHED" && step.status !== "SKIPPED",
  );

  return hasOpenStep || (phase.checkSummary?.required === true && !phase.checkSummary.passed);
}

/**
 * Index of the phase the member is currently working on: the first one with anything
 * still open.
 *
 * Falls back to the last phase when everything is done, so a finished journey shows its
 * end rather than jumping back to the beginning.
 */
export function findActivePhaseIndex(path: OnboardingPathEndpoint): number {
  const index = path.phases.findIndex(isPhaseOpen);

  return index === -1 ? Math.max(0, path.phases.length - 1) : index;
}
