/**
 * Type mapping + tolerant parser for the metadata JSON string the backend ships on
 * `ORG_METADATA` artifacts.
 *
 * The backend DTO (`GithubOrgMetadataArtifactMetadata` in sprintstart-backend)
 * serializes the org profile, its teams and members into the artifact's `metadata`
 * field — the only place that data lives; the artifact has no stored bytes and its
 * content endpoint 302-redirects to the org's GitHub page. Centralizing the parse
 * makes the mapping unit-testable and keeps consumers (the viewer drawer) free of
 * ad-hoc `JSON.parse` + shape handling.
 *
 * Shape mirrors the backend contract exactly; optional fields are `null`-able the
 * way GitHub's API returns them.
 */

export interface OrgMetadataArtifactMetadata {
  /** GitHub login (also the artifact `sourceId`). */
  login: string;
  /** Org display name (also the artifact `title`). */
  name: string;
  description: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  publicRepos: number | null;
  privateRepos: number | null;
  /** Present only when the org has exposed teams to the ingest GitHub app. */
  teams: OrgMetadataTeam[] | null;
  /** Every member visible to the ingest GitHub app. */
  members: OrgMetadataMember[];
}

export interface OrgMetadataTeam {
  name: string;
  slug: string | null;
  orgLogin: string;
  orgName: string | null;
  members: OrgMetadataTeamMember[];
}

export interface OrgMetadataTeamMember {
  login: string;
  name: string | null;
}

export interface OrgMetadataMember {
  login: string;
  url: string;
}

/**
 * Parses an `ORG_METADATA` artifact's `metadata` JSON string.
 *
 * Tolerant by design: returns `null` for any value that cannot be turned into a
 * usable org profile — `null`/`undefined`, empty string, malformed JSON, or JSON
 * that is not a plain object (e.g. `"123"`). This lets callers own the empty state
 * without co-opting the "nothing here" of a failed parse.
 *
 * @param json The raw `artifact.metadata` string (may be omitted).
 * @returns The parsed org metadata, or `null` when the input is not usable.
 */
export function parseOrgMetadata(
  json: string | null | undefined,
): OrgMetadataArtifactMetadata | null {
  if (typeof json !== "string" || json.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // A malformed blob (never expected from the backend, but cheap to guard
    // against) must not crash the viewer — degrade to the same empty state.
    console.warn("Ignoring unparseable ORG_METADATA artifact metadata", json);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const p = parsed as Record<string, unknown>;
  if (typeof p["login"] !== "string" || !Array.isArray(p["members"])) {
    return null;
  }

  // Same guard one level down: `teams` is optional, but the viewer dereferences
  // `team.members.length` / `.map()` on every entry it does get, so a team
  // without a members array is the identical TypeError the check above prevents.
  // Rejecting the whole payload (rather than the one team) keeps the contract
  // the callers already rely on: unusable metadata means the quiet empty state.
  const teams = p["teams"];
  if (teams !== null && teams !== undefined) {
    if (!Array.isArray(teams)) return null;

    const everyTeamUsable = teams.every(
      (team) =>
        typeof team === "object" &&
        team !== null &&
        Array.isArray((team as Record<string, unknown>)["members"]),
    );
    if (!everyTeamUsable) return null;
  }

  return parsed as OrgMetadataArtifactMetadata;
}
