import {
  addRepositoryToProject,
  connectGithubRepository,
} from "../../services/sources/githubService";
import { connectJiraInstance } from "../../services/sources/jiraService";
import { knowledgeGapService } from "../../services/knowledgeGapService";
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
   * Set when the source connected but the owner it was staged with could not be recorded.
   *
   * A separate flag rather than a `failed` status, because the two outcomes are not the same
   * thing and must not be told apart by guesswork: the repository *is* connected and is being
   * ingested, and calling that a failure would invite a retry of work that already succeeded.
   * Ownership is also the weaker of the two — only PM/Admin may write it, so an HR user
   * staging an owner gets a 403 on that call alone — and losing it costs a dropdown on the
   * knowledge-gaps page, not the source.
   *
   * Only GitHub repositories can carry an owner today; it lives on the base so the batch loop
   * can patch it without narrowing the union.
   */
  ownerAssignmentFailed: boolean;
};

export type GithubDraftSource = DraftSourceBase & {
  type: "GITHUB";
  owner: string;
  name: string;
  tokenName: string;
  /**
   * Who owns this repository's documentation, named in the staged source list.
   *
   * The knowledge-gaps analysis keys ownership by component name, and a repository's component
   * is `owner/name` — so naming somebody here is the same assignment the PM would otherwise
   * have to make afterwards from Knowledge gaps → the repository → Owner.
   *
   * Set on the list rather than on the discovery screen, and therefore never at staging time:
   * discovery is a multi-select, so a control there could only name one person for everything
   * ticked, which is not how repositories are actually divided up. Applied once the repository
   * has connected; empty means nobody was named, which is not the same as clearing an existing
   * owner and never writes anything.
   */
  ownerUserId?: string;
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
    ownerAssignmentFailed: false,
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
    ownerAssignmentFailed: false,
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
    ownerAssignmentFailed: false,
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

/**
 * Names (or unnames) the documentation owner of a staged GitHub repository.
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
    source.id === sourceId && source.type === "GITHUB"
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

export function countUnconnectedSources(sources: DraftSource[]): number {
  return sources.filter((source) => source.status !== "connected").length;
}

export function hasFailedSources(sources: DraftSource[]): boolean {
  return sources.some((source) => source.status === "failed");
}

/**
 * Records the staged owner of a repository against its knowledge-gap component.
 *
 * Runs after the connect, and deliberately cannot fail it: the repository is connected and
 * ingesting by this point, and the ownership write is a different, weaker call — it is
 * PM/Admin-only, so an HR user who staged an owner is refused here and nowhere else. The
 * outcome is reported instead, and the row says which of the two happened.
 *
 * @returns Whether the assignment failed, so the caller can say so.
 */
async function assignStagedOwner(source: GithubDraftSource, projectId: string): Promise<boolean> {
  if (!source.ownerUserId) return false;

  try {
    await knowledgeGapService.setComponentOwners(projectId, `${source.owner}/${source.name}`, [
      source.ownerUserId,
    ]);

    return false;
  } catch (error) {
    console.error(`Failed to assign the owner of ${source.owner}/${source.name}`, error);

    return true;
  }
}

/**
 * Connects one staged source, dispatching to the right connector by `type`.
 *
 * @returns Whether the source connected but its staged owner could not be recorded.
 */
async function connectOneDraftSource(source: DraftSource, projectId: string): Promise<boolean> {
  if (source.type === "GITHUB") {
    if (source.repositoryId) {
      // Already ingested elsewhere: link it to this project, reusing its
      // artifacts instead of fetching and ingesting the repository again.
      await addRepositoryToProject(source.repositoryId, projectId);
    } else {
      await connectGithubRepository({
        owner: source.owner,
        name: source.name,
        tokenName: source.tokenName,
        projectId,
      });
    }

    return await assignStagedOwner(source, projectId);
  }

  if (source.type === "JIRA") {
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
      const ownerAssignmentFailed = await connectOneDraftSource(source, projectId);

      publish(
        patchDraftSource(currentSources, source.id, {
          status: "connected",
          ownerAssignmentFailed,
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
