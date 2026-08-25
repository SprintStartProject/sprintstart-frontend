import { apiClient, ApiError } from "./apiClient";
import { parseSSEStream } from "./sse";
import { userService } from "./userService";
import keycloak from "../config/keycloak";
import type {
  Artifact,
  ArtifactContent,
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

export const knowledgeService = {
  /**
   * Whether the project has anything ingested yet.
   *
   * Asks for a single artifact rather than counting: the caller only needs to
   * know whether the set is empty.
   *
   * Deliberately lets failures propagate, unlike `getRecentArtifacts`, which
   * returns `[]` on error. Callers use this to decide whether to *hide* UI, and
   * a swallowed error would make a brief outage indistinguishable from an empty
   * project — quietly removing navigation that should be there. An error must
   * stay tellable apart from a genuine "nothing here".
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
   * Deliberately separate from {@link knowledgeService.getUnifiedArtifacts},
   * which pages through the entire project and additionally merges personal
   * uploads — far more work than a preview card needs.
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
   * Fetches all unified artifacts for a specific project.
   *
   * @param projectId UUID of the project to scope the artifact listing.
   * @returns List of project-scoped artifacts.
   * @throws ApiError when the backend request fails so callers can distinguish
   *   between an empty project and a failed fetch.
   */
  async getUnifiedArtifacts(projectId: string): Promise<Artifact[]> {
    let artifacts: Artifact[] = [];

    interface PageResponse {
      items: Artifact[];
      page: {
        totalPages: number;
      };
    }

    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const response = await apiClient.fetch<PageResponse>(
        `/api/v1/projects/${projectId}/artifacts?page=${currentPage}&size=100`,
      );
      artifacts = [...artifacts, ...(response.items || [])];
      totalPages = response.page?.totalPages ?? 1;
      currentPage++;
    }

    return artifacts;
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
   * Deletes a single uploaded artifact by its id.
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
   */
  async deleteUpload(projectId: string, artifactId: string, removerId: string): Promise<void> {
    const formData = new FormData();
    const requestPayload = {
      artifactIds: [artifactId],
      removerId,
      projectId,
    };
    formData.append(
      "request",
      new Blob([JSON.stringify(requestPayload)], { type: "application/json" }),
    );

    await apiClient.fetch<void>(`/api/v1/uploads`, {
      method: "DELETE",
      body: formData,
    });
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
