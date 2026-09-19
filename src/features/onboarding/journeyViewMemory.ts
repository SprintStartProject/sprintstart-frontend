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
