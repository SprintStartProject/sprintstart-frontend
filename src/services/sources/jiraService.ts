import { apiClient } from "../apiClient.ts";

// ---- Enums / shared ----

/** Connection state the backend reports for a connected Jira instance. */
export type JiraInstanceStatus =
  | "UPDATING"
  | "UP_TO_DATE"
  | "OUT_OF_DATE"
  | "FAILED";

export type JiraScheduleDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/**
 * Typed schedule payload for a Jira instance. Structurally identical to
 * `GithubScheduleSpec` (same discriminator field `type`); mirrored here to keep
 * the Jira connector self-contained rather than cross-importing from the GitHub
 * service.
 */
export type JiraScheduleSpec =
  | {
      type: "DAILY";
      time: string;
    }
  | {
      type: "WEEKLY";
      time: string;
      daysOfWeek: JiraScheduleDayOfWeek[];
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

// ---- Instances ----

export type ConnectJiraInstanceRequest = {
  displayName: string;
  /** Instance URL, e.g. "https://x.atlassian.net". */
  url: string;
  /** Must match a stored credential of this user. */
  userEmail: string;
  /** Name of the stored credential. */
  tokenName: string;
  /** UUID of the SprintStart project. */
  projectId: string;
};

export type UpdateJiraInstanceRequest = {
  instanceUrl: string;
};

export type UpdateJiraInstanceResponse = {
  transactionId: string;
};

export type JiraInstanceDto = {
  instanceUrl: string;
  displayName: string;
  /** ISO-8601 instant of the last successful update. */
  lastUpdate: string;
  /** UUIDs of the projects this instance is connected to. */
  projectIds: string[];
  sourceEnabled: boolean;
  status: JiraInstanceStatus;
  updateCredentialName: string;
  updateCredentialUserEmail: string;
};

// ---- Credentials ----

export type AddCredentialRequest = {
  userEmail: string;
  tokenName: string;
  /** The actual Jira API token. */
  authToken: string;
};

export type DeleteJiraCredentialRequest = {
  userEmail: string;
  tokenName: string;
};

export type ChangeJiraCredentialNameRequest = {
  userEmail: string;
  oldName: string;
  newName: string;
};

export type ChangeJiraCredentialTokenRequest = {
  userEmail: string;
  tokenName: string;
  newToken: string;
};

/**
 * A stored credential as returned by the backend: only `userEmail` plus the
 * credential/token name (`displayName`). The token secret is never returned.
 */
export type JiraCredentialsDto = {
  userEmail: string;
  displayName: string;
};

// ---- Config ----

export type ConfigureAllJiraInstancesRequest = {
  schedule: JiraScheduleSpec;
  autoUpdate: boolean;
};

export type ConfigureJiraInstanceRequest = {
  instanceUrl: string;
  schedule: JiraScheduleSpec;
  autoUpdate: boolean;
};

export type GetJiraInstanceConfigResponse = {
  instanceUrl: string;
  autoUpdate: boolean;
  spec: JiraScheduleSpec | null;
  /** String representation of the schedule (cron or similar). */
  schedule: string;
  /** ISO-8601 instant of the next scheduled sync, or null. */
  nextSyncAt: string | null;
};

// ---- Instances ----

/**
 * Lists the connected Jira instances, optionally filtered to a single project.
 * Requires the PM or ADMIN role.
 *
 * @param projectId - Optional project UUID to scope the result to.
 * @throws ApiError — 403 for an insufficient role.
 */
export async function getJiraInstances(
  projectId?: string,
): Promise<JiraInstanceDto[]> {
  const query = projectId
    ? `?${new URLSearchParams({ projectId }).toString()}`
    : "";

  return apiClient.fetch<JiraInstanceDto[]>(`/api/v1/jira/instances${query}`);
}

/**
 * Connects a Jira instance to SprintStart by notifying the backend, which
 * performs the ingestion asynchronously. Unlike the GitHub connector this
 * endpoint returns no transaction id (202 with an empty body); connect progress
 * is published through the ingestion-run tracking system instead.
 *
 * @param request - Instance URL, display name, credential and target project.
 * @throws ApiError — 404 when the instance or credential is missing, 502 when
 *   the Jira server is unreachable/incompatible, 403 for an insufficient role.
 */
export async function connectJiraInstance(
  request: ConnectJiraInstanceRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/jira/connect", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Triggers an update (re-ingestion) of one connected Jira instance.
 *
 * @returns The accepted ingestion transaction id.
 * @throws ApiError — 404 when the instance is unknown, 403 for an insufficient role.
 */
export async function updateJiraInstance(
  request: UpdateJiraInstanceRequest,
): Promise<UpdateJiraInstanceResponse> {
  return apiClient.fetch<UpdateJiraInstanceResponse>("/api/v1/jira/update", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Triggers an update of all connected Jira instances.
 *
 * @returns One accepted transaction id per instance.
 * @throws ApiError — 403 for an insufficient role.
 */
export async function updateAllJiraInstances(): Promise<
  UpdateJiraInstanceResponse[]
> {
  return apiClient.fetch<UpdateJiraInstanceResponse[]>(
    "/api/v1/jira/update-all",
    {
      method: "POST",
    },
  );
}

// ---- Credentials ----

/**
 * Stores a new Jira credential for a user. Credentials are keyed by the
 * `(userEmail, tokenName)` pair.
 *
 * @throws ApiError — 400 when a credential with that name already exists,
 *   403 for an insufficient role.
 */
export async function addJiraCredential(
  request: AddCredentialRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/jira/credentials", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Lists the stored Jira credentials of a single user (token secrets are never
 * returned). Credentials are queried per user, not globally.
 *
 * @param userEmail - The user whose credentials to list (path segment).
 * @param signal - Optional AbortSignal so callers (e.g. a refresh hook) can
 *   cancel an in-flight request and avoid stale-result races.
 * @throws ApiError — 403 for an insufficient role.
 */
export async function getJiraCredentialsOfUser(
  userEmail: string,
  signal?: AbortSignal,
): Promise<JiraCredentialsDto[]> {
  return apiClient.fetch<JiraCredentialsDto[]>(
    `/api/v1/jira/credentials/${encodeURIComponent(userEmail)}`,
    { signal },
  );
}

/**
 * Deletes a stored Jira credential identified by its `(userEmail, tokenName)`.
 *
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function deleteJiraCredential(
  request: DeleteJiraCredentialRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/jira/credentials", {
    method: "DELETE",
    body: JSON.stringify(request),
  });
}

/**
 * Renames a stored Jira credential.
 *
 * @returns The credential in its renamed state.
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function changeJiraCredentialName(
  request: ChangeJiraCredentialNameRequest,
): Promise<JiraCredentialsDto> {
  return apiClient.fetch<JiraCredentialsDto>(
    "/api/v1/jira/credentials/patch/name",
    {
      method: "PATCH",
      body: JSON.stringify(request),
    },
  );
}

/**
 * Replaces the token secret of a stored Jira credential.
 *
 * @returns The (unchanged) credential metadata.
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function changeJiraCredentialToken(
  request: ChangeJiraCredentialTokenRequest,
): Promise<JiraCredentialsDto> {
  return apiClient.fetch<JiraCredentialsDto>(
    "/api/v1/jira/credentials/patch/token",
    {
      method: "PATCH",
      body: JSON.stringify(request),
    },
  );
}

// ---- Config ----

/**
 * Loads the schedule and auto-update policy of every connected Jira instance.
 *
 * @throws ApiError — 403 for an insufficient role.
 */
export async function getAllJiraConfigs(): Promise<
  GetJiraInstanceConfigResponse[]
> {
  return apiClient.fetch<GetJiraInstanceConfigResponse[]>(
    "/api/v1/jira/config",
  );
}

/**
 * Loads the schedule and auto-update policy of one connected Jira instance.
 * The instance is identified by its full URL, passed as a query parameter — not
 * a path segment: Tomcat rejects the encoded slashes (`%2F`) of a URL in a path
 * with a 400, so the id travels in the query string where they are allowed.
 *
 * @param instanceUrl - The full Jira instance URL.
 * @throws ApiError — 404 when the instance is unknown, 403 for an insufficient role.
 */
export async function getJiraConfig(
  instanceUrl: string,
): Promise<GetJiraInstanceConfigResponse> {
  const query = new URLSearchParams({ instanceUrl }).toString();

  return apiClient.fetch<GetJiraInstanceConfigResponse>(
    `/api/v1/jira/config/instance?${query}`,
  );
}

/**
 * Applies one schedule and auto-update policy to all connected Jira instances.
 * The backend converts the typed schedule payload into the stored cron expression.
 *
 * @throws ApiError — 403 for an insufficient role.
 */
export async function configureAllJiraInstances(
  request: ConfigureAllJiraInstancesRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/jira/config", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Updates the schedule and auto-update policy of one connected Jira instance.
 * The instance is identified by `instanceUrl` in the body.
 *
 * @throws ApiError — 404 when the instance is unknown, 403 for an insufficient role.
 */
export async function configureJiraInstance(
  request: ConfigureJiraInstanceRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/jira/config/configure", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
