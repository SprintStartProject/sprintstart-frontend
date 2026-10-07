import { ApiError } from "../../../../services/apiClient.ts";
import { notionService } from "../../../../services/sources/notionService.ts";
import {
  NOTHING_EXTRA,
  newDraftBase,
  type DraftConnectOutcome,
  type DraftSourceBase,
} from "../draft.ts";

export type NotionDraftSource = DraftSourceBase & {
  type: "NOTION";
  /** Name of a stored Notion credential; everything it can see is what gets connected. */
  credentialName: string;
  /** The workspace the credential belongs to, or the credential name when Notion names none. */
  workspaceName: string;
  /** Pages the credential could see when the draft was staged, shown as a hint only. */
  pageCount: number;
};

/** Stages the workspace picked in the Notion add-source form. */
export function createNotionDraft(params: {
  credentialName: string;
  workspaceName: string;
  pageCount: number;
}): NotionDraftSource {
  return {
    ...newDraftBase(),
    type: "NOTION",
    credentialName: params.credentialName,
    workspaceName: params.workspaceName,
    pageCount: params.pageCount,
  };
}

/**
 * Two Notion drafts are the same when they use the same credential: the backend
 * allows one connection per credential in a project.
 */
export function isSameNotionDraft(left: NotionDraftSource, right: NotionDraftSource): boolean {
  return left.credentialName === right.credentialName;
}

/** Connects a staged Notion workspace. */
export async function connectNotionDraft(
  source: NotionDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  try {
    await notionService.createConnection(projectId, { credentialName: source.credentialName });
  } catch (error) {
    // The raw server text says "conflict"; this says what to do. Other projects may
    // connect the same workspace, so a 409 only ever means this project has it.
    if (error instanceof ApiError && error.status === 409) {
      throw new Error("This Notion workspace is already connected to this project.");
    }

    throw error;
  }

  // Never reused: the connection is new and starts its own first ingestion.
  return NOTHING_EXTRA;
}
