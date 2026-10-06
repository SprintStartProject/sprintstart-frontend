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

/**
 * Which project the artifact drawer must fetch within for a conversation.
 *
 * A conversation is about the project it was started in, and the drawer's content read is
 * project-scoped — so the conversation's own project wins over the global selection (the hire
 * may have switched since it started). A team conversation's project is the managed one: a hire
 * session sits behind the switch carrying its own project, and reading that one first opened the
 * drawer in the wrong project for a PM on several — so the managed project comes first. An
 * unscoped hire conversation falls back to whatever is selected. `null` means no project at all:
 * there is no drawer to open, and the caller offers the source link instead.
 */
export function citationDrawerProjectId(
  sessionProjectId: string | null | undefined,
  teamProjectId: string | null | undefined,
  selectedProjectId: string,
): string | null {
  return teamProjectId ?? sessionProjectId ?? (selectedProjectId || null);
}
