// ============================================================
// features/onboarding/skipAnswers.ts
// ============================================================
// The project manager's answers to a member's skip requests, and
// which of them the member has already seen.
// ============================================================

import type { OnboardingPhaseEndpoint } from "./types";

/** A skip request the project manager has approved or declined. */
export type SkipAnswer = {
  skipId: string;
  stepId: string;
  stepTitle: string;
  approved: boolean;
  comment: string | null;
  reviewedAt: string | null;
};

/** Every answered skip request on the path, newest answer first. */
export function skipAnswersOf(phases: readonly OnboardingPhaseEndpoint[]): SkipAnswer[] {
  return phases
    .flatMap((phase) => phase.steps)
    .flatMap((step) =>
      step.skip && step.skip.accepted !== null
        ? [
            {
              skipId: step.skip.id,
              stepId: step.id,
              stepTitle: step.title,
              approved: step.skip.accepted,
              comment: step.skip.reviewComment?.trim() || null,
              reviewedAt: step.skip.reviewedAt,
            },
          ]
        : [],
    )
    .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));
}

/**
 * Keyed per user, because two people share a browser more often than a path.
 *
 * Local storage rather than the backend, like the knowledge-gap owner notice: there is no endpoint
 * for "has this person seen the answer", and a notice that shows once more on a second machine is a
 * far smaller problem than one that cannot be dismissed. Moving it server-side means replacing
 * these functions.
 */
function seenKey(userId: string): string {
  return `sprintstart:onboarding-skip-answers-seen:${userId}`;
}

const SEEN_CHANGED_EVENT = "sprintstart:onboarding-skip-answers-seen";

/** The skip answers this user has already seen. Unreadable storage means none. */
export function readSeenSkipAnswers(userId: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

/** Records answers as seen, and tells anything showing a marker for them (the sidebar). */
export function markSkipAnswersSeen(userId: string, skipIds: readonly string[]): void {
  if (!userId || skipIds.length === 0) return;
  const seen = readSeenSkipAnswers(userId);
  skipIds.forEach((id) => seen.add(id));
  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify([...seen]));
  } catch {
    // Storage full or blocked: the notice simply shows again next time.
  }
  window.dispatchEvent(new Event(SEEN_CHANGED_EVENT));
}

/** Calls `listener` whenever answers are marked seen; returns the unsubscribe. */
export function onSkipAnswersSeenChanged(listener: () => void): () => void {
  window.addEventListener(SEEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SEEN_CHANGED_EVENT, listener);
}
