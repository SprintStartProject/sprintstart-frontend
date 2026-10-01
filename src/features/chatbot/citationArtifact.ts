import type { Artifact, ArtifactType, SourceSystem } from "../knowledge-base/types";

/** What a clicked citation hands the chat page so it can open the artifact drawer. */
export type CitationArtifactOpen = {
  artifactId: string;
  filename: string;
  sourceUrl?: string;
  lines: number[];
};

/**
 * Infers the source system of a cited artifact from its URL and name.
 *
 * Citations carry no source system, only the artifact's name and URL, so the URL host decides.
 * Confluence and Jira share the `atlassian.net` host and are told apart by Confluence's `/wiki/`
 * path. Uploads are stored without a URL, so a citation without one is treated as an upload.
 * Everything else is treated as GitHub.
 */
function inferSourceSystem(url: string, name: string): SourceSystem {
  if (!url) return "UPLOAD";
  if (url.includes("notion.so") || url.includes("notion.site")) return "NOTION";
  if (url.includes("atlassian.net/wiki/") || url.includes("/wiki/spaces/")) return "CONFLUENCE";
  if (url.includes("atlassian.net") || url.includes("/browse/") || name.startsWith("jira #")) {
    return "JIRA";
  }
  return "GITHUB";
}

/**
 * Builds a stand-in {@link Artifact} for a chat citation, so the knowledge-base drawer can show it.
 *
 * The drawer loads the real content by id; the fields derived here only drive what it shows around
 * that content, most visibly the "Open in ..." link and whether the body renders as Markdown.
 */
export function deriveArtifactFromCitation(citation: CitationArtifactOpen): Artifact {
  const url = citation.sourceUrl?.toLowerCase() ?? "";
  const name = citation.filename.toLowerCase();
  const sourceSystem = inferSourceSystem(url, name);

  let artifactType: ArtifactType = "FILE";
  if (sourceSystem === "CONFLUENCE" || sourceSystem === "NOTION") {
    artifactType = "PAGE";
  } else if (url.includes("/pull/") || name.startsWith("pr #") || name.startsWith("pull request")) {
    artifactType = "PULL_REQUEST";
  } else if (
    url.includes("/issues/") ||
    url.includes("/browse/") ||
    name.startsWith("issue #") ||
    name.startsWith("jira #")
  ) {
    artifactType = "ISSUE";
  }

  // Confluence and Notion pages are stored as Markdown, like issues and pull requests.
  const isMarkdown =
    artifactType === "ISSUE" ||
    artifactType === "PULL_REQUEST" ||
    artifactType === "PAGE" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown");

  return {
    id: citation.artifactId,
    title: citation.filename,
    artifactType,
    sourceSystem,
    sourceId: "",
    sourceUrl: citation.sourceUrl || null,
    mime: isMarkdown ? "text/markdown" : "text/plain",
    language: isMarkdown ? "Markdown" : null,
    ingestedAt: new Date().toISOString(),
    lastChangedAt: null,
    contentHash: null,
    ingestionRunId: null,
  };
}
