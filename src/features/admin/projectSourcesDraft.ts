import {
  addRepositoryToProject,
  connectGithubRepository,
} from "../../services/sources/githubService";
import { connectJiraInstance } from "../../services/sources/jiraService";
import { knowledgeService } from "../../services/knowledgeService";
import type { DiscoverySelection } from "../data-ingestion/components/GithubRepositoryDiscovery";

/**
 * Staged sources waiting to be connected to a project.
 *
 * Unlike `peopleDraft`, this is not a diff against a server snapshot: sources
 * are append-only from the UI's point of view, and each entry carries its own
 * outcome so a partial failure can be shown and retried per source instead of
 * failing the whole batch.
 *
 * A source can be one of three kinds — a GitHub repository, a Jira instance, or
 * an in-memory file upload — modelled as a discriminated union on `type` so a
 * single list can hold a mix of all three. Nothing here touches the backend
 * until {@link connectDraftSources} runs during provisioning; uploads in
 * particular hold their `File[]` in memory until then.
 */

export type DraftSourceStatus = "pending" | "connecting" | "connected" | "failed";

export type DraftSourceType = "GITHUB" | "JIRA" | "UPLOAD";

/** Fields every staged source carries regardless of its type. */
type DraftSourceBase = {
  /** Client-side identity; the backend never sees this. */
  id: string;
  status: DraftSourceStatus;
  errorMessage: string;
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

export type GithubDraftSource = DraftSourceBase & {
  type: "GITHUB";
  owner: string;
  name: string;
  tokenName: string;
  /**
   * Set when the repository is already ingested elsewhere: connecting then only
   * links it to the project (reusing its artifacts) instead of fetching and
   * ingesting it again. Absent for genuinely new repositories.
   */
  repositoryId?: string;
};

export type JiraDraftSource = DraftSourceBase & {
  type: "JIRA";
  displayName: string;
  /** Instance URL, e.g. "https://x.atlassian.net". */
  url: string;
  userEmail: string;
  tokenName: string;
};

export type UploadDraftSource = DraftSourceBase & {
  type: "UPLOAD";
  displayName: string;
  /** Selected files, held in memory until provisioning uploads them. */
  files: File[];
};

export type DraftSource = GithubDraftSource | JiraDraftSource | UploadDraftSource;

let draftSourceCounter = 0;

function nextDraftSourceId(): string {
  draftSourceCounter += 1;

  return `draft-source-${draftSourceCounter}`;
}

export function createDraftSource(
  owner: string,
  name: string,
  tokenName: string,
  repositoryId?: string,
): GithubDraftSource {
  return {
    id: nextDraftSourceId(),
    type: "GITHUB",
    owner,
    name,
    tokenName,
    status: "pending",
    errorMessage: "",
    wasReused: false,
    repositoryId,
  };
}

/**
 * Stages a repository picked in the GitHub discovery flow. A `linkable`
 * selection carries the repository id so it can be linked without re-ingesting;
 * everything else is staged as a new repository to fetch and ingest.
 */
export function createDraftSourceFromDiscovery(
  selection: DiscoverySelection,
  tokenName: string,
): GithubDraftSource {
  return createDraftSource(
    selection.owner,
    selection.name,
    tokenName,
    selection.linkState === "linkable" ? selection.repositoryId : undefined,
  );
}

export function createJiraDraft(params: {
  displayName: string;
  url: string;
  userEmail: string;
  tokenName: string;
}): JiraDraftSource {
  return {
    id: nextDraftSourceId(),
    type: "JIRA",
    displayName: params.displayName,
    url: params.url,
    userEmail: params.userEmail,
    tokenName: params.tokenName,
    status: "pending",
    errorMessage: "",
    wasReused: false,
  };
}

export function createUploadDraft(displayName: string, files: File[]): UploadDraftSource {
  return {
    id: nextDraftSourceId(),
    type: "UPLOAD",
    displayName,
    files,
    status: "pending",
    errorMessage: "",
    wasReused: false,
  };
}

/**
 * Whether two drafts point at the same underlying source, used to dedupe on
 * add. Identity is per type: GitHub by `owner/name`, Jira by instance URL; two
 * uploads are always distinct (the same file can legitimately be staged twice).
 * Drafts of different types are never the same source.
 */
export function isSameSource(left: DraftSource, right: DraftSource): boolean {
  if (left.type !== right.type) return false;

  if (left.type === "GITHUB" && right.type === "GITHUB") {
    return (
      left.owner.toLowerCase() === right.owner.toLowerCase() &&
      left.name.toLowerCase() === right.name.toLowerCase()
    );
  }

  if (left.type === "JIRA" && right.type === "JIRA") {
    return left.url.trim().toLowerCase() === right.url.trim().toLowerCase();
  }

  return false;
}

/** Appends a source unless the same source is already staged. */
export function addDraftSource(sources: DraftSource[], source: DraftSource): DraftSource[] {
  if (sources.some((current) => isSameSource(current, source))) {
    return sources;
  }

  return [...sources, source];
}

export function removeDraftSource(sources: DraftSource[], sourceId: string): DraftSource[] {
  return sources.filter((source) => source.id !== sourceId);
}

function patchDraftSource(
  sources: DraftSource[],
  sourceId: string,
  patch: Partial<DraftSourceBase>,
): DraftSource[] {
  return sources.map((source) => (source.id === sourceId ? { ...source, ...patch } : source));
}

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
 * "Connected" looking like the connect did not take. Deliberately counts only —
 * naming the projects a source was already connected to would tell a PM about
 * projects that are not theirs.
 *
 * @param sources The settled run.
 * @returns `"none"` when nothing connected, `"reused"` when everything that
 * connected was linked, `"ingesting"` when everything is being fetched, and
 * `"mixed"` for a run with both.
 */
export function connectOutcome(
  sources: DraftSource[],
): "none" | "reused" | "ingesting" | "mixed" {
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
 * @param sources The settled run.
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
 * Connects one staged source, dispatching to the right connector by `type`.
 *
 * @returns Whether an existing connection was linked instead of the source
 * being fetched, so the caller can say so rather than promising an ingestion
 * that is not coming.
 */
async function connectOneDraftSource(source: DraftSource, projectId: string): Promise<boolean> {
  if (source.type === "GITHUB") {
    if (source.repositoryId) {
      // Already ingested elsewhere: link it to this project, reusing its
      // artifacts instead of fetching and ingesting the repository again.
      await addRepositoryToProject(source.repositoryId, projectId);

      return true;
    }

    // Staged as new, but the backend is the one that knows: it reuses a
    // connection this UI never saw, and reports that as `wasReused`.
    const outcome = await connectGithubRepository({
      owner: source.owner,
      name: source.name,
      tokenName: source.tokenName,
      projectId,
    });

    return outcome.wasReused === true;
  }

  if (source.type === "JIRA") {
    // The Jira connector reuses an already-connected instance too, but reports
    // nothing about it, so a Jira link cannot be described as a reuse yet.
    await connectJiraInstance({
      displayName: source.displayName,
      url: source.url,
      userEmail: source.userEmail,
      tokenName: source.tokenName,
      projectId,
    });

    return false;
  }

  // UPLOAD: files are uploaded now that the project exists. uploadDocuments
  // settles every file itself and never throws, so a per-file error surfaces as
  // a `status: "error"` entry rather than a rejection — turn any into a failure
  // for this row so the batch loop records and can retry it.
  const results = await knowledgeService.uploadDocuments(projectId, source.files);
  const failed = results.filter((result) => result.status === "error");

  if (failed.length > 0) {
    const detail = failed[0]?.error;
    throw new Error(
      failed.length === source.files.length
        ? detail || "The files could not be uploaded."
        : `${failed.length} of ${source.files.length} files could not be uploaded.`,
    );
  }

  return false;
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
      const wasReused = await connectOneDraftSource(source, projectId);

      publish(patchDraftSource(currentSources, source.id, { status: "connected", wasReused }));
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
