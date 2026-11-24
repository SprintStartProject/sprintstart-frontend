import { phaseItems, type PhaseItem } from "./journey";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
} from "../../services/onboardingTypes";

/**
 * What a visit was sent to the page for.
 *
 * A step or a question arrives by address or router state and unfolds; the chooser asks for the
 * phase picker; a `link-*` arrives from the buddy and only *lands*: the phase opens and the item is
 * found and lit, but nothing is started -- following a link in a conversation is a way of finding
 * something, and starting it is the hire's own click.
 */
export type Arrival = {
  kind: "step" | "question" | "choose" | "link-step" | "link-question" | "link-phase";
  id: string;
} | null;

export type ArrivalPlan =
  /** Bring the phase chooser into view, with nothing unfolded. */
  | { type: "chooser" }
  /** What was asked for is not on the path (it may have been replaced when the path was rebuilt). */
  | { type: "missing"; message: string; link: boolean }
  /** A link to a phase: select it. */
  | { type: "phase"; phase: OnboardingPhaseEndpoint }
  /** A link to a step or question: select its phase, light it, and unfold it only if asked. */
  | { type: "land"; phaseId: string; itemId: string; unfold: boolean }
  /** A step or question by address: select its phase, unfold it, scroll to it, start a waiting step. */
  | { type: "open"; phaseId: string; item: PhaseItem };

const NOT_ON_PATH: Record<string, string> = {
  "link-phase": "That phase is not on your path",
  question: "That question is not on your path",
  "link-question": "That question is not on your path",
};

function missing(kind: string): ArrivalPlan {
  return {
    type: "missing",
    message: NOT_ON_PATH[kind] ?? "That step is not on your path",
    // A link is taken out of the address; a step or question address goes back to the plain page.
    link: kind === "link-phase",
  };
}

/** The step or question with this id, and the phase holding it. */
function findItem(
  path: OnboardingPathEndpoint,
  itemId: string,
): { phase: OnboardingPhaseEndpoint; item: PhaseItem } | undefined {
  for (const phase of path.phases) {
    const item = phaseItems(phase).find((candidate) => candidate.id === itemId);
    if (item) return { phase, item };
  }
  return undefined;
}

/**
 * Works out what an arrival should do on this path, without doing it.
 *
 * Each arrival does the same things: check the target is still on the path, put the view where the
 * target unfolds, start a step that was opened for the first time, and scroll to it. This is the
 * checking, and the choosing between those.
 */
export function planArrival(
  arrival: NonNullable<Arrival>,
  path: OnboardingPathEndpoint,
  linkOpensStep: boolean,
): ArrivalPlan {
  if (arrival.kind === "choose") return { type: "chooser" };

  if (arrival.kind === "link-phase") {
    const phase = path.phases.find((candidate) => candidate.id === arrival.id);
    return phase ? { type: "phase", phase } : missing(arrival.kind);
  }

  const found = findItem(path, arrival.id);
  if (!found) return missing(arrival.kind);

  if (arrival.kind === "link-step" || arrival.kind === "link-question") {
    return {
      type: "land",
      phaseId: found.phase.id,
      itemId: arrival.id,
      unfold: arrival.kind === "link-step" && linkOpensStep,
    };
  }

  return { type: "open", phaseId: found.phase.id, item: found.item };
}
