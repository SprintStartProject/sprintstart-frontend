import {
  addRepositoryToProject,
  connectGithubRepository,
} from "../../services/sources/githubService";
import type { DiscoverySelection } from "../data-ingestion/components/GithubRepositoryDiscovery";

/**
 * Staged GitHub sources waiting to be connected to a project.
 *
 * Unlike `peopleDraft`, this is not a diff against a server snapshot: sources
 * are append-only from the UI's point of view, and each entry carries its own
 * outcome so a partial failure can be shown and retried per repository instead
 * of failing the whole batch.
 */

export type DraftSourceStatus = "pending" | "connecting" | "connected" | "failed";

export type DraftSource = {
  /** Client-side identity; the backend never sees this. */
  id: string;
  owner: string;
  name: string;
  tokenName: string;
  status: DraftSourceStatus;
  errorMessage: string;
  /**
   * Set when the repository is already ingested elsewhere: connecting then only
   * links it to the project (reusing its artifacts) instead of fetching and
   * ingesting it again. Absent for genuinely new repositories.
   */
  repositoryId?: string;
};

let draftSourceCounter = 0;

export function createDraftSource(
  owner: string,
  name: string,
  tokenName: string,
  repositoryId?: string,
): DraftSource {
  draftSourceCounter += 1;

  return {
    id: `draft-source-${draftSourceCounter}`,
    owner,
    name,
    tokenName,
    status: "pending",
    errorMessage: "",
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
): DraftSource {
  return createDraftSource(
    selection.owner,
    selection.name,
    tokenName,
    selection.linkState === "linkable" ? selection.repositoryId : undefined,
  );
}

export function isSameRepository(left: DraftSource, right: DraftSource) {
  return (
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.name.toLowerCase() === right.name.toLowerCase()
  );
}

/** Appends a source unless the same repository is already staged. */
export function addDraftSource(sources: DraftSource[], source: DraftSource): DraftSource[] {
  if (sources.some((current) => isSameRepository(current, source))) {
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
  patch: Partial<DraftSource>,
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
 * Connects every source that is not already connected, one after another.
 *
 * Each entry is settled independently: a rejected connect marks only that entry
 * as `failed` and the run continues, so one bad repository cannot strand the
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

      publish(patchDraftSource(currentSources, source.id, { status: "connected" }));
    } catch (error) {
      publish(
        patchDraftSource(currentSources, source.id, {
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Repository could not be connected.",
        }),
      );
    }
  }

  return currentSources;
}
