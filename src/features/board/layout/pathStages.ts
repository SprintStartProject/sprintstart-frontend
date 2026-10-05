import { phaseState } from "../../onboarding/journey";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import type { BoardCard } from "../types";
import type { CardOrigins } from "./cardOrigins";
import { linkedTitles, titleKey } from "./stepLinks";
import type { BoardStage } from "./boardStructure";

/**
 * A card's stage, read off the onboarding path instead of set by hand.
 *
 * Now and Later used to be a second timeline the hire (or, through card blueprints, their PM) kept
 * next to the path — and since the path became the one plan (#311) it was a timeline nobody else
 * looked at. The path already knows where somebody stands: which phase is open, which ones come
 * after it. So the board asks the path instead of asking the hire.
 *
 * **Later means "belongs to a phase you cannot start yet"** — one still waiting on another phase —
 * and **Behind you** means "belongs to a phase you have finished"; everything else is Now. That is
 * the Onboarding page's own reading of a phase (`phaseState` in `journey.ts`): phases are not a
 * queue, several can be open at once, and the one the hire is working in need not be the lowest. A card is tied to
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

/** What the board needs from the path: the phase of every step and question, and where each is. */
export type PathPhases = {
  phaseOfStep: Map<string, string>;
  phaseOfQuestion: Map<string, string>;
  phaseIds: Set<string>;
  /** Phases still waiting on another phase that is not done. */
  aheadPhaseIds: Set<string>;
  /** Phases with nothing left in them: every step finished or skipped, every question passed. */
  finishedPhaseIds: Set<string>;
  /** Every step by its title as `[[…]]` matches it (see `stepLinks.ts`), first one on a tie. */
  stepByTitle: Map<string, string>;
};

/**
 * Reads the path once into the lookups a card's stage needs.
 *
 * "Ahead" is every phase the Onboarding page shows as locked. It used to be every open phase after
 * the first open one by position — which filed a phase the hire was already working in under Later
 * whenever an earlier one was still open beside it.
 */
export function pathPhases(path: OnboardingPathEndpoint): PathPhases {
  const phases = [...path.phases].sort((left, right) => left.position - right.position);

  const phaseOfStep = new Map<string, string>();
  const phaseOfQuestion = new Map<string, string>();
  const stepByTitle = new Map<string, string>();
  for (const phase of phases) {
    for (const step of phase.steps ?? []) {
      phaseOfStep.set(step.id, phase.id);
      const key = titleKey(step.title ?? "");
      if (key && !stepByTitle.has(key)) stepByTitle.set(key, step.id);
    }
    for (const question of phase.questions ?? []) phaseOfQuestion.set(question.id, phase.id);
  }

  const aheadPhaseIds = new Set(
    phases.filter((phase) => phaseState(phase) === "locked").map((phase) => phase.id),
  );

  return {
    phaseOfStep,
    phaseOfQuestion,
    phaseIds: new Set(phases.map((phase) => phase.id)),
    aheadPhaseIds,
    stepByTitle,
    finishedPhaseIds: new Set(
      phases.filter((phase) => phaseState(phase) === "done").map((phase) => phase.id),
    ),
  };
}

/** A piece of the path an in-app address points at. */
export type PathPlace = { kind: "step" | "question" | "phase"; id: string };

/**
 * Which piece of the path an in-app address points at, if it points at one.
 *
 * Every way the app writes a link into the path: `/onboarding/<stepId>` (the old step page, and what
 * a selection on it recorded), and `/onboarding?step=`, `?question=` or `?phase=` (what the buddy
 * writes, and what `onboardingOrigin.ts` records now). Anything else — a chat, the knowledge base —
 * points at nothing on the path.
 */
export function placeOfUrl(url: string): PathPlace | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://app.invalid");
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments[0] !== "onboarding") return null;

  const stepId = segments[1] ? decodeURIComponent(segments[1]) : parsed.searchParams.get("step");
  if (stepId) return { kind: "step", id: stepId };

  const questionId = parsed.searchParams.get("question");
  if (questionId) return { kind: "question", id: questionId };

  const phaseId = parsed.searchParams.get("phase");
  return phaseId ? { kind: "phase", id: phaseId } : null;
}

/** The phase an in-app address points into, if it points into one on this path. */
export function phaseOfUrl(url: string, phases: PathPhases): string | null {
  const place = placeOfUrl(url);
  if (!place) return null;

  if (place.kind === "step") return phases.phaseOfStep.get(place.id) ?? null;
  if (place.kind === "question") return phases.phaseOfQuestion.get(place.id) ?? null;

  return phases.phaseIds.has(place.id) ? place.id : null;
}

/** The step a card belongs to, if it belongs to one — readable without the path. */
export function stepOfCard(card: BoardCard, origins: CardOrigins): string | null {
  if (card.content.kind === "PATH_STEP") return card.content.stepId;

  const url = origins[card.id]?.url;
  const place = url ? placeOfUrl(url) : null;

  return place?.kind === "step" ? place.id : null;
}

/** The steps a note links to with `[[…]]` that are on this path, in order — see `stepLinks.ts`. */
export function linkedSteps(card: BoardCard, phases: PathPhases): string[] {
  if (card.content.kind !== "NOTE") return [];

  return linkedTitles(card.content.text)
    .map((title) => phases.stepByTitle.get(titleKey(title)))
    .filter((stepId): stepId is string => stepId !== undefined);
}

/**
 * The phase a card belongs to, if it belongs to one.
 *
 * Where it was kept wins; a note kept from nowhere in particular belongs to the first step it links
 * to with `[[…]]`.
 */
export function phaseOfCard(
  card: BoardCard,
  phases: PathPhases,
  origins: CardOrigins,
): string | null {
  if (card.content.kind === "PATH_STEP") {
    return card.content.stepId ? (phases.phaseOfStep.get(card.content.stepId) ?? null) : null;
  }

  const url = origins[card.id]?.url;
  const fromOrigin = url ? phaseOfUrl(url, phases) : null;
  if (fromOrigin) return fromOrigin;

  const [linked] = linkedSteps(card, phases);
  return linked ? (phases.phaseOfStep.get(linked) ?? null) : null;
}

/**
 * Whether a card belongs to one step, or to one phase.
 *
 * A phase holds what was kept from any of its steps as well as what was kept about the phase itself.
 * Without the path a phase can only be matched by name — a card kept while the phase was open — and
 * a card kept from one of its steps is not counted, which undercounts rather than guessing.
 */
export function isCardAt(
  card: BoardCard,
  place: { kind: "step" | "phase"; id: string },
  phases: PathPhases | null,
  origins: CardOrigins,
): boolean {
  if (place.kind === "step") {
    return (
      stepOfCard(card, origins) === place.id ||
      (phases !== null && linkedSteps(card, phases).includes(place.id))
    );
  }
  if (phases) return phaseOfCard(card, phases, origins) === place.id;

  const url = origins[card.id]?.url;
  const at = url ? placeOfUrl(url) : null;
  return at?.kind === "phase" && at.id === place.id;
}

/** The stage of every card on a board, given its path (or none) and where its cards came from. */
export function pathStages(phases: PathPhases | null, origins: CardOrigins): PathStages {
  return (card) => {
    if (!phases) return "NOW";

    const phaseId = phaseOfCard(card, phases, origins);

    if (!phaseId) return "NOW";
    if (phases.finishedPhaseIds.has(phaseId)) return "BEHIND";

    return phases.aheadPhaseIds.has(phaseId) ? "LATER" : "NOW";
  };
}
