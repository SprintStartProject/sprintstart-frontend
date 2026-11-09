import { isEmptyContent } from "./summarizability";
import type { Artifact, ArtifactContent } from "./types";

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd"];
const PR_OR_ISSUE_TITLE_PREFIXES = ["pr #", "pull request", "issue #", "jira #"];
const PR_OR_ISSUE_URL_PARTS = ["/pull/", "/pull-requests/", "/issues/", "/browse/"];

function lowercased(value: string | null | undefined): string {
  return value?.toLowerCase() ?? "";
}

function isMarkdownFile(title: string): boolean {
  return MARKDOWN_EXTENSIONS.some((extension) => title.endsWith(extension));
}

function isPullRequestOrIssue(artifact: Artifact | null, title: string, sourceUrl: string) {
  return (
    artifact?.artifactType === "ISSUE" ||
    artifact?.artifactType === "PULL_REQUEST" ||
    PR_OR_ISSUE_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix)) ||
    PR_OR_ISSUE_URL_PARTS.some((part) => sourceUrl.includes(part))
  );
}

/**
 * Determines whether an artifact should be rendered as Markdown.
 * Issues, Pull Requests, Jira items, Confluence artifacts, and Markdown files (.md/.markdown) are always rendered as Markdown.
 * Confluence is detected via the connector (`connectorRendersMarkdown`) or a /wiki/spaces/ URL pattern.
 */
export const shouldRenderAsMarkdown = (
  content: ArtifactContent | null | undefined,
  artifact: Artifact | null,
  connectorRendersMarkdown: boolean,
): boolean => {
  if (!content) return false;
  const title = lowercased(artifact?.title);
  const sourceUrl = lowercased(artifact?.sourceUrl);

  return (
    content.mimeType.startsWith("text/markdown") ||
    isPullRequestOrIssue(artifact, title, sourceUrl) ||
    isMarkdownFile(title) ||
    connectorRendersMarkdown ||
    sourceUrl.includes("/wiki/spaces/")
  );
};

/** How the drawer shows an artifact's content. */
export type ContentKind = "empty" | "markdown" | "pdf" | "image" | "source";

/**
 * Picks how to show the content: a notice for an empty body, rendered markdown when it
 * is markdown and the reader wants it formatted, the browser's PDF or image viewer for
 * those, and a numbered source listing for everything else (also while nothing is loaded).
 */
export function contentKind(
  content: ArtifactContent | null,
  rendersMarkdown: boolean,
  markdownViewMode: "rendered" | "source",
): ContentKind {
  if (content && isEmptyContent(content)) return "empty";
  if (content && rendersMarkdown && markdownViewMode === "rendered") return "markdown";
  if (content?.mimeType === "application/pdf") return "pdf";
  if (content?.mimeType.startsWith("image/")) return "image";
  return "source";
}
