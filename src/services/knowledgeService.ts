import { apiClient, ApiError } from "./apiClient";
import { parseSSEStream } from "./sse";
import { userService } from "./userService";
import keycloak from "../config/keycloak";
import type {
  Artifact,
  ArtifactAiStatusResponse,
  ArtifactContent,
  ArtifactFacets,
  ArtifactPage,
  DeleteUploadsResult,
  KnowledgeListParams,
  SummaryStreamHandlers,
} from "../features/knowledge-base/types";

/**
 * SSE event shape emitted by the artifact summary streaming endpoint.
 *
 * Discriminated union on `type` so the dispatcher can narrow without per-field
 * `undefined` checks, and callers get exhaustiveness checking.
 */
type SummaryStreamEvent =
  | { type: "stage"; name: string; detail: string }
  | { type: "token"; content: string }
  | { type: "citation"; artifactId: string; filename: string; sourceUrl: string | null }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Per-file upload result returned by the backend batch upload endpoint.
 */
type UploadResponseItem = {
  filename: string;
  status: "success" | "failed";
  error?: string;
};

/**
 * Serialises the *filter* half of {@link KnowledgeListParams} — the part the list and the facets
 * endpoints share. One builder for both calls is the parity guarantee: a filter added here reaches
 * the counts and the rows alike, so a facet can never promise "12" for a list that shows 30.
 * Sets are repeated params (`types=A&types=B`), which is how Spring binds a `List` parameter.
 */
function buildFilterQuery(params: KnowledgeListParams): URLSearchParams {
  const query = new URLSearchParams();
  const search = params.search?.trim();
  if (search) query.set("search", search);
  for (const type of params.types ?? []) query.append("types", type);
  for (const source of params.sources ?? []) query.append("sources", source);
  for (const repository of params.repositories ?? []) query.append("repositories", repository);
  if (params.format) query.set("format", params.format);
  for (const language of params.languages ?? []) query.append("languages", language);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return query;
}

/** Reason recorded for an id the backend answered for in neither list. */
const UNCONFIRMED_DELETE = "The server did not confirm this deletion.";

/**
 * Normalises a delete answer. No `deletedIds`/`failed` at all is the old
 * backend's empty 204: every requested id is taken as deleted.
 */
function readDeleteOutcome(
  requested: readonly string[],
  body: Partial<DeleteUploadsResult> | undefined,
): DeleteUploadsResult {
  if (!body || (!Array.isArray(body.deletedIds) && !Array.isArray(body.failed))) {
    return { deletedIds: [...requested], failed: [] };
  }
  const failed = body.failed ?? [];
  const deleted = new Set(body.deletedIds ?? []);
  const answered = new Set([...deleted, ...failed.map((item) => item.artifactId)]);
  const unconfirmed = requested
    .filter((id) => !answered.has(id))
    .map((artifactId) => ({ artifactId, error: UNCONFIRMED_DELETE }));
  return {
    deletedIds: requested.filter((id) => deleted.has(id)),
    failed: [...failed, ...unconfirmed],
  };
}

