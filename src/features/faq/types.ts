// features/insights/types.ts

// ── FAQ OVERVIEW ────────────────────────────────────────────

export interface FAQGroup {
  groupId: string;
  count: number;
  question: string;
  topDocuments: FAQDocumentPreview[];
}

export interface FAQDocumentPreview {
  id: string;
  title: string;
}

export interface FAQOverview {
  groups: FAQGroup[];
}

// ── FAQ DETAIL ──────────────────────────────────────────────

export interface FAQQuestion {
  id: string;
  text: string;
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
}
