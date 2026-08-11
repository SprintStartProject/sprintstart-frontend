import { ApiError, apiClient } from "../apiClient.ts";

export type ConnectGithubRepositoryRequest = {
  owner: string;
  name: string;
  tokenName: string;
  projectId: string;
};

export type ConnectGithubRepositoryResponse = {
  transactionId: string;
};

/**
 * One repository returned by the org/user discovery endpoints, normalized for
 * the UI. The backend serializes `private` and `html_url`; we map them to the
 * camelCase shape the components consume. `alreadyConnected`/`isEnabled` reflect
 * whether the repo is already a SprintStart source and, if so, its enabled flag.
 */
export type DiscoveredRepository = {
  name: string;
  isPrivate: boolean;
  url: string;
  alreadyConnected: boolean;
  isEnabled: boolean | null;
};

type BackendDiscoveredRepository = {
  name: string;
  private: boolean;
  html_url: string;
  alreadyConnected?: boolean;
  isEnabled?: boolean | null;
};

type BackendDiscoverRepositoriesResponse = {
  repositories: BackendDiscoveredRepository[];
};

/** Which discovery endpoint an owner should be resolved through. */
export type DiscoveryOwnerType = "auto" | "org" | "user";

export type DiscoverRepositoriesResult = {
  repositories: DiscoveredRepository[];
  /**
   * Best-effort "there may be another page" flag. The backend returns no total
   * count, so we infer it from a full page being returned (`length === pageSize`).
   */
  hasMore: boolean;
  /** The endpoint that actually produced the result (after any auto fallback). */
  resolvedOwnerType: "org" | "user";
};

export type ConnectRepositoriesResult = {
  /** Maps `"owner/name"` to the accepted ingestion transaction id. */
  transactionIdsByRepositoryId: Record<string, string>;
};

export type UpdateGithubRepositoryResponse = {
  transactionId: string;
};

export type UpdateGithubRepositoryRequest = {
  owner: string;
  name: string;
};

export type GithubScheduleDayOfWeek =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type GithubScheduleSpec =
  | {
      type: "DAILY";
      time: string;
    }
  | {
      type: "WEEKLY";
      time: string;
      daysOfWeek: GithubScheduleDayOfWeek[];
    }
  | {
      type: "MONTHLY";
      time: string;
      dayOfMonth: number;
    }
  | {
      type: "INTERVAL";
      everyMinutes: number;
    }
  | {
      type: "CUSTOM";
      cron: string;
    };

export type ConfigureGithubRepositoryRequest = {
  autoUpdate: boolean;
  schedule: GithubScheduleSpec;
};

export type GithubRepositoryConfig = {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  autoUpdate: boolean;
  spec: GithubScheduleSpec | null;
  schedule: string;
  nextSyncAt: string | null;
};

/**
 * Connects a GitHub repository to SprintStart by notifying the backend.
 * The backend handles the actual ingestion asynchronously.
 *
 * @param request - The GitHub repository owner and repository name.
 * @returns The backend transaction identifier for the accepted connection job.
 * @throws Error if the connection request fails.
 */
