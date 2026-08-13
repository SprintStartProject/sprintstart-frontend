import { apiClient } from "./apiClient.ts";

/**
 * A registered connector (e.g. "github") and its global enablement state, as
 * reported by the backend Connector Overview API.
 */
export type ConnectorDto = {
  id: string;
  name: string;
  enabled: boolean;
  firstConfiguredAt: string | null;
  lastConfiguredAt: string | null;
};

export type ConfigureConnectorRequest = {
  enabled: boolean;
};

export type ConfigureConnectorResponse = {
  id: string;
  enabled: boolean;
  firstConfiguredAt: string | null;
  lastConfiguredAt: string | null;
};

/**
 * A single in-scope source belonging to a connector (e.g. a connected GitHub
 * repository). There is no tri-state allow/deny/unset concept in the backend
 * contract: `enabled: true` means the source is in scope (allowed), `false`
 * means it is excluded (denied).
 */
export type ConnectorSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

export type GetSourcesOfConnectorResponse = {
  connectorId: string;
  sources: ConnectorSource[];
};

export type PatchSourceRequest = {
  sourceId: string;
  enabled: boolean;
};

export type PatchSourcesRequest = {
  sources: PatchSourceRequest[];
};

export type PatchedSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

export type PatchSourcesOfConnectorResponse = {
  connectorId: string;
  sources: PatchedSource[];
};

/**
 * Client for the backend Connector Overview API (`/api/v1/connectors`).
 * These endpoints are authorized for PM/Admin only server-side
 * (`@PreAuthorize("hasAnyRole('ADMIN', 'PM')")`) - callers outside those
 * roles will receive an `ApiError` with status 403. Business errors
 * (unknown connector id, invalid batch) surface as `ApiError` with the
 * backend's `{ message }` body.
 */
export const connectorService = {
  /**
   * Lists every registered connector (enabled or not), e.g. the GitHub
   * repository connector.
   */
  async listConnectors(): Promise<ConnectorDto[]> {
    return apiClient.fetch<ConnectorDto[]>("/api/v1/connectors");
  },

  /**
   * Globally enables or disables a connector.
   *
   * @param connectorId - Lowercase connector id (`^[a-z0-9-]+$`), e.g. "github".
   * @param enabled - Whether the connector should be enabled.
   */
  async setConnectorEnabled(
    connectorId: string,
    enabled: boolean,
  ): Promise<ConfigureConnectorResponse> {
    return apiClient.fetch<ConfigureConnectorResponse>(`/api/v1/connectors/${connectorId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled } satisfies ConfigureConnectorRequest),
    });
  },

  /**
   * Retrieves the in-scope sources (e.g. connected repositories) of a
   * connector, along with their current allow/deny state.
   *
   * @param connectorId - Lowercase connector id, e.g. "github".
   * @param projectId - When given, scopes the sources to that project (the
   *   backend `projectId` query param). Omit only for a genuinely global view;
   *   project-scoped screens must pass it, otherwise every project's sources
   *   are returned.
   */
  async getConnectorSources(
    connectorId: string,
    projectId?: string,
  ): Promise<GetSourcesOfConnectorResponse> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

    return apiClient.fetch<GetSourcesOfConnectorResponse>(
      `/api/v1/connectors/${connectorId}/sources${query}`,
    );
  },

  /**
   * Batch-updates the allow/deny (enabled) state of one or more sources
   * for a connector. The backend synchronizes the change to the AI
   * service asynchronously; this call resolves once that hand-off
   * completes.
   *
   * @param connectorId - Lowercase connector id, e.g. "github".
   * @param sources - The sources to patch; must be non-empty.
   */
  async patchConnectorSources(
    connectorId: string,
    sources: PatchSourceRequest[],
  ): Promise<PatchSourcesOfConnectorResponse> {
    return apiClient.fetch<PatchSourcesOfConnectorResponse>(
      `/api/v1/connectors/${connectorId}/sources/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ sources } satisfies PatchSourcesRequest),
      },
    );
  },
};
