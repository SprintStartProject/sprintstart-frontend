import { getConnector } from "../connectors/registry.ts";
import type { DraftConnectOutcome, DraftSource, DraftSourceBase } from "../connectors/draft.ts";

export type {
  DraftConnectOutcome,
  DraftSource,
  DraftSourceBase,
  DraftSourceStatus,
  DraftSourceType,
} from "../connectors/draft.ts";
export type { BitbucketDraftSource } from "../connectors/bitbucket/draft.ts";
export type { ConfluenceDraftSource } from "../connectors/confluence/draft.ts";
export type { GithubDraftSource } from "../connectors/github/draft.ts";
export type { JiraDraftSource } from "../connectors/jira/draft.ts";
export type { UploadDraftSource } from "../connectors/upload/draft.ts";
export {
  createBitbucketDraft,
  createBitbucketDraftFromDiscovery,
} from "../connectors/bitbucket/draft.ts";
export { createConfluenceDraft, isValidConfluenceSpaceId } from "../connectors/confluence/draft.ts";
export { createDraftSource, createDraftSourceFromDiscovery } from "../connectors/github/draft.ts";
export { createJiraDraft } from "../connectors/jira/draft.ts";
export { createUploadDraft } from "../connectors/upload/draft.ts";

/**
 * Staged sources waiting to be connected to a project.
 *
 * Unlike `peopleDraft`, this is not a diff against a server snapshot: sources
 * are append-only from the UI's point of view, and each entry carries its own
 * outcome so a partial failure can be shown and retried per source instead of
 * failing the whole batch.
 *
 * What a staged source is, and how it is compared and connected, belongs to its
 * connector (`connectors/<connector>/draft.ts`, reached through the connector's
 * `draft` support); this module holds what works on a list of them. Nothing here
 * touches the backend until {@link connectDraftSources} runs during provisioning;
 * uploads in particular hold their `File[]` in memory until then.
 */

/**
 * Whether two drafts point at the same underlying source, used to dedupe on
 * add. Identity is per connector (GitHub by `owner/name`, Jira by instance URL, ...);
 * drafts of different connectors are never the same source.
 */
export function isSameSource(left: DraftSource, right: DraftSource): boolean {
  if (left.type !== right.type) return false;

  return getConnector(left.type).draft.isSame(left, right);
}

/** Appends a source unless the same source is already staged. */
export function addDraftSource(sources: DraftSource[], source: DraftSource): DraftSource[] {
  if (sources.some((current) => isSameSource(current, source))) {
    return sources;
  }

  return [...sources, source];
}

/** Appends several sources, skipping any that are already staged. */
export function addDraftSources(sources: DraftSource[], added: DraftSource[]): DraftSource[] {
  return added.reduce((accumulated, draft) => addDraftSource(accumulated, draft), sources);
}

export function removeDraftSource(sources: DraftSource[], sourceId: string): DraftSource[] {
  return sources.filter((source) => source.id !== sourceId);
}

/**
 * Names (or unnames) the documentation owner of a staged source whose connector can carry one.
 *
 * Per source rather than per batch: a PM adds four repositories in one pass and they belong to
 * four different people, which is the whole reason the assignment is worth making here instead
 * of afterwards. An empty `ownerUserId` clears the staged choice.
 */
export function setDraftSourceOwner(
  sources: DraftSource[],
  sourceId: string,
  ownerUserId: string,
): DraftSource[] {
  return sources.map((source) =>
    source.id === sourceId && getConnector(source.type).draft.ownerComponent?.(source)
      ? { ...source, ownerUserId: ownerUserId || undefined }
      : source,
  );
}

function patchDraftSource(
  sources: DraftSource[],
  sourceId: string,
  patch: Partial<DraftSourceBase>,
): DraftSource[] {
  return sources.map((source) => (source.id === sourceId ? { ...source, ...patch } : source));
}

/** Sources a save still has to connect: pending, failed or still connecting. */
export function countUnconnectedSources(sources: DraftSource[]): number {
  return sources.filter((source) => source.status !== "connected").length;
}

export function hasFailedSources(sources: DraftSource[]): boolean {
  return sources.some((source) => source.status === "failed");
}

/**
 * How a finished run should be described, so the reassurance matches what
 * actually happened.
 *
 * A reused source starts no ingestion at all: promising one would have the PM
 * waiting for a run that never appears, and saying nothing leaves an instant
 * "Connected" looking like the connect did not take. The shape is deliberately
 * coarse: naming — or even counting — the projects a source was already
 * connected to would tell a PM about projects that are not theirs.
 *
 * @param sources - The settled run.
 * @returns `"none"` when nothing connected, `"reused"` when everything that
 * connected was linked, `"ingesting"` when everything is being fetched, and
 * `"mixed"` for a run with both.
 */
export function connectOutcome(sources: DraftSource[]): "none" | "reused" | "ingesting" | "mixed" {
  const connected = sources.filter((source) => source.status === "connected");
  if (connected.length === 0) return "none";

  const reused = connected.filter((source) => source.wasReused).length;

  if (reused === 0) return "ingesting";
  if (reused === connected.length) return "reused";

  return "mixed";
}

/**
 * The line under a success toast, matching {@link connectOutcome}.
 *
 * @param sources - The settled run.
 * @returns The description, or `undefined` when there is nothing to add.
 */
export function connectOutcomeDescription(sources: DraftSource[]): string | undefined {
  switch (connectOutcome(sources)) {
    case "reused":
      return "Already available in SprintStart and linked to your project. No re-ingestion needed.";
    case "mixed":
      return "Initial ingestion is running for the new sources. The rest were already available and were linked.";
    case "ingesting":
      return "Initial ingestion is running in the background.";
    case "none":
      return undefined;
  }
}

/**
 * Connects one staged source through its connector.
 *
 * @returns What happened beyond the connect itself, see {@link DraftConnectOutcome}.
 */
function connectOneDraftSource(
  source: DraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  return getConnector(source.type).draft.connect(source, projectId);
}

/**
 * Connects every source that is not already connected, one after another.
 *
 * Each entry is settled independently: a rejected connect marks only that entry
 * as `failed` and the run continues, so one bad source cannot strand the
 * others. `onProgress` is called after every status change so callers can
 * render the run as it happens; the resolved array is the final state.
 */
export async function connectDraftSources(
  projectId: string,
  sources: DraftSource[],
  onProgress?: (sources: DraftSource[]) => void,
): Promise<DraftSource[]> {
  let currentSources = sources;

  const publish = (next: DraftSource[]) => {
    currentSources = next;
    onProgress?.(next);
  };

  for (const source of sources) {
    if (source.status === "connected") continue;

    publish(
      patchDraftSource(currentSources, source.id, {
        status: "connecting",
        errorMessage: "",
      }),
    );

    try {
      const outcome = await connectOneDraftSource(source, projectId);

      publish(
        patchDraftSource(currentSources, source.id, {
          status: "connected",
          ownerAssignmentFailed: outcome.ownerAssignmentFailed,
          wasReused: outcome.wasReused,
        }),
      );
    } catch (error) {
      publish(
        patchDraftSource(currentSources, source.id, {
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "The source could not be connected.",
        }),
      );
    }
  }

  return currentSources;
}
