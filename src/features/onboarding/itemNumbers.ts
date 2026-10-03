// ============================================================
// features/onboarding/itemNumbers.ts
// ============================================================
// The number a phase's steps and questions carry on screen, so
// a hire can say "let's do 3" to their buddy and mean this one.
// ============================================================

import type { OnboardingPhaseEndpoint } from "./types";

/**
 * The number each item of a phase is shown with, keyed by id.
 *
 * **Steps first in position order, then questions in position order.** That is the order this page
 * lists them in, and the order the buddy's path tool numbers them in — the same rule stated twice,
 * once per language, because the number is the whole point: a hire says "3" and the mentor has to
 * land on the item they were looking at. If the page's own order ever changes, `BuddyPathTools`
 * changes with it or the numbers start lying.
 *
 * Not `position` itself. Steps and questions carry their own positions underneath, so two items can
 * share one, and a hire counting down a single visible list would be right while the data disagreed.
 *
 * A number is not an identity — the buddy also gets each item's id and its link, and those are what
 * an action is aimed at. This exists so a person does not have to retype a title.
 */
export function itemNumbers(phase: OnboardingPhaseEndpoint): Map<string, number> {
  const steps = [...phase.steps].sort((a, b) => a.position - b.position);
  const questions = [...phase.questions].sort((a, b) => a.position - b.position);

  return new Map(
    [...steps.map((step) => step.id), ...questions.map((question) => question.id)].map(
      (id, index) => [id, index + 1],
    ),
  );
}
