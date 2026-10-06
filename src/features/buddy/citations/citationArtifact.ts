import { sourceSystemOfCitation } from "../../data-ingestion/connectors/registry.ts";
import type { Artifact, ArtifactType } from "../../knowledge-base/types.ts";

/** What a clicked citation hands the surface so it can open the artifact drawer. */
export type CitationArtifactOpen = {
  artifactId: string;
  filename: string;
  sourceUrl?: string | null;
  lines: number[];
};

/**
 * Builds a stand-in {@link Artifact} for a chat citation, so the knowledge-base drawer can show it.
 *
 * A citation carries no source system, only the artifact's name and URL, so the connector
 * registry decides which connector the artifact came from. The drawer loads the real content by
 * id; the fields derived here only drive what it shows around that content, most visibly the
 * "Open in ..." link and whether the body renders as Markdown.
 */
export function deriveArtifactFromCitation(citation: CitationArtifactOpen): Artifact {
  const url = citation.sourceUrl?.toLowerCase() ?? "";
  const name = citation.filename.toLowerCase();

  let artifactType: ArtifactType = "FILE";
  if (
    url.includes("/pull/") ||
    url.includes("/pull-requests/") ||
    name.startsWith("pr #") ||
    name.startsWith("pull request")
  ) {
    artifactType = "PULL_REQUEST";
  } else if (
    url.includes("/issues/") ||
    url.includes("/browse/") ||
    name.startsWith("issue #") ||
    name.startsWith("jira #")
  ) {
    artifactType = "ISSUE";
  }

  const isMarkdown =
    artifactType === "ISSUE" ||
    artifactType === "PULL_REQUEST" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown");

  return {
    id: citation.artifactId,
    title: citation.filename,
    artifactType,
    sourceSystem: sourceSystemOfCitation(url, name),
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
