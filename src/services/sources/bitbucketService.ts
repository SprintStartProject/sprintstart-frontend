import { apiClient } from "../apiClient.ts";
import type { BitbucketRepositoryReference } from "./bitbucketRepositoryInput.ts";
import type {
  ConfigureGithubRepositoryRequest,
  GithubScheduleSpec,
  RepositoryProjectAssignmentResponse,
} from "./githubService.ts";

/**
 * Bitbucket repositories are scheduled through the same shared spec as GitHub
 * repositories, Jira instances and Confluence spaces, so the schedule form is
 * shared with them as well.
 */
export type BitbucketScheduleSpec = GithubScheduleSpec;

export type ConfigureBitbucketRepositoryRequest = ConfigureGithubRepositoryRequest;

export type ConnectBitbucketRepositoryRequest = BitbucketRepositoryReference & {
  /** Name of a stored Atlassian credential, shared with Jira and Confluence. */
  credentialName: string;
  projectId: string;
};

/**
 * Unlike GitHub, the backend reports no `wasReused` flag, so a connect that
 * linked an existing connection looks the same as a fresh one.
 */
export type ConnectBitbucketRepositoryResponse = {
  transactionId: string;
};

export type ConnectBitbucketRepositoriesResult = {
  /** Maps `"workspace/slug"` to the accepted ingestion transaction id. */
  transactionIdsByRepository: Record<string, string>;
};

/**
 * One repository returned by workspace discovery, normalized for the UI. The
 * shape mirrors the GitHub `DiscoveredRepository` (plus the coordinates a
 * connect needs) so the discovery list can treat both alike.
 */
export type DiscoveredBitbucketRepository = BitbucketRepositoryReference & {
  name: string;
  isPrivate: boolean;
  /** The repository's browser URL; null when Bitbucket reported no link. */
  url: string | null;
  alreadyConnected: boolean;
  isEnabled: boolean | null;
};

/**
 * The discovery row as the backend sends it. The Kotlin properties `isPrivate`
 * and `enabled` carry no explicit JSON name, and Jackson may serialize a
 * boolean `isPrivate` as `private`, so both spellings are read.
 */
type BackendDiscoveredBitbucketRepository = {
  workspace: string;
  slug: string;
  name: string;
  isPrivate?: boolean;
  private?: boolean;
  url?: string | null;
  alreadyConnected?: boolean;
  enabled?: boolean | null;
  isEnabled?: boolean | null;
};

type BackendDiscoverBitbucketRepositoriesResponse = {
  repositories: BackendDiscoveredBitbucketRepository[];
};

export type DiscoverBitbucketRepositoriesResult = {
  repositories: DiscoveredBitbucketRepository[];
  /**
   * Best-effort "there may be another page" flag. The backend returns no total
   * count, so we infer it from a full page being returned (`length >= pageSize`).
   */
  hasMore: boolean;
};

export type UpdateBitbucketRepositoryResponse = {
  transactionId: string;
};

export type UpdateAllBitbucketRepositoriesResponse = {
  /** Maps `"workspace/slug"` to the update's transaction id; disabled repositories are absent. */
  transactionIdsByRepository: Record<string, string>;
};

/**
 * The schedule and auto-update policy of one connected repository. The backend
 * names the coordinates `workspace` and `slug` here, where the GitHub config
 * has `repositoryOwner` and `repositoryName`.
 */
export type BitbucketRepositoryConfig = {
  id: string;
  workspace: string;
  slug: string;
  autoUpdate: boolean;
  spec: BitbucketScheduleSpec | null;
  schedule: string;
  nextSyncAt: string | null;
};

const DEFAULT_DISCOVER_PAGE_SIZE = 20;

function mapDiscoveredRepository(
  repository: BackendDiscoveredBitbucketRepository,
): DiscoveredBitbucketRepository {
  return {
    workspace: repository.workspace,
    slug: repository.slug,
    name: repository.name,
    isPrivate: repository.isPrivate ?? repository.private ?? false,
    url: repository.url ?? null,
    alreadyConnected: repository.alreadyConnected ?? false,
    isEnabled: repository.enabled ?? repository.isEnabled ?? null,
  };
}

function repositoryPath({ workspace, slug }: BitbucketRepositoryReference): string {
  return `${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}`;
}

/**
 * Connects a Bitbucket repository to a project by notifying the backend. The
 * backend handles the actual ingestion asynchronously.
 *
 * @returns The backend transaction identifier for the accepted connection job.
 * @throws ApiError — 404 when the named credential does not exist, or when the
 *   repository does not exist or the credential cannot read it; 403 when the
 *   caller cannot access the project.
 */
