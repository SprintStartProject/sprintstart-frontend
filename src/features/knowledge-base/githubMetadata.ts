/**
 * Type mapping + tolerant parser for the metadata JSON string the backend ships
 * on GitHub-sourced artifacts (`COMMIT`, `FILE`, `ISSUE`, `PULL_REQUEST`).
 *
 * The backend DTO (`GithubArtifactMetadata` in sprintstart-backend) serializes
 * `{ repositoryId, repositoryFullName }` into the artifact's `metadata` field,
 * with `repositoryFullName` always assembled as `owner/repository`. Centralizing
 * the parse keeps consumers (the artifact list card and the viewer drawer) free
 * of ad-hoc `JSON.parse` + shape handling, and guarantees malformed metadata can
 * never crash the UI or leak raw JSON into it.
 */

import type { Artifact } from "./types";

export interface GithubArtifactMetadata {
  /**
   * GitHub repository id (a UUID, stringified on the wire). The backend always
   * sends it next to `repositoryFullName`, but nothing renders it, so it stays
   * declared-but-unconsumed and optional in the parsed shape.
   */
  repositoryId?: string;
  /** `owner/repository` display string, as assembled by the backend mapper. */
  repositoryFullName: string;
}

/**
 * Parses a GitHub artifact's `metadata` JSON string.
 *
 * Tolerant by design, mirroring {@link parseOrgMetadata}: returns `null` for
 * anything that cannot be turned into a usable repository reference —
 * `null`/`undefined` input, empty or whitespace-only string, malformed JSON,
 * JSON that is not a plain object, or a missing/blank `repositoryFullName`.
 * Only fields the UI actually renders are validated; the backend always sends
 * `repositoryId` alongside, but nothing consumes it.
 *
 * @param json The raw `artifact.metadata` string (may be omitted).
 * @returns The parsed metadata, or `null` when the input is not usable.
 */
export function parseGithubMetadata(
  json: string | null | undefined,
): GithubArtifactMetadata | null {
  if (typeof json !== "string" || json.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // A malformed blob (never expected from the backend, but cheap to guard
    // against) must not crash the UI — degrade to the same "no repository"
    // state as missing metadata.
    console.warn("Ignoring unparseable GitHub artifact metadata", json);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const repositoryFullName = (parsed as Record<string, unknown>)["repositoryFullName"];
  if (typeof repositoryFullName !== "string" || repositoryFullName.trim() === "") {
    return null;
  }

  return parsed as GithubArtifactMetadata;
}

/**
 * Resolves the display repository (`owner/repository`) for an artifact, or
 * `null` when the artifact has no repository to show.
 *
 * Only GitHub's repo-scoped artifact types carry repository metadata. GitHub's
 * `ORG_METADATA` artifacts are also `sourceSystem === "GITHUB"`, but their
 * metadata is the org profile (no repository fields), so they are excluded
 * explicitly — letting them through would run the org JSON through the repo
 * parser and always fail. Non-GitHub source systems (`UPLOAD`, `JIRA`,
 * `CONFLUENCE`, including their `PAGE` artifacts) carry different metadata
 * shapes and are excluded by the source-system check.
 *
 * @param artifact The artifact whose metadata should be interpreted.
 * @returns The `owner/repository` string, or `null`.
 */
export function getArtifactRepository(
  artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata">,
): string | null {
  if (artifact.sourceSystem !== "GITHUB" || artifact.artifactType === "ORG_METADATA") {
    return null;
  }
  return parseGithubMetadata(artifact.metadata)?.repositoryFullName ?? null;
}
