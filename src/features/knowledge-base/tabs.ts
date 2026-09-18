import type { Artifact, SourceSystem } from "./types";

/**
 * Primary connector tabs representing the platform or source of the artifact.
 */
export type ConnectorTab = "ALL" | SourceSystem;

/**
 * Human-readable display names for connector tabs.
 */
export const CONNECTOR_LABELS: Record<ConnectorTab, string> = {
  ALL: "All",
  GITHUB: "GitHub",
  JIRA: "Jira",
  CONFLUENCE: "Confluence",
  UPLOAD: "Uploads",
};

/**
 * Standard left-to-right order for connector tabs.
 */
export const DEFAULT_CONNECTOR_ORDER: ConnectorTab[] = [
  "ALL",
  "GITHUB",
  "JIRA",
  "CONFLUENCE",
  "UPLOAD",
];

/**
 * Definition of a contextual underfilter.
 */
export interface SubfilterOption {
  id: string;
  label: string;
  matches: (artifact: Artifact) => boolean;
}

function isPdfArtifact(a: Artifact): boolean {
  const title = a.title?.toLowerCase() ?? "";
  const sourceId = a.sourceId.toLowerCase();
  const sourceUrl = a.sourceUrl?.toLowerCase() ?? "";
  const mime = a.mime?.toLowerCase() ?? "";

  return (
    mime.includes("pdf") ||
    title.endsWith(".pdf") ||
    sourceId.endsWith(".pdf") ||
    sourceUrl.endsWith(".pdf")
  );
}

function isMarkdownArtifact(a: Artifact): boolean {
  const title = a.title?.toLowerCase() ?? "";
  const sourceId = a.sourceId.toLowerCase();
  const sourceUrl = a.sourceUrl?.toLowerCase() ?? "";
  const mime = a.mime?.toLowerCase() ?? "";
  const lang = a.language?.toLowerCase() ?? "";

  return (
    mime.includes("markdown") ||
    lang === "markdown" ||
    lang === "md" ||
    title.endsWith(".md") ||
    title.endsWith(".markdown") ||
    sourceId.endsWith(".md") ||
    sourceId.endsWith(".markdown") ||
    sourceUrl.endsWith(".md") ||
    sourceUrl.endsWith(".markdown")
  );
}

/**
 * Contextual underfilters declared per connector.
 */
export const CONNECTOR_SUBFILTERS: Record<ConnectorTab, SubfilterOption[]> = {
  ALL: [
    { id: "ALL", label: "All", matches: () => true },
    { id: "PR", label: "PRs", matches: (a) => a.artifactType === "PULL_REQUEST" },
    { id: "ISSUES", label: "Issues", matches: (a) => a.artifactType === "ISSUE" },
    { id: "FILES", label: "Files", matches: (a) => a.artifactType === "FILE" },
    {
      id: "PAGES",
      label: "Docs",
      matches: (a) => a.artifactType === "PAGE",
    },
    { id: "COMMITS", label: "Commits", matches: (a) => a.artifactType === "COMMIT" },
    {
      id: "ORGANIZATIONS",
      label: "Org",
      matches: (a) => a.artifactType === "ORG_METADATA",
    },
  ],
  GITHUB: [
    { id: "ALL", label: "All", matches: () => true },
    { id: "PR", label: "PRs", matches: (a) => a.artifactType === "PULL_REQUEST" },
    { id: "ISSUES", label: "Issues", matches: (a) => a.artifactType === "ISSUE" },
    { id: "FILES", label: "Files", matches: (a) => a.artifactType === "FILE" },
    { id: "COMMITS", label: "Commits", matches: (a) => a.artifactType === "COMMIT" },
    {
      id: "ORGANIZATIONS",
      label: "Org",
      matches: (a) => a.artifactType === "ORG_METADATA",
    },
  ],
  JIRA: [
    { id: "ALL", label: "All", matches: () => true },
    { id: "ISSUES", label: "Tickets", matches: (a) => a.artifactType === "ISSUE" },
  ],
  CONFLUENCE: [
    { id: "ALL", label: "All", matches: () => true },
    { id: "PAGE", label: "Pages", matches: (a) => a.artifactType === "PAGE" },
  ],
  UPLOAD: [
    { id: "ALL", label: "All", matches: () => true },
    {
      id: "PDF",
      label: "PDFs",
      matches: isPdfArtifact,
    },
    {
      id: "MARKDOWN",
      label: "Markdown",
      matches: isMarkdownArtifact,
    },
    {
      id: "OTHER",
      label: "Other",
      matches: (a) => !isPdfArtifact(a) && !isMarkdownArtifact(a),
    },
  ],
};
