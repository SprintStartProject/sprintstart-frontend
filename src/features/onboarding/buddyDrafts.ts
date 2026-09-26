// ============================================================
// features/onboarding/buddyDrafts.ts
// ============================================================
// The first sentence of a conversation about something on the
// hire's path. Pre-filled into the buddy's composer, never sent
// for them.
// ============================================================

import type {
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "./types";

/**
 * Taking what you are looking at on your path into the conversation.
 *
 * The board already works this way (see `AskTheBuddy`): a surface seeds a question and the mentor
 * answers it with its own tools, which is why a card needs no action machinery of its own. The path
 * is the surface that wanted it most and did not have it — a hire stuck on a step, or on a question
 * they have now got wrong twice, was looking at the one page in the product with nobody to ask.
 *
 * **Written in the hire's voice, and as an opening rather than an instruction.** The draft lands in
 * the composer for them to change before it goes; a sentence that reads like a command from the page
 * is one they stop trusting as their own. That is also why these say what the hire wants rather than
 * what the mentor should do: the mentor has the path in front of it either way.
 *
 * Kept out of the components so the wording is in one place and the same subject always opens the
 * same way — the mentor's replies are inconsistent enough without the questions varying too.
 */

/** How much of somebody else's sentence is quoted into a draft before it is cut. */
const QUOTE_LIMIT = 120;

/** A quotable snippet of a title or a question, cut on a word boundary where there is one. */
function snippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= QUOTE_LIMIT) return trimmed;

  const cut = trimmed.slice(0, QUOTE_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > QUOTE_LIMIT / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Opening a conversation about the phase the hire is standing in. */
export function askAboutPhase(phase: OnboardingPhaseEndpoint): string {
  return `I'm on the "${snippet(phase.title)}" phase of my onboarding. Can you walk me through what it's for and where I should start?`;
}

/**
 * Opening a conversation about a phase that generated nothing.
 *
 * The case the buddy exists for on this page. An AI-enhanced phase whose project material was too
 * thin is honestly left empty rather than filled with invented advice, which leaves the hire with a
 * warning badge and nothing to do about it. Its title still says what it was meant to cover, so the
 * conversation can — and the mentor can offer to put the result on their path.
 */
export function askAboutEmptyPhase(phaseTitle: string): string {
  return `The "${snippet(phaseTitle)}" phase of my onboarding came back empty — nothing was generated for it. Can we work out together what it should contain for me?`;
}

/**
 * The same opening for every phase that came back empty at once, so a hire with several is not
 * handed a draft about only the first of them.
 */
export function askAboutEmptyPhases(phaseTitles: readonly string[]): string {
  if (phaseTitles.length === 1) return askAboutEmptyPhase(phaseTitles[0]);
  const names = phaseTitles.map((title) => `"${snippet(title)}"`);
  const listed = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `The ${listed} phases of my onboarding came back empty — nothing was generated for them. Can we work out together what they should contain for me?`;
}

/** Opening a conversation about one step. */
export function askAboutStep(step: Pick<OnboardingStepEndpoint, "title">): string {
  return `I'm on the onboarding step "${snippet(step.title)}". Can you help me get going on it?`;
}

/**
 * Opening a conversation about a knowledge question.
 *
 * Says out loud that the hire wants to understand it rather than be told the answer. The mentor is
 * not given the correct answer and will say so if asked — but a hire who opens by asking for it gets
 * a refusal as their first experience of the feature, and this is the cheapest way to not start
 * there.
 */
export function askAboutQuestion(question: OnboardingQuestionEndpoint, phaseTitle: string): string {
  return `I'm stuck on the knowledge question "${snippet(question.question)}" in "${snippet(phaseTitle)}". Can you go through the material with me? I'd rather work the answer out than be told it.`;
}

/** Opening a conversation about a question the hire has just got wrong. */
export function askAboutWrongAnswer(
  question: OnboardingQuestionEndpoint,
  phaseTitle: string,
): string {
  return `I just got the knowledge question "${snippet(question.question)}" in "${snippet(phaseTitle)}" wrong. Can you go through the material with me so I actually understand it before I try again?`;
}