export async function connectBitbucketRepository(
  request: ConnectBitbucketRepositoryRequest,
): Promise<ConnectBitbucketRepositoryResponse> {
  return apiClient.fetch<ConnectBitbucketRepositoryResponse>("/api/v1/bitbucket", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Connects several repositories to one project in a single call. Each
 * repository still becomes its own source. Requires the PM or ADMIN role and
 * access to the target project.
 *
 * @returns The accepted ingestion transaction ids keyed by `"workspace/slug"`.
 */
export async function connectBitbucketRepositories(
  repositories: BitbucketRepositoryReference[],
  credentialName: string,
  projectId: string,
): Promise<ConnectBitbucketRepositoriesResult> {
  return apiClient.fetch<ConnectBitbucketRepositoriesResult>("/api/v1/bitbucket/connect/all", {
    method: "POST",
    body: JSON.stringify({
      repositories: repositories.map(({ workspace, slug }) => ({
        workspace,
        slug,
        credentialName,
        projectId,
      })),
    }),
  });
}

/**
 * Discovers the repositories of one Bitbucket workspace the named Atlassian
 * credential can read. `page` is 0-based (matching the backend). Bitbucket has
 * no cross-workspace listing, so discovery is always scoped to a workspace.
 * Requires the PM or ADMIN role.
 *
 * @throws ApiError — 404 when the credential does not exist, 403 for insufficient role.
 */
export async function discoverBitbucketRepositories(
  workspace: string,
  credentialName: string,
  page = 0,
  pageSize = DEFAULT_DISCOVER_PAGE_SIZE,
): Promise<DiscoverBitbucketRepositoriesResult> {
  const query = new URLSearchParams({
    credentialName,
    page: String(page),
    pageSize: String(pageSize),
  }).toString();
  const response = await apiClient.fetch<BackendDiscoverBitbucketRepositoriesResponse>(
    `/api/v1/bitbucket/discover/workspace/${encodeURIComponent(workspace)}?${query}`,
  );
  const repositories = response.repositories.map(mapDiscoveredRepository);

  return {
    repositories,
    // No total is returned, so a full page is our only "there might be more" signal.
    hasMore: repositories.length >= pageSize,
  };
}

/**
 * Assigns an already-ingested repository to an additional project without
 * re-fetching or re-ingesting it. Idempotent. Requires the PM or ADMIN role and
 * access to the target project.
 *
 * @throws ApiError — 403 when the caller cannot access the project, 404 when the
 *   repository connection is unknown.
 */
export async function addBitbucketRepositoryToProject(
  repositoryId: string,
  projectId: string,
): Promise<RepositoryProjectAssignmentResponse> {
  return apiClient.fetch<RepositoryProjectAssignmentResponse>(
    `/api/v1/bitbucket/connections/${encodeURIComponent(repositoryId)}/projects/${encodeURIComponent(projectId)}`,
    { method: "POST" },
  );
}

/**
 * Removes the link between an already-ingested repository and a project, the
 * counterpart to {@link addBitbucketRepositoryToProject}. The repository and its
 * artifacts are kept; only the project assignment is dropped. Idempotent.
 *
 * @returns The repository connection's remaining project ids after the unlink.
 * @throws ApiError — 403 when the caller cannot access the project, 404 when the
 *   repository connection is unknown.
 */
export async function removeBitbucketRepositoryFromProject(
  repositoryId: string,
  projectId: string,
): Promise<RepositoryProjectAssignmentResponse> {
  return apiClient.fetch<RepositoryProjectAssignmentResponse>(
    `/api/v1/bitbucket/connections/${encodeURIComponent(repositoryId)}/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE" },
  );
}

/**
 * Starts an update of one connected repository. A paused (disabled) repository
 * is refused by the backend rather than quietly updated.
 */
export async function updateBitbucketRepository(
  repositoryId: string,
): Promise<UpdateBitbucketRepositoryResponse> {
  return apiClient.fetch<UpdateBitbucketRepositoryResponse>(
    `/api/v1/bitbucket/connections/${encodeURIComponent(repositoryId)}/update`,
    { method: "POST" },
  );
}

/** Updates every enabled connected repository; disabled ones are skipped. */
export async function updateAllBitbucketRepositories(): Promise<UpdateAllBitbucketRepositoriesResponse> {
  return apiClient.fetch<UpdateAllBitbucketRepositoriesResponse>("/api/v1/bitbucket/update-all", {
    method: "POST",
  });
}

/**
 * Applies one schedule and auto-update policy to all connected Bitbucket
 * repositories. The backend converts the typed schedule into the stored cron
 * expression.
 */
export async function configureAllBitbucketRepositories(
  request: ConfigureBitbucketRepositoryRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/bitbucket/config", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Loads the current schedule and auto-update policy for one connected repository.
 */
export async function getBitbucketRepositoryConfig(
  workspace: string,
  slug: string,
): Promise<BitbucketRepositoryConfig> {
  return apiClient.fetch<BitbucketRepositoryConfig>(
    `/api/v1/bitbucket/config/${repositoryPath({ workspace, slug })}`,
  );
}

/**
 * Updates the schedule and auto-update policy for one connected repository.
 */
export async function configureBitbucketRepository(
  repository: BitbucketRepositoryReference,
  request: ConfigureBitbucketRepositoryRequest,
): Promise<void> {
  await apiClient.fetch<void>(`/api/v1/bitbucket/config/${repositoryPath(repository)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
