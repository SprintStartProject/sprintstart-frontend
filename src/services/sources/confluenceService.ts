import { apiClient } from "../apiClient.ts";
import type { GithubScheduleSpec } from "./githubService.ts";

export type CreateConfluenceConnectionRequest = {
  baseUrl: string;
  spaceId: string;
  /** Name of a stored Atlassian credential, shared with the Jira connector. */
  credentialName: string;
  pageAllowlist?: string[];
  pageDenylist?: string[];
};

/**
 * Confluence connections are scheduled through the same shared spec as GitHub
 * repositories and Jira instances (interval, daily, weekly, monthly or cron),
 * so the schedule form is shared with them as well.
 */
export type ScheduleSpec = GithubScheduleSpec;

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
  spaceName: string | null;
  credentialName: string;
  pageAllowlist: string[];
  pageDenylist: string[];
  credentialsConfigured: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  sourceEnabled: boolean;
  autoUpdate?: boolean;
  spec?: ScheduleSpec | null;
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
          credentialName: request.credentialName.trim(),
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
   * Removes one Confluence space connection from a project. The pages already
   * ingested stay in the knowledge base; only this project stops syncing the
   * space.
   */
  async deleteConnection(projectId: string, connectionId: string): Promise<void> {
    await apiClient.fetch<void>(
      `/api/v1/confluence/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}`,
      {
        method: "DELETE",
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
