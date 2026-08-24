import type { HireTimeline } from "./types";

/**
 * True when a hire has put work up and nobody has looked yet: a contribution was
 * opened, no first response has landed, and something is still open. The wait is
 * on somebody else, not on the hire.
 *
 * Shared so the page filter (`needsAttention`) and the timeline card's
 * "Waiting … on a response" badge read the same condition and can't drift apart.
 */
export function isAwaitingFirstResponse(hire: HireTimeline): boolean {
  return (
    hire.firstContributionOpenedAt !== null &&
    hire.firstResponseAt === null &&
    hire.openContributionCount > 0
  );
}