export const knowledgeService = {
  /**
   * Whether the project has anything ingested at all -- what an onboarding path is built from.
   *
   * Throws when the question cannot be answered, rather than reporting "empty": a failed request
   * and an empty project are different statements, and callers deciding whether to hide the
   * onboarding entry treat them differently.
   *
   * @param projectId UUID of the project.
   */
  async hasIngestedContent(projectId: string): Promise<boolean> {
    const response = await apiClient.fetch<{ items?: Artifact[] }>(
      `/api/v1/projects/${projectId}/artifacts?page=1&size=1`,
    );

    return (response.items?.length ?? 0) > 0;
  },

  /**
   * Fetches a single short page of project artifacts for at-a-glance views
   * such as the dashboard widget.
   *
   * Deliberately separate from {@link knowledgeService.getArtifactPage}: a
   * preview card wants the newest handful of rows and nothing else, so it must
   * not drag facet counts or a full page size along with it.
   *
   * @param projectId UUID of the project to scope the listing.
   * @param limit Maximum number of artifacts to return.
   * @returns The first page of artifacts, or an empty array on failure.
   */
  async getRecentArtifacts(projectId: string, limit = 4): Promise<Artifact[]> {
    try {
      const response = await apiClient.fetch<{ items?: Artifact[] }>(
        `/api/v1/projects/${projectId}/artifacts?page=1&size=${limit}`,
      );

      return response.items ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Fetches a paginated, server-side filtered page of artifacts for a project.
   *
   * @param projectId UUID of the project.
   * @param params Filter criteria (see `buildFilterQuery`) plus the list-only page, size and sort.
   */
  async getArtifactPage(
    projectId: string,
    params: KnowledgeListParams = {},
  ): Promise<ArtifactPage> {
    const query = buildFilterQuery(params);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.size !== undefined) query.set("size", String(params.size));
    // List-only: order changes which rows a page holds, never how many match.
    if (params.sort) query.set("sort", params.sort);

    const queryString = query.toString();
    const endpoint = `/api/v1/projects/${projectId}/artifacts${queryString ? `?${queryString}` : ""}`;
    return apiClient.fetch<ArtifactPage>(endpoint);
  },

  /**
   * Fetches faceted counts for artifact types, source systems, upload formats, repositories and
   * languages.
   *
   * Sends exactly the filter criteria the list sends (see `buildFilterQuery`) and nothing of its
   * paging or order: `page`, `size` and `sort` are ignored even when present in `params`, because
   * a count must not depend on which page is on screen or how it is ordered.
   *
   * @param projectId UUID of the project.
   * @param params Active filter criteria to calculate dynamic facet counts.
   */
  async getArtifactFacets(
    projectId: string,
    params: KnowledgeListParams = {},
  ): Promise<ArtifactFacets> {
    const queryString = buildFilterQuery(params).toString();
    const endpoint = `/api/v1/projects/${projectId}/artifacts/facets${queryString ? `?${queryString}` : ""}`;
    return apiClient.fetch<ArtifactFacets>(endpoint);
  },

  /**
   * Fetches the AI assistant's index status for a batch of artifacts (at most 100, the backend's
   * cap and the largest page size, so one visible page is always one request).
   *
   * An empty `ids` list resolves locally without a request. A response without `aiAvailable`
   * (older backend) is read as unavailable, so no status is ever guessed.
   *
   * @param projectId UUID of the project.
   * @param artifactIds Ingestion ids of the artifacts on screen.
   */
  async getArtifactAiStatus(
    projectId: string,
    artifactIds: readonly string[],
  ): Promise<ArtifactAiStatusResponse> {
    if (artifactIds.length === 0) return { aiAvailable: true, items: [] };
    const query = new URLSearchParams();
    artifactIds.forEach((id) => query.append("ids", id));
    const body = await apiClient.fetch<Partial<ArtifactAiStatusResponse>>(
      `/api/v1/projects/${projectId}/artifacts/ai-status?${query.toString()}`,
    );
    return { aiAvailable: body?.aiAvailable === true, items: body?.items ?? [] };
  },

  /**
   * Fetches metadata for a single artifact by ID within a project.
   *
   * @param projectId UUID of the project.
   * @param artifactId UUID of the artifact.
   */
  async getArtifactById(projectId: string, artifactId: string): Promise<Artifact> {
    return apiClient.fetch<Artifact>(`/api/v1/projects/${projectId}/artifacts/${artifactId}`);
  },

  /**
   * Fetches the raw content of a specific artifact.
   *
   * Bypasses `apiClient.fetch` (which JSON-parses) because the backend returns
   * raw bytes with a `Content-Type` header, not a JSON envelope.
   *
   * @param projectId UUID of the project that scopes the artifact.
   * @param artifactId UUID of the artifact whose content should be retrieved.
   * @returns The raw content text and its effective mime type.
   */
  async getArtifactContent(
    projectId: string,
    artifactId: string,
    _sourceSystem: string = "GITHUB",
  ): Promise<ArtifactContent> {
    try {
      if (keycloak.authenticated) {
        await keycloak.updateToken(30);
      }
    } catch (error) {
      console.error("Failed to refresh Keycloak token for artifact content", error);
      void keycloak.login();
      throw new Error("Authentication required");
    }

    const endpoint = `/api/v1/projects/${projectId}/artifacts/${artifactId}/content`;

    const response = await fetch(endpoint, {
      headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
    });

    if (response.status === 401) {
      void keycloak.login();
      throw new ApiError(401, "Unauthorized");
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new ApiError(response.status, errorBody || response.statusText);
    }

    const mimeType = response.headers.get("Content-Type") ?? "text/plain";

    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      const blob = await response.blob();
      const content = URL.createObjectURL(blob);
      return { content, mimeType, isObjectUrl: true };
    }

    const content = await response.text();

    return { content, mimeType };
  },

  /**
   * Streams an AI-generated summary for a specific artifact over Server-Sent Events.
   *
   * Bypasses `apiClient.fetch` (which JSON-parses the whole body) because the backend
   * returns a `text/event-stream` of incremental `token`, `citation`, `done`, and
   * `error` events. The summary is rendered incrementally as tokens arrive, improving
   * perceived performance versus the previous blocking JSON response.
   *
   * @param projectId  UUID of the project to check access.
   * @param artifactId UUID of the artifact to summarize.
   * @param handlers   Callbacks invoked for each streamed event.
   * @param signal     Optional AbortSignal to cancel the in-flight stream.
   * @returns Resolves once the `done` event is received; rejects with {@link ApiError}
   * on a non-2xx HTTP response (e.g. 403, 404, 503 indexing) so callers can retry
   * based on `status`, or rejects with a plain `Error` on an in-stream `error` event
   * (non-retryable).
   */
  async streamArtifactSummary(
    projectId: string,
    artifactId: string,
    handlers: SummaryStreamHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      if (keycloak.authenticated) {
        await keycloak.updateToken(30);
      }
    } catch (error) {
      console.error("Failed to refresh Keycloak token for artifact summary stream", error);
      void keycloak.login();
      throw new Error("Authentication required");
    }

    const endpoint = `/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
      signal,
    });

    if (response.status === 401) {
      void keycloak.login();
      throw new ApiError(401, "Unauthorized");
    }

    if (response.status === 503) {
      throw new ApiError(
        503,
        "Artifact is still being indexed by the AI service. Please try again in a few moments.",
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new ApiError(response.status, errorBody || response.statusText);
    }

    const stream = response.body;
    if (!stream) {
      throw new Error("No response stream");
    }

    try {
      for await (const event of parseSSEStream<SummaryStreamEvent>(stream)) {
        switch (event.type) {
          case "stage":
            handlers.onStage?.(event.name, event.detail);
            break;

          case "token":
            handlers.onToken(event.content);
            break;

          case "citation":
            handlers.onCitation({
              artifactId: event.artifactId,
              filename: event.filename,
              sourceUrl: event.sourceUrl,
            });
            break;

          case "done":
            handlers.onDone();
            return;

          case "error": {
            const message = event.message;
            handlers.onError?.(message);
            throw new Error(message);
          }
        }
      }
      // Fallback: ensure onDone is called when the stream ends without an explicit done event.
      handlers.onDone();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      if (error instanceof Error) throw error;
      throw new Error(String(error));
    }
  },

  /**
   * Deletes a batch of uploaded artifacts and reports what happened to each.
   *
   * Sends one multipart DELETE to `/api/v1/uploads` (`request` JSON part with
   * `artifactIds`, `removerId`, `projectId`). The backend answers 200 with
   * `{ deletedIds, failed }`; an older backend answers an empty 204, which is
   * read as "every requested id deleted" — that was its only success signal.
   *
   * An id the new shape reports in neither list is counted as failed: a
   * deletion nobody confirmed must not be shown as a success.
   *
   * @param uploadIds Upload UUIDs (`Artifact.sourceId`), not ingestion ids.
   * @throws ApiError on a non-2xx response; per-item failures do not throw.
   */
  async deleteUploads(
    projectId: string,
    uploadIds: readonly string[],
    removerId: string,
  ): Promise<DeleteUploadsResult> {
    const formData = new FormData();
    const requestPayload = { artifactIds: [...uploadIds], removerId, projectId };
    formData.append(
      "request",
      new Blob([JSON.stringify(requestPayload)], { type: "application/json" }),
    );

    const body = await apiClient.fetch<Partial<DeleteUploadsResult> | undefined>(
      `/api/v1/uploads`,
      { method: "DELETE", body: formData },
    );
    return readDeleteOutcome(uploadIds, body);
  },

  /**
   * Deletes a single uploaded artifact by its id.
   *
   * Delegates to {@link knowledgeService.deleteUploads} so the single and bulk
   * paths cannot drift, and throws when the backend reports this id as failed —
   * the batch endpoint answers 200 for per-item failures, which used to make a
   * failed single delete look like a success.
   *
   * Sends a multipart DELETE to `/api/v1/uploads` with a `request`
   * JSON part containing the artifactIds batch, the removerId (authenticated user)
   * and the projectId scope. The backend reads the deletion target(s)
   * from the body's `artifactIds` set.
   *
   * @remarks Permission: the backend requires `PM` or `ADMIN`. The call is reached
   * from the Knowledge Base page, whose `/knowledge-base` route is open to every
   * group, so the page carries its own `DELETE_ALLOWED_GROUPS` gate mirroring the
   * backend rule -- the delete action stays hidden from the remaining groups
   * instead of handing them a button that returns 403.
   *
   * @param projectId  UUID of the project that scopes the deletion.
   * @param artifactId UUID of the uploaded artifact to remove.
   * @param removerId  UUID of the authenticated user requesting the deletion.
   *   Sent for symmetry with the upload contract, but ignored by the backend,
   *   which resolves the remover from the JWT subject.
   * @throws ApiError on a non-2xx response (e.g. 403 if the caller lacks access
   *   to the supplied projectId, 404 if the artifact does not exist).
   * @throws Error carrying the backend's reason when the id is in `failed`.
   */
  async deleteUpload(projectId: string, artifactId: string, removerId: string): Promise<void> {
    const { failed } = await knowledgeService.deleteUploads(projectId, [artifactId], removerId);
    const failure = failed.find((item) => item.artifactId === artifactId);
    if (failure) throw new Error(failure.error);
  },

  /**
   * Uploads an array of files sequentially to the backend ingestion service.
   *
   * @param projectId UUID of the project.
   * @param files Array of physical File objects selected by the user.
   * @returns Array of results indicating success or failure per file.
   */
  async uploadDocuments(
    projectId: string,
    files: File[],
  ): Promise<{ filename: string; status: "success" | "error"; error?: string }[]> {
    if (files.length === 0) return [];

    const profile = await userService.getProfile();
    if (!profile) {
      throw new Error("Could not retrieve backend user profile for upload.");
    }

    const uploaderId = profile.id;
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const requestPayload = {
      projectId,
      uploaderId,
    };
    formData.append(
      "request",
      new Blob([JSON.stringify(requestPayload)], { type: "application/json" }),
    );

    try {
      const uploadResults = await apiClient.fetch<UploadResponseItem[]>(`/api/v1/uploads`, {
        method: "POST",
        body: formData,
      });

      return uploadResults.map(
        (res): { filename: string; status: "success" | "error"; error?: string } => ({
          filename: String(res.filename),
          status: res.status === "failed" ? "error" : "success",
          error: res.error ? String(res.error) : undefined,
        }),
      );
    } catch (error) {
      console.error("Failed to upload file batch:", error);
      return files.map((file) => ({
        filename: file.name,
        status: "error" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  },
};
