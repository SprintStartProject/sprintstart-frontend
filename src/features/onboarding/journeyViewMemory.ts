// ============================================================
// features/onboarding/journeyViewMemory.ts
// ============================================================
// Remembers how a path was last looked at -- list or graph, and
// which phase the graph was zoomed into -- so coming back does
// not mean switching and zooming all over again.
// ============================================================

export type JourneyViewMode = "list" | "graph";

export type JourneyView = {
  mode: JourneyViewMode;
  /** The phase the graph was zoomed into; null for the journey map. */
  graphPhaseId: string | null;
};

export const HIRE_JOURNEY_VIEW_KEY = "sprintstart.onboarding.view";
export const MEMBER_JOURNEY_VIEW_KEY = "sprintstart.memberJourney.view";

/**
 * The key for one member's journey as one manager looks at it.
 *
 * Both halves matter. The remembered *phase* is about the member's own path, so a key shared
 * between members applied the phase last opened for member A to member B. And browser storage is
 * per browser, not per account, so a key shared between managers hands one manager's view to
 * whoever signs in next on the same machine.
 */
export function memberJourneyViewKey(viewerId: string, memberId: string): string {
  return `${MEMBER_JOURNEY_VIEW_KEY}.${viewerId}.${memberId}`;
}

/** The same, for the hire's own path: one remembered view per account, not per browser. */
export function hireJourneyViewKey(userId: string): string {
  return `${HIRE_JOURNEY_VIEW_KEY}.${userId}`;
}

const DEFAULT_VIEW: JourneyView = { mode: "list", graphPhaseId: null };

/**
 * The last view stored under `key`, or the list when there is none.
 *
 * Browser storage can be missing, full or blocked; none of that is worth more than falling back to
 * the default, so every failure reads as "nothing remembered".
 */
export function readJourneyView(key: string): JourneyView {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as Partial<JourneyView>;
    return {
      mode: parsed.mode === "graph" ? "graph" : "list",
      graphPhaseId: typeof parsed.graphPhaseId === "string" ? parsed.graphPhaseId : null,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export function writeJourneyView(key: string, view: JourneyView): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // Not remembering is fine.
  }
}
