import { apiClient } from "../apiClient.ts";

export type ConnectGithubRepositoryRequest = {
  owner: string;
  name: string;
  tokenName: string;
  projectId: string;
};

export type ConnectGithubRepositoryResponse = {
  transactionId: string;
};

export type UpdateGithubRepositoryResponse = {
  transactionId: string;
};

export type UpdateGithubRepositoryRequest = {
  owner: string;
  name: string;
};

export type GithubScheduleDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

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
  return apiClient.fetch<ConnectGithubRepositoryResponse>(
    "/api/v1/github/connect",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

export async function getGithubPatNames(): Promise<string[]> {
  return apiClient.fetch<string[]>("/api/v1/github/pat");
}

export async function addGithubPat(name: string, token: string): Promise<void> {
  await apiClient.fetch<void>("/api/v1/github/pat", {
    method: "POST",
    body: JSON.stringify({ name, token }),
  });
}

export async function updateGithubPat(
  name: string,
  newToken: string,
): Promise<void> {
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

export async function updateAllGithubRepositories(): Promise<
  UpdateGithubRepositoryResponse[]
> {
  return apiClient.fetch<UpdateGithubRepositoryResponse[]>(
    "/api/v1/github/update-all",
    {
      method: "POST",
    },
  );
}

export async function updateGithubRepository(
  request: UpdateGithubRepositoryRequest,
): Promise<UpdateGithubRepositoryResponse> {
  return apiClient.fetch<UpdateGithubRepositoryResponse>(
    "/api/v1/github/update",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
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

  return apiClient.fetch<GithubRepositoryConfig>(
    `/api/v1/github/config/${owner}/${name}`,
  );
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
