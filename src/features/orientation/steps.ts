import type { OrientationStep } from "./types";

/**
 * What each step is called for a reader.
 *
 * Phrased as the thing you are doing, not as a topic — the segmentation is by
 * process, and the labels have to carry that or the packet reads as a course
 * again.
 */
export const STEP_LABELS: Record<OrientationStep, string> = {
  SET_UP: "Before you start",
  FIND_THE_CODE: "Find the code",
  MAKE_THE_CHANGE: "Make the change",
  CHECK_LOCALLY: "Check it locally",
  OPEN_THE_PR: "Open the pull request",
};

/**
 * The canonical order of the path to a pull request. The editor and the reader both walk it in this
 * order, so it is the single source of truth for "the five steps" — never re-listed at a call site.
 */
export const STEP_ORDER: OrientationStep[] = [
  "SET_UP",
  "FIND_THE_CODE",
  "MAKE_THE_CHANGE",
  "CHECK_LOCALLY",
  "OPEN_THE_PR",
];
