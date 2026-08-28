import { apiClient } from "../apiClient.ts";

export type CreateConfluenceConnectionRequest = {
  baseUrl: string;
  spaceId: string;
  email: string;
  apiToken: string;
  pageAllowlist?: string[];
  pageDenylist?: string[];
};

export type ScheduleSpec = {
  type: "INTERVAL";
  everyMinutes: number;
};

export type ConfigureConfluenceScheduleRequest = {
  schedule: ScheduleSpec;
  autoUpdate: boolean;
};

export type ConfluenceConnectionDto = {
  id: string;
  projectId: string;
  baseUrl: string;
  spaceId: string;
  spaceKey: string;
  pageAllowlist: string[];
  pageDenylist: string[];
  credentialsConfigured: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  sourceEnabled: boolean;
  autoUpdate?: boolean;
  spec?: ScheduleSpec;
  schedule?: string;
  nextSyncAt?: string | null;
};

export type ConfluenceIngestionStatus = "COMPLETED" | "PARTIAL" | "FAILED";

export type ConfluenceIngestionFailure = {
  pageId: string;
  stage: string;
  httpStatus?: number | null;
  attempts?: number;
  message: string;
};

export type ConfluenceIngestionResult = {
  runId: string;
  connectionId: string;
  discovered: number;
  eligible: number;
  filtered: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  failures: ConfluenceIngestionFailure[];
  status: ConfluenceIngestionStatus;
};

/**
 * Client for project-scoped Confluence connection and synchronization operations
 * (`/api/v1/confluence/projects/{projectId}/connections`).
 */
export const confluenceService = {
  /**
   * Validates credentials and space ID before storing a new connection.
   */
  async createConnection(
    projectId: string,
    request: CreateConfluenceConnectionRequest,
  ): Promise<ConfluenceConnectionDto> {
    return apiClient.fetch<ConfluenceConnectionDto>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections`,
      {
        method: "POST",
        body: JSON.stringify({
          baseUrl: request.baseUrl.trim(),
          spaceId: request.spaceId.trim(),
          email: request.email.trim(),
          apiToken: request.apiToken.trim(),
          pageAllowlist: request.pageAllowlist ?? [],
          pageDenylist: request.pageDenylist ?? [],
        }),
      },
    );
  },

  /**
   * Lists the configured Confluence connections belonging to a managed project.
   */
  async listConnections(projectId: string): Promise<ConfluenceConnectionDto[]> {
    return apiClient.fetch<ConfluenceConnectionDto[]>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections`,
    );
  },

  /**
   * Retrieves a single Confluence connection scoped to a project.
   */
  async getConnection(projectId: string, connectionId: string): Promise<ConfluenceConnectionDto> {
    return apiClient.fetch<ConfluenceConnectionDto>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}`,
    );
  },

  /**
   * Runs the ingestion flow for one project-owned Confluence connection.
   */
  async syncConnection(
    projectId: string,
    connectionId: string,
  ): Promise<ConfluenceIngestionResult> {
    return apiClient.fetch<ConfluenceIngestionResult>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}/update`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Updates automatic synchronization settings for one Confluence connection.
   */
  async configureSchedule(
    projectId: string,
    connectionId: string,
    request: ConfigureConfluenceScheduleRequest,
  ): Promise<ConfluenceConnectionDto> {
    return apiClient.fetch<ConfluenceConnectionDto>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}/schedule`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      },
    );
  },
};
