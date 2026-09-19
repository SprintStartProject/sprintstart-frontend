import type { Artifact, ArtifactType, SourceSystem } from "./types";

/**
 * Human-readable display names for the artifact sources (connectors).
 */
export const SOURCE_LABELS: Record<SourceSystem, string> = {
  GITHUB: "GitHub",
  JIRA: "Jira",
  CONFLUENCE: "Confluence",
  UPLOAD: "Uploads",
};

/**
 * Standard left-to-right order for the source facet.
 */
export const DEFAULT_SOURCE_ORDER: SourceSystem[] = ["GITHUB", "JIRA", "CONFLUENCE", "UPLOAD"];

/**
 * Human-readable display names for artifact types.
 *
 * Deliberately one label per *type*, not per connector: Jira's issues and
 * GitHub's issues are the same `ArtifactType`, so calling one "Issues" and the
 * other "Tickets" made a single facet look like two — and let a reader select
 * both without narrowing anything.
 */
export const TYPE_LABELS: Record<ArtifactType, string> = {
  PULL_REQUEST: "Pull requests",
  // Both words, because a Jira reader looks for "tickets" and a GitHub reader
  // looks for "issues", and they are the same facet.
  ISSUE: "Issues & tickets",
  FILE: "Files",
  PAGE: "Docs",
  COMMIT: "Commits",
  ORG_METADATA: "Organization",
};

/**
 * Standard order for the type facet, filtered down to the types a project
 * actually contains before it is rendered.
 */
export const DEFAULT_TYPE_ORDER: ArtifactType[] = [
  "PULL_REQUEST",
  "ISSUE",
  "FILE",
  "PAGE",
  "COMMIT",
  "ORG_METADATA",
];

/**
 * Top-level tabs for filtering artifacts by type in SegmentedTabs.
 *
 * "ALL" means all artifact types. Selecting a specific tab narrows the view
 * to that single ArtifactType while allowing multi-source selection beneath it.
 */
export type KnowledgeTab = "ALL" | ArtifactType;

export interface KnowledgeTabDef {
  id: KnowledgeTab;
  label: string;
  type?: ArtifactType;
}

export const KNOWLEDGE_TABS: readonly KnowledgeTabDef[] = [
  { id: "ALL", label: "All" },
  { id: "PULL_REQUEST", label: "Pull requests", type: "PULL_REQUEST" },
  { id: "ISSUE", label: "Issues", type: "ISSUE" },
  { id: "FILE", label: "Files", type: "FILE" },
  { id: "PAGE", label: "Docs", type: "PAGE" },
  { id: "COMMIT", label: "Commits", type: "COMMIT" },
  { id: "ORG_METADATA", label: "Organization", type: "ORG_METADATA" },
] as const;

export const KNOWLEDGE_TAB_ORDER: readonly KnowledgeTab[] = KNOWLEDGE_TABS.map((tab) => tab.id);

/**
 * File formats a reader can narrow *uploaded* artifacts to.
 *
 * Not a source type and not an artifact type: an upload's format only exists
 * for uploads, so this facet is offered only while `UPLOAD` is part of the
 * source selection (see `useKnowledgeBase`).
 */
export type UploadFormat = "PDF" | "MARKDOWN" | "IMAGE" | "OTHER";

/** Human-readable display names for the file-format facet. */
export const FORMAT_LABELS: Record<UploadFormat, string> = {
  PDF: "PDFs",
  MARKDOWN: "Markdown",
  IMAGE: "Images",
  OTHER: "Other",
};

/** Standard order for the file-format facet. */
export const DEFAULT_FORMAT_ORDER: UploadFormat[] = ["PDF", "MARKDOWN", "IMAGE", "OTHER"];

/** Whether an artifact came from a direct upload rather than a connector. */
export function isUpload(artifact: Artifact): boolean {
  return artifact.sourceSystem === "UPLOAD";
}

/**
 * Extensions that mark an uploaded file as an image.
 *
 * The backend's `ArtifactResponse` omits `mime` and puts the upload's UUID in
 * `sourceId`, so the filename in `title` is the only dependable signal; `mime`
 * and `sourceUrl` are checked as bonuses for fixtures and older rows.
 */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"];

function isPdfArtifact(artifact: Artifact): boolean {
  const title = artifact.title?.toLowerCase() ?? "";
  const sourceId = artifact.sourceId.toLowerCase();
  const sourceUrl = artifact.sourceUrl?.toLowerCase() ?? "";
  const mime = artifact.mime?.toLowerCase() ?? "";

  return (
    mime.includes("pdf") ||
    title.endsWith(".pdf") ||
    sourceId.endsWith(".pdf") ||
    sourceUrl.endsWith(".pdf")
  );
}

function isMarkdownArtifact(artifact: Artifact): boolean {
  const title = artifact.title?.toLowerCase() ?? "";
  const sourceId = artifact.sourceId.toLowerCase();
  const sourceUrl = artifact.sourceUrl?.toLowerCase() ?? "";
  const mime = artifact.mime?.toLowerCase() ?? "";
  const language = artifact.language?.toLowerCase() ?? "";

  return (
    mime.includes("markdown") ||
    language === "markdown" ||
    language === "md" ||
    title.endsWith(".md") ||
    title.endsWith(".markdown") ||
    sourceId.endsWith(".md") ||
    sourceId.endsWith(".markdown") ||
    sourceUrl.endsWith(".md") ||
    sourceUrl.endsWith(".markdown")
  );
}

/** Whether an uploaded artifact is an image. */
export function isImageArtifact(artifact: Artifact): boolean {
  const title = artifact.title?.toLowerCase() ?? "";
  const sourceUrl = artifact.sourceUrl?.toLowerCase() ?? "";
  const mime = artifact.mime?.toLowerCase() ?? "";

  return (
    mime.startsWith("image/") ||
    IMAGE_EXTENSIONS.some((extension) => title.endsWith(extension) || sourceUrl.endsWith(extension))
  );
}

/**
 * Uploaded artifacts that are none of the named formats — the bucket the
 * "Other" option stands for. Images used to fall in here; they now have their
 * own option, so this predicate excludes them.
 */
export function isOtherUpload(artifact: Artifact): boolean {
  return !isPdfArtifact(artifact) && !isMarkdownArtifact(artifact) && !isImageArtifact(artifact);
}

/**
 * Whether an artifact satisfies a chosen file format.
 *
 * Artifacts from a connector are **out of this facet's scope and always
 * match**: the format options describe uploads, so selecting "GitHub + Uploads
 * + PDFs" must not hide the GitHub artifacts — it narrows only the uploads.
 * Keeping that rule here rather than at each call site is what stops it from
 * being re-derived, slightly differently, in the filter and in the counts.
 */
export function matchesFormat(artifact: Artifact, format: UploadFormat): boolean {
  if (!isUpload(artifact)) return true;

  switch (format) {
    case "PDF":
      return isPdfArtifact(artifact);
    case "MARKDOWN":
      return isMarkdownArtifact(artifact);
    case "IMAGE":
      return isImageArtifact(artifact);
    case "OTHER":
      return isOtherUpload(artifact);
  }
}
