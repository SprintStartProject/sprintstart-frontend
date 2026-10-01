/**
 * Type mapping + tolerant parser for the metadata JSON string the backend ships on
 * Bitbucket `ORG_METADATA` artifacts.
 *
 * The backend DTO (`BitbucketWorkspaceMetadataArtifactMetadata` in sprintstart-backend)
 * serializes the workspace profile and its members into the artifact's `metadata`
 * field. It is the Bitbucket counterpart of the GitHub org profile in
 * [`orgMetadata`](./orgMetadata), with a different shape: a workspace has no teams,
 * no blog or location, and its members are named by display name and nickname.
 */

export interface BitbucketWorkspaceMember {
  accountId: string | null;
  nickname: string | null;
  displayName: string | null;
}

export interface BitbucketWorkspaceMetadata {
  /** The workspace id, as used in `bitbucket.org/<workspace>`. */
  workspace: string;
  /** The workspace's display name (also the artifact `title`). */
  name: string;
  /** Null when the backend reported no visibility. */
  isPrivate: boolean | null;
  /** ISO 8601 creation time, or null when Bitbucket reported none. */
  createdOn: string | null;
  /** Browser URL of the workspace, or null when Bitbucket reported none. */
  url: string | null;
  members: BitbucketWorkspaceMember[];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Parses a Bitbucket `ORG_METADATA` artifact's `metadata` JSON string.
 *
 * Tolerant like `parseOrgMetadata`: returns `null` for anything that names no
 * workspace or carries no member list, so the viewer can show its quiet empty
 * state. Members that are not objects are dropped rather than failing the whole
 * profile. The Kotlin `isPrivate` property is read under both spellings Jackson
 * may serialize it as (`isPrivate` and `private`).
 *
 * @param json The raw `artifact.metadata` string (may be omitted).
 * @returns The parsed workspace metadata, or `null` when the input is not usable.
 */
export function parseBitbucketWorkspaceMetadata(
  json: string | null | undefined,
): BitbucketWorkspaceMetadata | null {
  if (typeof json !== "string" || json.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.warn("Ignoring unparseable Bitbucket workspace metadata", json);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const payload = parsed as Record<string, unknown>;
  const workspace = optionalString(payload["workspace"]);
  const members = payload["members"];
  if (workspace === null || !Array.isArray(members)) return null;

  const isPrivate = payload["isPrivate"] ?? payload["private"];

  return {
    workspace,
    name: optionalString(payload["name"]) ?? workspace,
    isPrivate: typeof isPrivate === "boolean" ? isPrivate : null,
    createdOn: optionalString(payload["createdOn"]),
    url: optionalString(payload["url"]),
    members: members
      .filter(
        (member): member is Record<string, unknown> =>
          typeof member === "object" && member !== null && !Array.isArray(member),
      )
      .map((member) => ({
        accountId: optionalString(member["accountId"]),
        nickname: optionalString(member["nickname"]),
        displayName: optionalString(member["displayName"]),
      })),
  };
}
