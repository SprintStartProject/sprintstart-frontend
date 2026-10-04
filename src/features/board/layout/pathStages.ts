import { findActivePhaseIndex, isPhaseOpen } from "../../onboarding/activePhase";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import type { BoardCard } from "../types";
import type { CardOrigins } from "./cardOrigins";
import type { BoardStage } from "./boardStructure";

/**
 * A card's stage, read off the onboarding path instead of set by hand.
 *
 * Now and Later used to be a second timeline the hire (or, through card blueprints, their PM) kept
 * next to the path — and since the path became the one plan (#311) it was a timeline nobody else
 * looked at. The path already knows where somebody stands: which phase is open, which ones come
 * after it. So the board asks the path instead of asking the hire.
 *
 * **Later means "belongs to a phase you have not reached yet"**, and nothing else. A card is tied to
 * a phase through its origin: the live step card names its step, and a card kept while a step or a
 * phase was open on the Onboarding page carries it as its origin (`onboardingOrigin.ts`). A card
 * tied to nothing — most notes, the current task, the
 * pull requests — is about the work in front of the hire, so it is Now. That is also why a board
 * with no path reads as a single band, which the grid does not draw: no path, no ramp.
 *
 * Derived on every render rather than stored, for the same reason "blocked" is: the moment the hire
 * finishes a phase, the cards that were waiting for the next one move up without anybody touching
 * them.
 */
export type PathStages = (card: BoardCard) => BoardStage;

/** What the board needs from the path: the phase of every step and question, and which lie ahead. */
export type PathPhases = {
  phaseOfStep: Map<string, string>;
  phaseOfQuestion: Map<string, string>;
  phaseIds: Set<string>;
  aheadPhaseIds: Set<string>;
};

/**
 * Reads the path once into the two lookups a card's stage needs.
 *
 * "Ahead" is every phase after the one the hire is in that is still open. The active phase is the
 * first open one by position — the rule the Onboarding page and the PM's view of a member already
 * share — and a later phase that happens to be finished already is nothing to wait for.
 */
export function pathPhases(path: OnboardingPathEndpoint): PathPhases {
  const phases = [...path.phases].sort((left, right) => left.position - right.position);
  const activeIndex = findActivePhaseIndex({ ...path, phases });

  const phaseOfStep = new Map<string, string>();
  const phaseOfQuestion = new Map<string, string>();
  for (const phase of phases) {
    for (const step of phase.steps ?? []) phaseOfStep.set(step.id, phase.id);
    for (const question of phase.questions ?? []) phaseOfQuestion.set(question.id, phase.id);
  }

  const aheadPhaseIds = new Set(
    phases
      .filter((phase, index) => index > activeIndex && isPhaseOpen(phase))
      .map((phase) => phase.id),
  );

  return {
    phaseOfStep,
    phaseOfQuestion,
    phaseIds: new Set(phases.map((phase) => phase.id)),
    aheadPhaseIds,
  };
}

/**
 * The phase an in-app address points into, if it points into one.
 *
 * Every way the app writes a link to a piece of the path: `/onboarding/<stepId>` (the old step page,
 * and what a selection on it recorded), and `/onboarding?step=`, `?question=` or `?phase=` (what the
 * buddy writes, and what `onboardingOrigin.ts` records now). Anything else — a chat, the knowledge
 * base — points into no phase.
 */
export function phaseOfUrl(url: string, phases: PathPhases): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://app.invalid");
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments[0] !== "onboarding") return null;

  const stepId = segments[1] ? decodeURIComponent(segments[1]) : parsed.searchParams.get("step");
  if (stepId) return phases.phaseOfStep.get(stepId) ?? null;

  const questionId = parsed.searchParams.get("question");
  if (questionId) return phases.phaseOfQuestion.get(questionId) ?? null;

  const phaseId = parsed.searchParams.get("phase");
  return phaseId && phases.phaseIds.has(phaseId) ? phaseId : null;
}

/** The phase a card belongs to, if it belongs to one. */
export function phaseOfCard(
  card: BoardCard,
  phases: PathPhases,
  origins: CardOrigins,
): string | null {
  if (card.content.kind === "PATH_STEP") {
    return card.content.stepId ? (phases.phaseOfStep.get(card.content.stepId) ?? null) : null;
  }

  const url = origins[card.id]?.url;
  return url ? phaseOfUrl(url, phases) : null;
}

/** The stage of every card on a board, given its path (or none) and where its cards came from. */
export function pathStages(phases: PathPhases | null, origins: CardOrigins): PathStages {
  return (card) => {
    if (!phases) return "NOW";

    const phaseId = phaseOfCard(card, phases, origins);

    return phaseId && phases.aheadPhaseIds.has(phaseId) ? "LATER" : "NOW";
  };
}
