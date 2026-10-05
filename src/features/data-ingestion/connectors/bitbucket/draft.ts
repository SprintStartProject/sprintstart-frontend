import { ApiError } from "../../../../services/apiClient.ts";
import {
  addBitbucketRepositoryToProject,
  connectBitbucketRepository,
} from "../../../../services/sources/bitbucketService.ts";
import type { DiscoverySelection } from "../../components/RepositoryDiscovery.tsx";
import {
  NOTHING_EXTRA,
  newDraftBase,
  type DraftConnectOutcome,
  type DraftSourceBase,
} from "../draft.ts";

export type BitbucketDraftSource = DraftSourceBase & {
  type: "BITBUCKET";
  workspace: string;
  slug: string;
  /** Name of a stored Atlassian credential, shared with Jira and Confluence. */
  credentialName: string;
  /**
   * Set when the repository is already ingested elsewhere: connecting then only
   * links it to the project (reusing its artifacts) instead of fetching and
   * ingesting it again. Absent for genuinely new repositories.
   */
  repositoryId?: string;
};

/**
 * Stages a Bitbucket repository. With a `repositoryId` the repository is already ingested
 * elsewhere and connecting only links it to the project; without one it is fetched and ingested.
 */
export function createBitbucketDraft(
  workspace: string,
  slug: string,
  credentialName: string,
  repositoryId?: string,
): BitbucketDraftSource {
  return {
    ...newDraftBase(),
    type: "BITBUCKET",
    workspace,
    slug,
    credentialName,
    repositoryId,
  };
}

/**
 * Stages a repository picked in the Bitbucket discovery flow. A `linkable`
 * selection carries the repository id so it can be linked without re-ingesting;
 * everything else is staged as a new repository to fetch and ingest. The
 * selection's `owner` is the workspace and its `name` the repository slug.
 */
export function createBitbucketDraftFromDiscovery(
  selection: DiscoverySelection,
  credentialName: string,
): BitbucketDraftSource {
  return createBitbucketDraft(
    selection.owner,
    selection.name,
    credentialName,
    selection.linkState === "linkable" ? selection.repositoryId : undefined,
  );
}

/** Two repositories are the same when `workspace/slug` matches, ignoring case. */
export function isSameBitbucketDraft(
  left: BitbucketDraftSource,
  right: BitbucketDraftSource,
): boolean {
  return (
    left.workspace.toLowerCase() === right.workspace.toLowerCase() &&
    left.slug.toLowerCase() === right.slug.toLowerCase()
  );
}

/** Connects a staged repository, linking it when it is already ingested. */
export async function connectBitbucketDraft(
  source: BitbucketDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  if (source.repositoryId) {
    // Already ingested elsewhere: link it to this project, reusing its artifacts.
    await addBitbucketRepositoryToProject(source.repositoryId, projectId);

    return { ...NOTHING_EXTRA, wasReused: true };
  }

  try {
    await connectBitbucketRepository({
      workspace: source.workspace,
      slug: source.slug,
      credentialName: source.credentialName,
      projectId,
    });
  } catch (error) {
    // A repository Bitbucket cannot find arrives as a 404 whose message names
    // it. A failed Bitbucket call during the check (a rejected token, an
    // outage) arrives as a bare 500, so say what the likely cause is instead
    // of showing the status text.
    if (error instanceof ApiError && error.status >= 500) {
      throw new Error(
        `Couldn't connect ${source.workspace}/${source.slug}. Check that the repository exists and that the selected credential can read it.`,
      );
    }

    throw error;
  }

  // The backend reports no `wasReused` for Bitbucket, so a connect that found
  // an existing connection cannot be told apart from a fresh one.
  return NOTHING_EXTRA;
}
