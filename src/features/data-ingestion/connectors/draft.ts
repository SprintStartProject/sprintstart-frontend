import type { SourceSystem } from "./sourceSystems.ts";
import type { BitbucketDraftSource } from "./bitbucket/draft.ts";
import type { ConfluenceDraftSource } from "./confluence/draft.ts";
import type { GithubDraftSource } from "./github/draft.ts";
import type { JiraDraftSource } from "./jira/draft.ts";
import type { NotionDraftSource } from "./notion/draft.ts";
import type { UploadDraftSource } from "./upload/draft.ts";

/**
 * Staged sources waiting to be connected to a project.
 *
 * Each connector describes its own draft in its folder (`<connector>/draft.ts`)
 * and the union below is what every list of staged sources holds, so a single
 * list can mix all connectors. Nothing here touches the backend until a
 * connector's `draft.connect` runs.
 */

export type DraftSourceStatus = "pending" | "connecting" | "connected" | "failed";

/** Fields every staged source carries regardless of its connector. */
export type DraftSourceBase = {
  /** Client-side identity; the backend never sees this. */
  id: string;
  status: DraftSourceStatus;
  errorMessage: string;
  /**
   * Who owns this source's documentation, named in the staged source list.
   *
   * Only connectors that declare `draft.ownerComponent` can carry one. The
   * knowledge-gaps analysis keys ownership by component name, and a repository's
   * component is `owner/name` — so naming somebody here is the same assignment the
   * PM would otherwise have to make afterwards from Knowledge gaps → the repository
   * → Owner.
   *
   * Set on the list rather than on the discovery screen, and therefore never at
   * staging time: discovery is a multi-select, so a control there could only name
   * one person for everything ticked, which is not how repositories are actually
   * divided up. Applied once the source has connected; empty means nobody was named,
   * which is not the same as clearing an existing owner and never writes anything.
   */
  ownerUserId?: string;
  /**
   * Set when the source connected but the owner it was staged with could not be recorded.
   *
   * A separate flag rather than a `failed` status, because the two outcomes are not the same
   * thing and must not be told apart by guesswork: the repository *is* connected and is being
   * ingested, and calling that a failure would invite a retry of work that already succeeded.
   * Ownership is also the weaker of the two — only PM/Admin may write it, so an HR user
   * staging an owner gets a 403 on that call alone — and losing it costs a dropdown on the
   * knowledge-gaps page, not the source.
   */
  ownerAssignmentFailed: boolean;
  /**
   * Set once the source connected, when it was linked to an existing connection
   * rather than fetched. Such a source starts no ingestion, so the usual
   * "ingestion is running" reassurance would be wrong for it, and its instant
   * completion would otherwise look like nothing happened.
   *
   * Two things can put this here: a repository staged from discovery as
   * already-ingested (the draft carries its `repositoryId`), or the backend
   * reporting `wasReused` because it found a connection the UI did not know
   * about — someone else's connect landing between discovery and this one.
   */
  wasReused: boolean;
};

/** The staged source of each connector, keyed by its source system. */
export type DraftSourceOf = {
  GITHUB: GithubDraftSource;
  JIRA: JiraDraftSource;
  UPLOAD: UploadDraftSource;
  CONFLUENCE: ConfluenceDraftSource;
  BITBUCKET: BitbucketDraftSource;
  NOTION: NotionDraftSource;
};

export type DraftSourceType = SourceSystem;

export type DraftSource = DraftSourceOf[SourceSystem];

/** What connecting one staged source actually did, beyond succeeding. */
export type DraftConnectOutcome = {
  /** Whether an existing connection was linked instead of the source being fetched. */
  wasReused: boolean;
  /** Whether the source connected but its staged owner could not be recorded. */
  ownerAssignmentFailed: boolean;
};

/** Neither reused nor owner-carrying: what most connectors report. */
export const NOTHING_EXTRA: DraftConnectOutcome = {
  wasReused: false,
  ownerAssignmentFailed: false,
};

let draftSourceCounter = 0;

/** A fresh client-side id for a staged source. */
export function nextDraftSourceId(): string {
  draftSourceCounter += 1;

  return `draft-source-${draftSourceCounter}`;
}

/** The fields a draft starts with before anything has run. */
export function newDraftBase(): DraftSourceBase {
  return {
    id: nextDraftSourceId(),
    status: "pending",
    errorMessage: "",
    ownerAssignmentFailed: false,
    wasReused: false,
  };
}
