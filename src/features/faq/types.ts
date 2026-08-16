// features/faq/types.ts

// ── SHARED ──────────────────────────────────────────────────

/**
 * How a group's or category's volume is moving, comparing the current trend
 * window against the one before it. A count alone can't tell a topic that is
 * picking up from one that was asked constantly a year ago and never since.
 */
export type FAQTrend = "RISING" | "STEADY" | "FADING";

// ── FAQ OVERVIEW ────────────────────────────────────────────

/**
 * One recurring question — the same thing asked in different words.
 *
 * `title` is what the list is read by: a generated phrase naming what the
 * entry is about, so a PM scans "Getting VPN access" instead of reading a
 * sentence per row. `question` is the wording users actually ask it in, kept
 * for the detail view.
 */
export interface FAQGroup {
  groupId: string;
  count: number;
  title: string;
  question: string;
  topDocuments: FAQDocumentPreview[];
  // Questions in the current trend window.
  recentCount?: number;
  trend?: FAQTrend;
  lastAskedAt?: string | null;
}

export interface FAQDocumentPreview {
  id: string;
  title: string;
}

export interface FAQOverview {
  groups: FAQGroup[];
  lastAskedAt?: string | null;
  /**
   * How many questions a rebuild would send to the AI service — already
   * capped, so this is what would actually happen rather than what exists.
   * When it equals `rebuildQuestionLimit` the project has more, and a rebuild
   * drops the older ones from the FAQ.
   */
  rebuildQuestionCount?: number;
  rebuildQuestionLimit?: number;
}

// ── FAQ DETAIL ──────────────────────────────────────────────

export interface FAQQuestion {
  id: string;
  text: string;
  askedAt?: string | null;
  // askedBy: FAQAskedBy[];
}

// export interface FAQAskedBy {
//     userId: string;
//     name: string;
//     askedAt: string;
// }

export interface FAQDocument {
  id: string;
  title: string;
  // Origin system (e.g. confluence, github). Optional — the AI service does not
  // always know the document's source, and it never provides a direct URL.
  source?: string;
}

export interface FAQDetail {
  groupId: string;
  count: number;
  title: string;
  question: string;
  questions: FAQQuestion[];
  answeringDocuments: FAQDocument[];
  recentCount?: number;
  trend?: FAQTrend;
  firstAskedAt?: string | null;
  lastAskedAt?: string | null;
}
