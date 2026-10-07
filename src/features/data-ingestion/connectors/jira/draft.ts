import { connectJiraInstance } from "../../../../services/sources/jiraService.ts";
import {
  NOTHING_EXTRA,
  newDraftBase,
  type DraftConnectOutcome,
  type DraftSourceBase,
} from "../draft.ts";

export type JiraDraftSource = DraftSourceBase & {
  type: "JIRA";
  displayName: string;
  /** Instance URL, e.g. "https://x.atlassian.net". */
  url: string;
  userEmail: string;
  tokenName: string;
};

export function createJiraDraft(params: {
  displayName: string;
  url: string;
  userEmail: string;
  tokenName: string;
}): JiraDraftSource {
  return {
    ...newDraftBase(),
    type: "JIRA",
    displayName: params.displayName,
    url: params.url,
    userEmail: params.userEmail,
    tokenName: params.tokenName,
  };
}

/** Two Jira drafts are the same when the instance URL matches, ignoring case and padding. */
export function isSameJiraDraft(left: JiraDraftSource, right: JiraDraftSource): boolean {
  return left.url.trim().toLowerCase() === right.url.trim().toLowerCase();
}

/** Connects a staged Jira instance. */
export async function connectJiraDraft(
  source: JiraDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  await connectJiraInstance({
    displayName: source.displayName,
    url: source.url,
    userEmail: source.userEmail,
    tokenName: source.tokenName,
    projectId,
  });

  // The Jira connector reuses an already-connected instance too, but reports
  // nothing about it, so a Jira link cannot be described as a reuse yet.
  return NOTHING_EXTRA;
}
