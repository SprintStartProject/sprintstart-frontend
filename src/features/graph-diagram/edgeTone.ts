/**
 * How an edge is drawn: satisfied, the one being worked through right now, still waiting, or —
 * while somebody is pointing at a node — one of the things standing in that node's way.
 *
 * The first three are states a graph with progress on it has. `upstream` is not a state: it is an
 * answer to "why is this shut", which only exists while a node is being pointed at, and it is
 * drawn apart from the other three so that the two halves of a lit run can be told apart at a
 * glance instead of by following arrowheads.
 */
export type JourneyEdgeTone = "done" | "active" | "waiting" | "upstream" | "rule";

/** What each style is called in a legend. */
const TONE_LABEL: Record<JourneyEdgeTone, string> = {
  done: "done",
  active: "ready now",
  waiting: "waiting",
  upstream: "comes first",
  rule: "locks",
};

export function toneLabel(tone: JourneyEdgeTone): string {
  return TONE_LABEL[tone];
}
