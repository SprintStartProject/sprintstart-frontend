import { confluenceService } from "../../../../services/sources/confluenceService.ts";
import {
  NOTHING_EXTRA,
  newDraftBase,
  type DraftConnectOutcome,
  type DraftSourceBase,
} from "../draft.ts";

export type ConfluenceDraftSource = DraftSourceBase & {
  type: "CONFLUENCE";
  displayName: string;
  baseUrl: string;
  spaceId: string;
  /** Name of a stored Atlassian credential, shared with the Jira connector. */
  credentialName: string;
};

/**
 * Whether a Confluence space ID is well-formed. Only the numeric space ID is
 * accepted, so the space *key* ("ENG") — the value actually visible in
 * Confluence's own UI, and the obvious thing to paste — has to be caught while
 * the source is being staged rather than at provisioning time.
 */
export function isValidConfluenceSpaceId(spaceId: string): boolean {
  return /^\d+$/.test(spaceId.trim());
}

/**
 * Stages a Confluence space. Without a display name it is called `Confluence Space <spaceId>`;
 * check the space ID with {@link isValidConfluenceSpaceId} first.
 */
export function createConfluenceDraft(params: {
  displayName?: string;
  baseUrl: string;
  spaceId: string;
  credentialName: string;
}): ConfluenceDraftSource {
  return {
    ...newDraftBase(),
    type: "CONFLUENCE",
    displayName: params.displayName || `Confluence Space ${params.spaceId}`,
    baseUrl: params.baseUrl,
    spaceId: params.spaceId,
    credentialName: params.credentialName,
  };
}

/** Two Confluence drafts are the same when base URL and space ID match, ignoring case and padding. */
export function isSameConfluenceDraft(
  left: ConfluenceDraftSource,
  right: ConfluenceDraftSource,
): boolean {
  return (
    left.baseUrl.trim().toLowerCase() === right.baseUrl.trim().toLowerCase() &&
    left.spaceId.trim().toLowerCase() === right.spaceId.trim().toLowerCase()
  );
}

/** Connects a staged Confluence space. */
export async function connectConfluenceDraft(
  source: ConfluenceDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  // No error remapping here: a failed connect comes back with a precise
  // message ("Confluence space 123 was not found", "Atlassian credential 'x'
  // was not found"), and 404 covers both cases — the backend's own message is
  // more useful than anything this layer could guess from the status alone.
  await confluenceService.createConnection(projectId, {
    baseUrl: source.baseUrl,
    spaceId: source.spaceId,
    credentialName: source.credentialName,
    pageAllowlist: [],
    pageDenylist: [],
  });

  // A Confluence space belongs to exactly one project, so it is never reused.
  return NOTHING_EXTRA;
}
