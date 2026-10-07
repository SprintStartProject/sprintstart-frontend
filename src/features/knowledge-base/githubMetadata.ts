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
 *
 * Bitbucket artifacts carry `{ repositoryId, workspace, slug }` instead (see
 * {@link parseBitbucketMetadata}); both shapes resolve to the same
 * `owner/repository` display string, so the card badge and the repository facet
 * treat the two providers alike.
 */

import type { Artifact } from "./types";
import { parseOrgMetadata } from "./orgMetadata";

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
 * Reads a metadata string as a plain JSON object, or `null` when it is missing,
 * blank, malformed or not an object. `source` only names the provider in the
 * warning logged for a malformed blob.
 */
function readMetadataObject(
  json: string | null | undefined,
  source: string,
): Record<string, unknown> | null {
  if (typeof json !== "string" || json.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // A malformed blob (never expected from the backend, but cheap to guard
    // against) must not crash the UI — degrade to the same "no repository"
    // state as missing metadata.
    console.warn(`Ignoring unparseable ${source} artifact metadata`, json);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
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
 * @param json - The raw `artifact.metadata` string (may be omitted).
 * @returns The parsed metadata, or `null` when the input is not usable.
 */
export function parseGithubMetadata(
  json: string | null | undefined,
): GithubArtifactMetadata | null {
  const payload = readMetadataObject(json, "GitHub");
  if (payload === null) return null;

  const repositoryFullName = payload["repositoryFullName"];
  if (typeof repositoryFullName !== "string" || repositoryFullName.trim() === "") {
    return null;
  }

  // Normalize here rather than at every consumer: a stray `"  owner/repo  "`
  // must not become a facet value or a chip with leading whitespace. And the
  // parsed shape may only promise what it validated — `repositoryId` is
  // declared-but-unconsumed, so a non-string payload value is dropped instead
  // of being typed as a string it was never checked to be.
  return {
    repositoryId: typeof payload["repositoryId"] === "string" ? payload["repositoryId"] : undefined,
    repositoryFullName: repositoryFullName.trim(),
  };
}

export interface BitbucketArtifactMetadata {
  /** The connected repository's id; declared-but-unconsumed, like GitHub's. */
  repositoryId?: string;
  /** The Bitbucket workspace owning the repository (or described, for a workspace profile). */
  workspace: string;
  /**
   * The repository's slug. Absent on a workspace's own metadata artifact, which
   * names the workspace but no repository.
   */
  slug?: string;
}

/**
 * Parses a Bitbucket artifact's `metadata` JSON string: `{ repositoryId,
 * workspace, slug }` on repository artifacts, `{ workspace, ... }` on the
 * workspace's profile artifact.
 *
 * Tolerant like {@link parseGithubMetadata}: returns `null` for anything that
 * names no workspace. Only the fields the UI uses are validated and trimmed.
 *
 * @param json - The raw `artifact.metadata` string (may be omitted).
 * @returns The parsed metadata, or `null` when the input is not usable.
 */
export function parseBitbucketMetadata(
  json: string | null | undefined,
): BitbucketArtifactMetadata | null {
  const payload = readMetadataObject(json, "Bitbucket");
  if (payload === null) return null;

  const workspace = payload["workspace"];
  if (typeof workspace !== "string" || workspace.trim() === "") return null;

  const slug = payload["slug"];

  return {
    repositoryId: typeof payload["repositoryId"] === "string" ? payload["repositoryId"] : undefined,
    workspace: workspace.trim(),
    slug: typeof slug === "string" && slug.trim() !== "" ? slug.trim() : undefined,
  };
}

/**
 * Resolves the display repository (`owner/repository`, or `workspace/slug` for
 * Bitbucket) for an artifact, or `null` when the artifact has no repository to
 * show.
 *
 * Only the repo-scoped artifact types of GitHub and Bitbucket carry repository
 * metadata. Their `ORG_METADATA` artifacts share the source system, but the
 * metadata is the org or workspace profile (no repository fields), so they are
 * excluded explicitly — letting them through would run the profile JSON through
 * the repo parser and always fail. Other source systems (`UPLOAD`, `JIRA`,
 * `CONFLUENCE`, including their `PAGE` artifacts) carry different metadata
 * shapes and are excluded by the source-system check.
 *
 * @param artifact - The artifact whose metadata should be interpreted.
 * @returns The `owner/repository` string, or `null`.
 *
 * Cached per artifact object through `repositoryInfoOf`: the card list, the
 * drawer and the facet loop all call this on every render pass, and without
 * the cache each call re-ran `JSON.parse` (and re-warned on a malformed
 * payload) for the same metadata.
 */
export function getArtifactRepository(
  artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata">,
): string | null {
  return repositoryInfoOf(artifact).repository;
}

/**
 * Per-artifact parse results, cached because the filter path evaluates every
 * artifact once per facet memo per interaction — without the cache a single
 * tab change re-ran `JSON.parse` on every artifact's metadata ~5x (and the org
 * profile parse walks teams + members, the most expensive payload in the
 * feature). Keyed weakly by the artifact object: a refetch produces new
 * objects and a fresh parse, so stale cache can never outlive its batch.
 */
interface RepositoryInfo {
  repository: string | null;
  /** The owning GitHub org login, or the Bitbucket workspace, of an owner-profile artifact. */
  orgLogin: string | null;
}

/** Uncached core both public readers share; see the WeakMap note below. */
function computeRepositoryInfo(
  artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata">,
): RepositoryInfo {
  if (artifact.sourceSystem === "BITBUCKET") {
    const bitbucket = parseBitbucketMetadata(artifact.metadata);

    if (bitbucket?.slug) {
      return { repository: `${bitbucket.workspace}/${bitbucket.slug}`, orgLogin: null };
    }

    // The workspace's own artifact names no repository, only its workspace.
    return { repository: null, orgLogin: bitbucket?.workspace ?? null };
  }

  const repository =
    artifact.sourceSystem === "GITHUB" && artifact.artifactType !== "ORG_METADATA"
      ? (parseGithubMetadata(artifact.metadata)?.repositoryFullName ?? null)
      : null;
  if (repository !== null) return { repository, orgLogin: null };

  return {
    repository: null,
    orgLogin:
      artifact.artifactType === "ORG_METADATA"
        ? (parseOrgMetadata(artifact.metadata)?.login ?? null)
        : null,
  };
}

const repositoryInfoCache = new WeakMap<object, RepositoryInfo>();

function repositoryInfoOf(
  artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata">,
): RepositoryInfo {
  const cached = repositoryInfoCache.get(artifact);
  if (cached !== undefined) return cached;

  const info = computeRepositoryInfo(artifact);
  repositoryInfoCache.set(artifact, info);
  return info;
}

/**
 * Whether an artifact survives the repository facet's current selection.
 *
 * Mirrors `matchesFormat`'s scoping rule where it can: artifacts from other
 * sources are outside the facet's reach and always match, so "GitHub + Uploads
 * + repo X" does not hide the uploads. Within GitHub (and Bitbucket) a selection narrows
 * strictly, with one exception: the org profile names no repository, but it
 * describes the org that owns the chosen ones — so it stays visible exactly
 * when its login is the owner half of a checked `owner/repo`. An unrelated
 * org's profile hides like any other unchosen artifact; letting every org
 * through made a checked repository look like it had content on tabs it has
 * nothing to do with, while hiding them all cut the reader off from the org
 * that owns the repo they picked.
 *
 * The owner comparison folds case on both sides: GitHub logins are
 * case-insensitive and the two strings come from independent payloads
 * (`repositoryFullName` from the repository entity, `login` from the org
 * profile), so "SprintStart/frontend" must match a profile with login
 * "sprintstart".
 *
 * @param artifact - The artifact under test.
 * @param selected - The currently chosen repositories; empty means "no narrowing".
 * @returns Whether the artifact belongs in the filtered list.
 */
export function matchesRepository(
  artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata">,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.size === 0) return true;
  if (artifact.sourceSystem !== "GITHUB" && artifact.sourceSystem !== "BITBUCKET") return true;

  const { repository, orgLogin } = repositoryInfoOf(artifact);
  if (repository !== null) return selected.has(repository);

  // An artifact that names no repository: only the org (or workspace) profile can
  // still belong to the selection — namely when its owner owns one of the chosen repos.
  if (orgLogin === null) return false;
  const login = orgLogin.toLowerCase();
  return [...selected].some((repo) => {
    const ownerSeparator = repo.indexOf("/");
    const owner = ownerSeparator > 0 ? repo.slice(0, ownerSeparator) : repo;
    return owner.toLowerCase() === login;
  });
}