export async function connectGithubRepository(
  request: ConnectGithubRepositoryRequest,
): Promise<ConnectGithubRepositoryResponse> {
  return apiClient.fetch<ConnectGithubRepositoryResponse>("/api/v1/github/connect", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

function mapDiscoveredRepository(repository: BackendDiscoveredRepository): DiscoveredRepository {
  return {
    name: repository.name,
    isPrivate: repository.private,
    url: repository.html_url,
    alreadyConnected: repository.alreadyConnected ?? false,
    isEnabled: repository.isEnabled ?? null,
  };
}

const DEFAULT_DISCOVER_PAGE_SIZE = 20;

function buildDiscoverQuery(tokenName: string, page: number, pageSize: number): string {
  return new URLSearchParams({
    tokenName,
    page: String(page),
    pageSize: String(pageSize),
  }).toString();
}

function toDiscoverResult(
  response: BackendDiscoverRepositoriesResponse,
  pageSize: number,
  resolvedOwnerType: "org" | "user",
): DiscoverRepositoriesResult {
  const repositories = response.repositories.map(mapDiscoveredRepository);

  return {
    repositories,
    // No total is returned, so a full page is our only "there might be more" signal.
    hasMore: repositories.length >= pageSize,
    resolvedOwnerType,
  };
}

/**
 * Discovers the repositories of a GitHub organization the given stored PAT can
 * see. `page` is 0-based (matching the backend). Requires the PM or ADMIN role.
 *
 * @throws ApiError — 404 when the org (or PAT) is not found, 403 for insufficient role.
 */
export async function discoverOrgRepositories(
  org: string,
  tokenName: string,
  page = 0,
  pageSize = DEFAULT_DISCOVER_PAGE_SIZE,
): Promise<DiscoverRepositoriesResult> {
  const query = buildDiscoverQuery(tokenName, page, pageSize);
  const response = await apiClient.fetch<BackendDiscoverRepositoriesResponse>(
    `/api/v1/github/discover/org/${encodeURIComponent(org)}?${query}`,
  );

  return toDiscoverResult(response, pageSize, "org");
}

/**
 * Discovers the repositories of a GitHub user the given stored PAT can see.
 * `page` is 0-based. Requires the PM or ADMIN role.
 *
 * @throws ApiError — 404 when the user (or PAT) is not found, 403 for insufficient role.
 */
export async function discoverUserRepositories(
  user: string,
  tokenName: string,
  page = 0,
  pageSize = DEFAULT_DISCOVER_PAGE_SIZE,
): Promise<DiscoverRepositoriesResult> {
  const query = buildDiscoverQuery(tokenName, page, pageSize);
  const response = await apiClient.fetch<BackendDiscoverRepositoriesResponse>(
    `/api/v1/github/discover/user/${encodeURIComponent(user)}?${query}`,
  );

  return toDiscoverResult(response, pageSize, "user");
}

/**
 * Discovers repositories for an owner that may be either an organization or a
 * user. A GitHub owner is one or the other, and the backend exposes them under
 * separate endpoints, so `"auto"` tries the org endpoint first and falls back to
 * the user endpoint when the org lookup fails in a way that means "not an org".
 * Callers that already know the owner type can pass `"org"`/`"user"` to skip the
 * probe.
 *
 * GitHub answers `/orgs/{owner}/repos` with a 404 when `owner` is a user, but the
 * backend does not translate that GitHub 404 and surfaces it as a 5xx instead, so
 * both a 404 and any server error from the org endpoint are treated as the
 * wrong-owner-type signal and retried against the user endpoint. Deterministic
 * auth/limit failures (401/403/429) are not a wrong-owner-type signal and
 * propagate unchanged.
 *
 * @throws ApiError — propagates auth/permission/rate-limit failures, and any
 *   failure of the user endpoint after the org endpoint was retried.
 */
export async function discoverRepositories(
  owner: string,
  tokenName: string,
  ownerType: DiscoveryOwnerType = "auto",
  page = 0,
  pageSize = DEFAULT_DISCOVER_PAGE_SIZE,
): Promise<DiscoverRepositoriesResult> {
  if (ownerType === "org") {
    return discoverOrgRepositories(owner, tokenName, page, pageSize);
  }

  if (ownerType === "user") {
    return discoverUserRepositories(owner, tokenName, page, pageSize);
  }

  try {
    return await discoverOrgRepositories(owner, tokenName, page, pageSize);
  } catch (error) {
    const isWrongOwnerType =
      error instanceof ApiError && (error.status === 404 || error.status >= 500);

    if (isWrongOwnerType) {
      return discoverUserRepositories(owner, tokenName, page, pageSize);
    }

    throw error;
  }
}

/**
 * Connects several repositories to one project in a single call, reusing the
 * backend batch endpoint (each repo still becomes its own source). Requires the
 * PM or ADMIN role and access to the target project.
 *
 * @param repositories - The repos to connect (owner + name each).
 * @param tokenName - The stored PAT used for every repo in the batch.
 * @param projectId - The project every repo is connected to.
 * @returns The accepted ingestion transaction ids keyed by `"owner/name"`.
 * @throws ApiError if the batch request fails.
 */
export async function connectRepositories(
  repositories: { owner: string; name: string }[],
  tokenName: string,
  projectId: string,
): Promise<ConnectRepositoriesResult> {
  return apiClient.fetch<ConnectRepositoriesResult>("/api/v1/github/connect/all", {
    method: "POST",
    body: JSON.stringify({
      repositories: repositories.map((repository) => ({
        owner: repository.owner,
        name: repository.name,
        tokenName,
        projectId,
      })),
    }),
  });
}

/**
 * Fetches the list of stored GitHub PAT names (without the secret value).
 *
 * Accepts an optional `AbortSignal` so callers can cancel a stale in-flight
 * request (e.g. when a newer fetch is triggered before the previous one
 * resolves); the underlying `apiClient.fetch` passes it through to `fetch`.
 */
export async function getGithubPatNames(signal?: AbortSignal): Promise<string[]> {
  return apiClient.fetch<string[]>("/api/v1/github/pat", { signal });
}

export async function addGithubPat(name: string, token: string): Promise<void> {
  await apiClient.fetch<void>("/api/v1/github/pat", {
    method: "POST",
    body: JSON.stringify({ name, token }),
  });
}

export async function updateGithubPat(name: string, newToken: string): Promise<void> {
  await apiClient.fetch<void>("/api/v1/github/pat/update", {
    method: "PUT",
    body: JSON.stringify({ name, newToken }),
  });
}

export async function deleteGithubPat(name: string): Promise<void> {
  await apiClient.fetch<void>("/api/v1/github/pat/delete", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function updateAllGithubRepositories(): Promise<UpdateGithubRepositoryResponse[]> {
  return apiClient.fetch<UpdateGithubRepositoryResponse[]>("/api/v1/github/update-all", {
    method: "POST",
  });
}

/**
 * The project assignment a repository connection reports after a link/unlink
 * call: the connection's id and its full set of project ids afterwards. Both
 * `addRepositoryToProject` (link) and `removeRepositoryFromProject` (unlink)
 * return this identical shape.
 */
export type RepositoryProjectAssignmentResponse = {
  repositoryId: string;
  /** The repository's resulting project assignment after the call. */
  projectIds: string[];
};

/**
 * Assigns an already-ingested repository to an additional project without
 * re-fetching or re-ingesting it. Idempotent. Requires the PM or ADMIN role and
 * access to the target project.
 *
 * @throws ApiError — 403 when the caller cannot access the project, 404 when the
 *   repository connection is unknown.
 */
export async function addRepositoryToProject(
  repositoryId: string,
  projectId: string,
): Promise<RepositoryProjectAssignmentResponse> {
  return apiClient.fetch<RepositoryProjectAssignmentResponse>(
    `/api/v1/github/connections/${encodeURIComponent(repositoryId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: "POST",
    },
  );
}

/**
 * Removes the link between an already-ingested repository and a project, the
 * counterpart to {@link addRepositoryToProject}. The repository and its
 * artifacts are kept; only the project assignment is dropped. Idempotent.
 * Requires the PM or ADMIN role and access to the target project.
 *
 * @returns The repository connection's remaining project ids after the unlink.
 * @throws ApiError — 403 when the caller cannot access the project, 404 when the
 *   repository connection is unknown.
 */
export async function removeRepositoryFromProject(
  repositoryId: string,
  projectId: string,
): Promise<RepositoryProjectAssignmentResponse> {
  return apiClient.fetch<RepositoryProjectAssignmentResponse>(
    `/api/v1/github/connections/${encodeURIComponent(repositoryId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function updateGithubRepository(
  request: UpdateGithubRepositoryRequest,
): Promise<UpdateGithubRepositoryResponse> {
  return apiClient.fetch<UpdateGithubRepositoryResponse>("/api/v1/github/update", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Applies one schedule and auto-update policy to all connected GitHub repositories.
 * The backend converts the typed schedule payload into the stored cron expression.
 */
export async function configureAllGithubRepositories(
  request: ConfigureGithubRepositoryRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/github/config/global", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Loads the current schedule and auto-update policy for one connected GitHub repository.
 */
export async function getGithubRepositoryConfig(
  request: UpdateGithubRepositoryRequest,
): Promise<GithubRepositoryConfig> {
  const owner = encodeURIComponent(request.owner);
  const name = encodeURIComponent(request.name);

  return apiClient.fetch<GithubRepositoryConfig>(`/api/v1/github/config/${owner}/${name}`);
}

/**
 * Updates the schedule and auto-update policy for one connected GitHub repository.
 */
export async function configureGithubRepository(
  repository: UpdateGithubRepositoryRequest,
  request: ConfigureGithubRepositoryRequest,
): Promise<void> {
  const owner = encodeURIComponent(repository.owner);
  const name = encodeURIComponent(repository.name);

  await apiClient.fetch<void>(`/api/v1/github/config/${owner}/${name}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
