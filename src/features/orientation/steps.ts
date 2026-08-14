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
