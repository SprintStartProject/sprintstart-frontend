import { apiClient } from "../apiClient.ts";
import type { GithubScheduleSpec } from "./githubService.ts";

// ---- Credentials ----

/**
 * A stored Notion credential as returned by the backend. Credentials belong to
 * the authenticated user and are keyed by `name` alone; the integration token
 * is never returned.
 */
export type NotionCredentialDto = {
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AddNotionCredentialRequest = {
  name: string;
  /** The Notion integration token. */
  token: string;
};

export type ChangeNotionCredentialTokenRequest = {
  name: string;
  newToken: string;
};

export type ChangeNotionCredentialNameRequest = {
  oldName: string;
  newName: string;
};

export type DeleteNotionCredentialRequest = {
  name: string;
};

// ---- Discovery ----

/**
 * A page the Notion integration can see. Only pages that were shared with the
 * integration inside Notion are returned.
 */
export type NotionPageDto = {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string | null;
};

// ---- Connections ----

/**
 * Notion connections are scheduled through the same shared spec as GitHub
 * repositories, Jira instances and Confluence spaces, so the schedule form is
 * shared with them as well.
 */
export type ScheduleSpec = GithubScheduleSpec;

export type CreateNotionConnectionRequest = {
  /** Name of a stored Notion credential. */
  credentialName: string;
  pageId: string;
};

export type ConfigureNotionScheduleRequest = {
  schedule: ScheduleSpec;
  autoUpdate: boolean;
};

/**
 * One Notion page connected to a project. Unlike the Confluence DTO the
 * schedule spec is called `scheduleSpec` here and `schedule` is the readable
 * summary string.
 */
export type NotionConnectionDto = {
  id: string;
  projectId: string;
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  credentialName: string;
  sourceEnabled: boolean;
  autoUpdate: boolean;
  schedule?: string;
  scheduleSpec?: ScheduleSpec | null;
  nextSyncAt?: string | null;
  lastEditedTime: string | null;
  contentHash: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type NotionSyncOutcome = "CREATED" | "UPDATED" | "UNCHANGED" | "FAILED";

export type NotionSyncFailure = {
  stage: string;
  message: string;
};

/**
 * Result of a manual page sync. The backend runs it synchronously, so the
 * outcome is known as soon as the request returns.
 */
export type NotionSyncResult = {
  runId: string;
  connectionId: string;
  outcome: NotionSyncOutcome;
  failure?: NotionSyncFailure | null;
};

const CREDENTIALS_PATH = "/api/v1/notion/credentials";

function connectionsPath(projectId: string): string {
  return `/api/v1/notion/projects/${encodeURIComponent(projectId)}/connections`;
}

/**
 * Lists the Notion credentials owned by the authenticated user. Tokens are
 * never returned.
 *
 * @param signal - Optional AbortSignal for cancelling an in-flight request.
 * @throws ApiError when the request fails.
 */
export async function getMyNotionCredentials(signal?: AbortSignal): Promise<NotionCredentialDto[]> {
  return apiClient.fetch<NotionCredentialDto[]>(CREDENTIALS_PATH, { signal });
}

/**
 * Stores a new Notion credential after the backend has checked the token
 * against Notion.
 *
 * @throws ApiError — 401 when Notion rejects the token, 409 when the name is
 *   already taken, 502 when Notion cannot be reached.
 */
export async function addNotionCredential(request: AddNotionCredentialRequest): Promise<void> {
  await apiClient.fetch<void>(CREDENTIALS_PATH, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Replaces the token of a stored Notion credential.
 *
 * @throws ApiError — 401 when Notion rejects the new token, 404 when the
 *   credential is unknown, 502 when Notion cannot be reached.
 */
export async function changeNotionCredentialToken(
  request: ChangeNotionCredentialTokenRequest,
): Promise<void> {
  await apiClient.fetch<void>(`${CREDENTIALS_PATH}/token`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Renames a stored Notion credential.
 *
 * @throws ApiError — 404 when the credential is unknown, 409 when the new name
 *   is already taken.
 */
export async function changeNotionCredentialName(
  request: ChangeNotionCredentialNameRequest,
): Promise<void> {
  await apiClient.fetch<void>(`${CREDENTIALS_PATH}/name`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Deletes a stored Notion credential. The name travels in the request body.
 *
 * @throws ApiError — 404 when the credential is unknown.
 */
export async function deleteNotionCredential(
  request: DeleteNotionCredentialRequest,
): Promise<void> {
  await apiClient.fetch<void>(CREDENTIALS_PATH, {
    method: "DELETE",
    body: JSON.stringify(request),
  });
}

/**
 * Client for Notion page discovery and the project-scoped connection and
 * synchronization operations (`/api/v1/notion/projects/{projectId}/connections`).
 */
export const notionService = {
  /**
   * Lists the pages the credential's integration can see. Pages that were not
   * shared with the integration in Notion do not appear.
   *
   * @throws ApiError — 401 when Notion rejects the token, 502 when Notion
   *   cannot be reached.
   */
  async discoverPages(credentialName: string, signal?: AbortSignal): Promise<NotionPageDto[]> {
    return apiClient.fetch<NotionPageDto[]>(
      `/api/v1/notion/pages?credentialName=${encodeURIComponent(credentialName)}`,
      { signal },
    );
  },

  /**
   * Connects one Notion page to a project.
   *
   * @throws ApiError — 409 when the page is already connected.
   */
  async createConnection(
    projectId: string,
    request: CreateNotionConnectionRequest,
  ): Promise<NotionConnectionDto> {
    return apiClient.fetch<NotionConnectionDto>(connectionsPath(projectId), {
      method: "POST",
      body: JSON.stringify({
        credentialName: request.credentialName.trim(),
        pageId: request.pageId,
      }),
    });
  },

  /**
   * Lists the Notion pages connected to a project. The backend has no endpoint
   * for a single connection, so callers look the connection up in this list.
   */
  async listConnections(projectId: string): Promise<NotionConnectionDto[]> {
    return apiClient.fetch<NotionConnectionDto[]>(connectionsPath(projectId));
  },

  /**
   * Syncs one connected page now and waits for the outcome.
   */
  async syncConnection(projectId: string, connectionId: string): Promise<NotionSyncResult> {
    return apiClient.fetch<NotionSyncResult>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}/update`,
      { method: "POST" },
    );
  },

  /**
   * Removes one page connection from a project. Artifacts that were already
   * ingested stay in the knowledge base (known backend gap).
   */
  async deleteConnection(projectId: string, connectionId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    );
  },

  /**
   * Updates the automatic synchronization settings of one page connection.
   */
  async configureSchedule(
    projectId: string,
    connectionId: string,
    request: ConfigureNotionScheduleRequest,
  ): Promise<NotionConnectionDto> {
    return apiClient.fetch<NotionConnectionDto>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}/schedule`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      },
    );
  },
};
