import type { KnowledgeGapOverview } from "./types";

/**
 * Which of the four "nothing to list" situations the panel is in.
 *
 * These used to share one message and one icon, which made the two that matter
 * indistinguishable: a scan that finished and found nothing looked exactly like
 * a project that had never been scanned, and the shared text asked the PM to
 * trigger a scan that had just run. `refreshedAt` is what tells them apart —
 * the backend records every scan, including the ones that write no gaps.
 */
export type KnowledgeGapsEmptyState = "error" | "scanning" | "clean" | "unscanned";

export interface KnowledgeGapsEmptyStateInfo {
  state: KnowledgeGapsEmptyState;
  message: string;
  /** The scan this message describes, when there is one worth dating. */
  scannedAt: string | null;
}

/**
 * Classifies an empty knowledge-gaps result so the page and the dashboard
 * widget say the same thing about it.
 *
 * Order matters: a failed load knows nothing about scans, and a running rescan
 * describes the panel better than the previous result it is about to replace.
 */
export function describeEmptyState(
  overview: KnowledgeGapOverview | null,
  error: boolean,
): KnowledgeGapsEmptyStateInfo {
  if (error || !overview) {
    return {
      state: "error",
      message: "Could not load knowledge gaps. Is the backend reachable?",
      scannedAt: null,
    };
  }

  if (overview.refreshing) {
    return {
      state: "scanning",
      message: "Scanning the newly ingested documentation…",
      scannedAt: null,
    };
  }

  if (overview.refreshedAt) {
    return {
      state: "clean",
      // Deliberately not "no gaps found": components without gaps are listed
      // now, as "covered". An empty result therefore means the scan found no
      // components at all — nothing has been ingested for this project yet.
      message: "The last scan found no ingested repositories to report on.",
      scannedAt: overview.refreshedAt,
    };
  }

  return {
    state: "unscanned",
    message: "No scan has run yet. Trigger one to detect documentation gaps.",
    scannedAt: null,
  };
}
