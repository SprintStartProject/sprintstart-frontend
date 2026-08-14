// features/faq/types.ts

// ── SHARED ──────────────────────────────────────────────────

/**
 * How a group's or category's volume is moving, comparing the current trend
 * window against the one before it. A count alone can't tell a topic that is
 * picking up from one that was asked constantly a year ago and never since.
 */
export type FAQTrend = "RISING" | "STEADY" | "FADING";

// ── FAQ OVERVIEW ────────────────────────────────────────────

export interface FAQGroup {
  groupId: string;
  count: number;
  question: string;
  topDocuments: FAQDocumentPreview[];
  // Topic bucket the group is filed under. Null for groups that predate
  // categories and haven't been re-classified yet.
  category?: string | null;
  // Questions in the current trend window.
  recentCount?: number;
  trend?: FAQTrend;
  lastAskedAt?: string | null;
}

export interface FAQDocumentPreview {
  id: string;
  title: string;
}

/**
 * A topic bucket holding several question groups. Ordered by *recent* volume
 * rather than all-time count, so a topic that is picking up sits above one
 * that was busy months ago and has gone quiet since.
 */
export interface FAQCategory {
  name: string;
  groupCount: number;
  questionCount: number;
  recentQuestionCount: number;
  trend: FAQTrend;
  lastAskedAt: string;
}

export interface FAQOverview {
  groups: FAQGroup[];
  // Absent on responses from a backend that predates categories.
  categories?: FAQCategory[];
  lastAskedAt?: string | null;
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
  questions: FAQQuestion[];
  answeringDocuments: FAQDocument[];
  category?: string | null;
  recentCount?: number;
  trend?: FAQTrend;
  firstAskedAt?: string | null;
  lastAskedAt?: string | null;
}
