import { apiClient } from "../apiClient.ts";
import type { ScheduleSpec } from "./syncSchedule.ts";

// ---- Credentials ----

/**
 * A stored Notion credential as returned by the backend. Credentials belong to
 * the authenticated user and are keyed by `name` alone; the token is never
 * returned.
 *
 * The workspace is read from Notion when the token is stored or replaced. A
 * token whose identity does not name a workspace leaves both fields `null`; a
 * connection made with it is then named after the credential.
 */
export type NotionCredentialDto = {
  name: string;
  workspaceId: string | null;
  workspaceName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AddNotionCredentialRequest = {
  name: string;
  /** The Notion token. */
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
 * A page the Notion credential can see, as shown in the connect preview. The
 * list is read-only: nothing is stored, and connecting indexes every page the
 * credential can see rather than a selection of these.
 */
export type NotionPageDto = {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
};

// ---- Connections ----

export type CreateNotionConnectionRequest = {
  /**
   * Name of a stored Notion credential. Everything that credential can see in
   * Notion is what gets connected.
   */
  credentialName: string;
};

export type ConfigureNotionScheduleRequest = {
  schedule: ScheduleSpec;
  autoUpdate: boolean;
};

/**
 * One Notion workspace connected to a project. Unlike the Confluence DTO the
 * schedule spec is called `scheduleSpec` here and `schedule` is the readable
 * summary string. `workspaceId` is `null` when the token's identity did not name
 * a workspace; `workspaceName` is then the credential name.
 */
export type NotionWorkspaceConnectionDto = {
  id: string;
  projectId: string;
  workspaceId: string | null;
  workspaceName: string;
  workspaceUrl: string;
  credentialName: string;
  sourceEnabled: boolean;
  autoUpdate: boolean;
  schedule: string;
  scheduleSpec: ScheduleSpec;
  nextSyncAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type NotionSyncFailure = {
  stage: "FETCHING" | "PARSING" | "PERSISTENCE";
  message: string;
};

/**
 * Result of a manual workspace sync. The counters are per page. `failure` is
 * only set when the whole run failed; single pages that fail are counted in
 * `failedPages` and listed on the run itself.
 */
export type NotionWorkspaceSyncResult = {
  runId: string;
  connectionId: string;
  outcome: "COMPLETED" | "PARTIAL" | "FAILED";
  failure?: NotionSyncFailure | null;
  successfulPages: number;
  failedPages: number;
  removedPages: number;
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
 * against Notion. The returned DTO already carries the workspace the token
 * belongs to.
 *
 * @throws ApiError — 409 when the name is already taken, 422 when Notion
 *   rejects the token (`code` is NOTION_AUTHENTICATION_FAILED or
 *   NOTION_ACCESS_DENIED; the message is readable as is), 502 when Notion cannot
 *   be reached.
 */
export async function addNotionCredential(
  request: AddNotionCredentialRequest,
): Promise<NotionCredentialDto> {
  return apiClient.fetch<NotionCredentialDto>(CREDENTIALS_PATH, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Replaces the token of a stored Notion credential and re-records its
 * workspace.
 *
 * @throws ApiError — 404 when the credential is unknown, 422 when Notion
 *   rejects the new token (same codes as {@link addNotionCredential}), 502 when
 *   Notion cannot be reached.
 */
export async function changeNotionCredentialToken(
  request: ChangeNotionCredentialTokenRequest,
): Promise<NotionCredentialDto> {
  return apiClient.fetch<NotionCredentialDto>(`${CREDENTIALS_PATH}/token`, {
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
): Promise<NotionCredentialDto> {
  return apiClient.fetch<NotionCredentialDto>(`${CREDENTIALS_PATH}/name`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Deletes a stored Notion credential. The name travels in the request body.
 *
 * @throws ApiError — 404 when the credential is unknown, 409 when a connected
 *   workspace still uses it.
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
 * Client for the Notion page preview and the project-scoped connection and
 * synchronization operations (`/api/v1/notion/projects/{projectId}/connections`).
 */
export const notionService = {
  /**
   * Previews the pages the credential can see. This is only a preview: nothing
   * is stored, and a connection always covers everything the credential can see
   * in Notion, not just these pages.
   *
   * @throws ApiError — 404 when the credential is unknown, 422 when Notion
   *   rejects the token (message is readable as is), 502 when Notion cannot be
   *   reached.
   */
  async discoverPages(credentialName: string, signal?: AbortSignal): Promise<NotionPageDto[]> {
    return apiClient.fetch<NotionPageDto[]>(
      `/api/v1/notion/pages?credentialName=${encodeURIComponent(credentialName)}`,
      { signal },
    );
  },

  /**
   * Connects the workspace of a credential to a project and starts its first
   * ingestion in the background.
   *
   * @throws ApiError — 404 when the credential is unknown, 409 when this
   *   credential or its workspace is already connected to this project (other
   *   projects may connect the same one), 422 when Notion rejects the stored
   *   token, 502 when Notion cannot be reached.
   */
  async createConnection(
    projectId: string,
    request: CreateNotionConnectionRequest,
  ): Promise<NotionWorkspaceConnectionDto> {
    return apiClient.fetch<NotionWorkspaceConnectionDto>(connectionsPath(projectId), {
      method: "POST",
      body: JSON.stringify({ credentialName: request.credentialName.trim() }),
    });
  },

  /**
   * Lists the Notion workspaces connected to a project. The backend has no
   * endpoint for a single connection, so callers look the connection up in this
   * list.
   */
  async listConnections(projectId: string): Promise<NotionWorkspaceConnectionDto[]> {
    return apiClient.fetch<NotionWorkspaceConnectionDto[]>(connectionsPath(projectId));
  },

  /**
   * Syncs one connected workspace now and waits for the per-page counters.
   */
  async syncConnection(
    projectId: string,
    connectionId: string,
  ): Promise<NotionWorkspaceSyncResult> {
    return apiClient.fetch<NotionWorkspaceSyncResult>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}/update`,
      { method: "POST" },
    );
  },

  /**
   * Removes one workspace connection from a project. Its pages leave the
   * project's knowledge base.
   */
  async deleteConnection(projectId: string, connectionId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    );
  },

  /**
   * Updates the automatic synchronization settings of one workspace connection.
   */
  async configureSchedule(
    projectId: string,
    connectionId: string,
    request: ConfigureNotionScheduleRequest,
  ): Promise<NotionWorkspaceConnectionDto> {
    return apiClient.fetch<NotionWorkspaceConnectionDto>(
      `${connectionsPath(projectId)}/${encodeURIComponent(connectionId)}/schedule`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      },
    );
  },
};
