// ============================================================
// features/onboarding/skipAnswers.ts
// ============================================================
// The project manager's answers to a member's skip requests that
// the member has not looked at yet. The backend keeps when an
// answer was seen (`skip.answerSeenAt`), so this holds across devices.
// ============================================================

import { phaseItems, type PhaseItem } from "./journey";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "./types";

/** The PM's answer to this step's skip request, while the member has not seen it yet. */
export function unseenSkipAnswerOf(item: PhaseItem): "approved" | "declined" | null {
  if (item.kind !== "step" || !item.step.skip) return null;
  const { accepted, answerSeenAt } = item.step.skip;
  if (accepted === null || answerSeenAt) return null;
  return accepted ? "approved" : "declined";
}

/** Whether a phase holds an answer the member has not seen -- marked on the phase so it can be found. */
export function phaseHasUnseenSkipAnswer(phase: OnboardingPhaseEndpoint): boolean {
  return phaseItems(phase).some((item) => unseenSkipAnswerOf(item) !== null);
}

/** How many answers on the path are still new to the member. */
export function unseenSkipAnswerCount(phases: readonly OnboardingPhaseEndpoint[]): number {
  return phases.flatMap(phaseItems).filter((item) => unseenSkipAnswerOf(item) !== null).length;
}

/** The path with one skip answer marked seen, for showing it before the server has confirmed. */
export function withSkipAnswerSeen(
  path: OnboardingPathEndpoint,
  skipId: string,
  seenAt: string,
): OnboardingPathEndpoint {
  return {
    ...path,
    phases: path.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((step) =>
        step.skip?.id === skipId ? { ...step, skip: { ...step.skip, answerSeenAt: seenAt } } : step,
      ),
    })),
  };
}

const SEEN_CHANGED_EVENT = "sprintstart:onboarding-skip-answers-seen";

/** Tells anything counting unseen answers (the sidebar marker) that one was just seen. */
export function notifySkipAnswerSeen(): void {
  window.dispatchEvent(new Event(SEEN_CHANGED_EVENT));
}

/** Calls `listener` whenever an answer is marked seen; returns the unsubscribe. */
export function onSkipAnswerSeen(listener: () => void): () => void {
  window.addEventListener(SEEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SEEN_CHANGED_EVENT, listener);
}
