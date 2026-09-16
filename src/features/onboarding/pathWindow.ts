import { findActivePhaseIndex, isPhaseOpen } from "./activePhase.ts";
import type { GraphRuleNode } from "../graph-diagram/graphLayout.ts";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "./types.ts";

/** Where one phase in the window stands, from the point of view of the person walking it. */
export type PathWindowState = "done" | "current" | "ahead" | "locked";

export type PathWindowNode = GraphRuleNode & {
  title: string;
  state: PathWindowState;
  /** Steps finished out of steps there are, which is the one number a phase can be measured by. */
  progress: { done: number; total: number };
};

/**
 * The most nodes worth drawing in a strip on a board that is mostly other things.
 *
 * Deliberately small. The whole path already has a page of its own; what this answers is "where am
 * I", and that question is answered by a handful of neighbours, not by a map.
 */
const WINDOW_LIMIT = 5;

/**
 * The stretch of a hire's path around where they actually are.
 *
 * The board says a great many true things about a hire's work and never where they stand in the
 * path they were given. The path has a page of its own, and that page shows all of it — right for
 * "what is coming", useless for "what now", because the phase somebody is standing in is one of
 * sixteen boxes on it.
 *
 * So this is a window, not a map: the phase they are in, what had to happen before it, and what
 * finishing it opens. Three to five nodes. Anybody who wants the rest is one click from it.
 *
 * **Which neighbours.** The phases carry `blockerIds` copied from the blueprint, so where the path
 * has a real graph, this follows it — one hop each way, no further. Where it does not (a generated
 * path whose phases were never connected), position order is the honest fallback: it is the only
 * sequence that exists in that case, and the one the path page itself lists them in.
 *
 * Pure, so what a board draws can be checked without a board.
 */
export function pathWindow(path: OnboardingPathEndpoint): {
  nodes: PathWindowNode[];
  currentId: string | null;
} {
  const phases = [...path.phases].sort((left, right) => left.position - right.position);
  if (phases.length === 0) return { nodes: [], currentId: null };

  const activeIndex = findActivePhaseIndex(path);
  const current = phases[Math.min(activeIndex, phases.length - 1)];
  const byId = new Map(phases.map((phase) => [phase.id, phase]));

  const behind = (current.blockerIds ?? [])
    .map((id) => byId.get(id))
    .filter((phase): phase is OnboardingPhaseEndpoint => phase !== undefined);
  const ahead = phases.filter((phase) => (phase.blockerIds ?? []).includes(current.id));

  const index = phases.indexOf(current);
  const chosen =
    behind.length > 0 || ahead.length > 0
      ? [...behind, current, ...ahead]
      : phases.slice(Math.max(0, index - 1), index + 2);

  // Trimmed from the far end rather than the near one: the neighbours closest to where somebody
  // stands are the ones the question is about.
  const window = chosen.slice(0, WINDOW_LIMIT);
  const drawn = new Set(window.map((phase) => phase.id));

  return {
    currentId: current.id,
    nodes: window.map((phase) => ({
      id: phase.id,
      title: phase.title,
      // Never positioned: a board has nowhere to store a coordinate and nothing to store one for.
      // The strip is laid out by prerequisite every time it is drawn.
      graphX: null,
      graphY: null,
      blockerIds: (phase.blockerIds ?? []).filter((id) => drawn.has(id)),
      position: phase.position,
      state: stateOf(phase, current.id),
      progress: progressOf(phase),
    })),
  };
}

function stateOf(phase: OnboardingPhaseEndpoint, currentId: string): PathWindowState {
  if (phase.id === currentId) return "current";
  if (phase.locked) return "locked";
  return isPhaseOpen(phase) ? "ahead" : "done";
}

/**
 * Steps finished out of steps there are.
 *
 * Steps only, not questions. A knowledge check is a gate rather than a piece of work, and counting
 * it would make a phase somebody has worked all the way through read as unfinished because one
 * question is unanswered — which is a different thing and is already said by the state.
 */
function progressOf(phase: OnboardingPhaseEndpoint): { done: number; total: number } {
  return {
    done: phase.steps.filter((step) => step.status === "FINISHED" || step.status === "SKIPPED")
      .length,
    total: phase.steps.length,
  };
}
