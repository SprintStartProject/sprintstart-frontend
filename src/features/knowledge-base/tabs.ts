export type KnowledgeTab =
  "ALL" | "UPLOADS" | "PR" | "ISSUES" | "FILES" | "COMMITS" | "ORGANIZATIONS";

/**
 * Left-to-right order of the artifact type tabs.
 *
 * Single source of truth: `ArtifactFilters` renders the bar from this list and
 * `KnowledgeBasePage` derives the slide direction of the content from it, so
 * the content always travels the same way the active indicator does.
 *
 * Lives outside the component file because a component module may not export
 * constants (`react-refresh/only-export-components`).
 */
export const TABS: { id: KnowledgeTab; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "UPLOADS", label: "Uploads" },
  { id: "PR", label: "PR" },
  { id: "ISSUES", label: "Issues" },
  { id: "FILES", label: "Files" },
  { id: "COMMITS", label: "Commits" },
  { id: "ORGANIZATIONS", label: "Organizations" },
];

/**
 * Just the ids, in the same order. Kept beside `TABS` so the swipe gesture and
 * the bar can never disagree about what comes next.
 */
export const KNOWLEDGE_TAB_ORDER: KnowledgeTab[] = TABS.map((tab) => tab.id);
