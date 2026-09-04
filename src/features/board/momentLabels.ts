import { CONTRIBUTION_WORDING } from "../../config/contributionWording";
import type { BoardMomentKey } from "./types";

/**
 * What each moment on the path is called.
 *
 * The two middle moments are built from the track's noun rather than named after git, because the
 * moments themselves are not about git — somebody whose work is a facilitated ceremony still
 * submits it and still waits for somebody to respond.
 *
 * Lives here rather than beside one of its two renderers: the path is drawn as a rail in the board
 * header and as a card in the grid, and the same moment must not be able to answer to two names
 * depending on which one you are looking at.
 */
export function momentLabel(key: BoardMomentKey): string {
  switch (key) {
    case "JOINED":
      return "Joined";
    case "TASK_CLAIMED":
      return "Task claimed";
    case "WORK_SUBMITTED":
      return `First ${CONTRIBUTION_WORDING.noun} submitted`;
    case "FIRST_RESPONSE":
      return "Somebody responded";
    case "WORK_ACCEPTED":
      return `First ${CONTRIBUTION_WORDING.noun} ${CONTRIBUTION_WORDING.verbPast}`;
  }
}

/** The one-line summary the path carries above it, in both of its forms. */
export function pathSummary(acceptedCount: number): string {
  if (acceptedCount === 0) {
    return `Nothing ${CONTRIBUTION_WORDING.verbPast} yet — that's normal early on`;
  }
  const noun = acceptedCount === 1 ? CONTRIBUTION_WORDING.noun : CONTRIBUTION_WORDING.nounPlural;
  return `${acceptedCount} ${noun} ${CONTRIBUTION_WORDING.verbPast}`;
}
