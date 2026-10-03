import { knowledgeGapService } from "../../../../services/knowledgeGapService.ts";
import {
  addRepositoryToProject,
  connectGithubRepository,
} from "../../../../services/sources/githubService.ts";
import type { DiscoverySelection } from "../../components/GithubRepositoryDiscovery.tsx";
import { newDraftBase, type DraftConnectOutcome, type DraftSourceBase } from "../draft.ts";

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

export function createDraftSource(
  owner: string,
  name: string,
  tokenName: string,
  repositoryId?: string,
): GithubDraftSource {
  return {
    ...newDraftBase(),
    type: "GITHUB",
    owner,
    name,
    tokenName,
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

/** Two repositories are the same when `owner/name` matches, ignoring case. */
export function isSameGithubDraft(left: GithubDraftSource, right: GithubDraftSource): boolean {
  return (
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.name.toLowerCase() === right.name.toLowerCase()
  );
}

/**
 * Records the staged owner of a repository against its knowledge-gap component.
 *
 * Runs after the connect, and deliberately cannot fail it: the repository is connected and
 * ingesting by this point, and the ownership write is a different, weaker call — it is
 * PM/Admin-only, so an HR user who staged an owner is refused here and nowhere else. The
 * outcome is reported instead, and the row says which of the two happened.
 *
 * Safe to run this early, before the gaps analysis has ever seen the component: the backend
 * keys ownership by component name alone and stores it in its own table, so there is nothing
 * for an unknown component to fail against.
 *
 * Two things it inherits from that endpoint, both of which only ever happen because somebody
 * deliberately picked a name here. The PUT *replaces* the owner list, so an existing owner is
 * dropped rather than joined. And ownership is not project-partitioned yet, so a repository
 * that is also connected to another project changes hands there too. Showing the current
 * owner before overwriting them would need a read per staged repository; worth doing, but it
 * is a feature rather than a guard.
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

/** Connects a staged repository, linking it when it is already ingested. */
export async function connectGithubDraft(
  source: GithubDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  let wasReused: boolean;

  if (source.repositoryId) {
    // Already ingested elsewhere: link it to this project, reusing its
    // artifacts instead of fetching and ingesting the repository again.
    await addRepositoryToProject(source.repositoryId, projectId);
    wasReused = true;
  } else {
    // Staged as new, but the backend is the one that knows: it reuses a
    // connection this UI never saw, and reports that as `wasReused`.
    const outcome = await connectGithubRepository({
      owner: source.owner,
      name: source.name,
      tokenName: source.tokenName,
      projectId,
    });
    wasReused = outcome.wasReused === true;
  }

  return {
    wasReused,
    ownerAssignmentFailed: await assignStagedOwner(source, projectId),
  };
}
