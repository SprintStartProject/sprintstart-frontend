import { apiClient, ApiError } from './apiClient';
import { parseSSEStream } from './sse';
import { userService } from './userService';
import keycloak from '../config/keycloak';
import type { Artifact, ArtifactContent, SummaryStreamHandlers } from '../features/knowledge-base/types';

/**
 * SSE event shape emitted by the artifact summary streaming endpoint.
 *
 * Discriminated union on `type` so the dispatcher can narrow without per-field
 * `undefined` checks, and callers get exhaustiveness checking.
 */
type SummaryStreamEvent =
    | { type: 'stage'; name: string; detail: string }
    | { type: 'token'; content: string }
    | { type: 'citation'; artifactId: string; filename: string; sourceUrl: string | null }
    | { type: 'done' }
    | { type: 'error'; message: string };

/**
 * Per-file upload result returned by the backend batch upload endpoint.
 */
type UploadResponseItem = {
    filename: string;
    status: 'success' | 'failed';
    error?: string;
};

/**
 * Knowledge base — project artifact listing, content retrieval, uploads and
 * AI-powered streaming summaries. Upload methods accept File[] and report
 * per-file status. SSE methods use parseSSEStream.
 */
export const knowledgeService = {
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
 * Fetches recent artifacts for at-a-glance views (e.g. dashboard widget).
 * Returns a short page; errors return an empty array silently.
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
     * Fetches all unified artifacts for a specific project, merged with the
     * authenticated user's personal uploads (mapped into the same Artifact shape).
     *
     * @param projectId UUID of the project to scope the artifact listing.
     * @returns Merged list of project-scoped artifacts and the user's uploads.
     *
     * @remarks Failure behavior: both downstream endpoints are best-effort. If the
     * project artifacts endpoint or the personal-uploads endpoint fails, the error
     * is logged via `console.warn` and the function returns whatever it could fetch
     * (possibly an empty array) rather than throwing. This keeps the KB page usable
     * while the ingestion service is still being rolled out.
     *
     * @remarks Known limitation: uploads are de-duplicated against project artifacts
     * by `title` (filename) because the backend does not yet return `sourceId` for
     * ingested artifacts. Two unrelated uploads sharing a filename will collide.
     */
    async getUnifiedArtifacts(projectId: string): Promise<Artifact[]> {
        let artifacts: Artifact[] = [];

        try {
            interface PageResponse {
                items: Artifact[];
                page: {
                    totalPages: number;
                };
            }
            
            let currentPage = 1;
            let totalPages = 1;
            
            while (currentPage <= totalPages) {
                const response = await apiClient.fetch<PageResponse>(`/api/v1/projects/${projectId}/artifacts?page=${currentPage}&size=100`);
                artifacts = [...artifacts, ...(response.items || [])];
                totalPages = response.page?.totalPages || 1;
                currentPage++;
            }
        } catch (e) {
            console.warn("Unified artifacts endpoint failed (expected if missing), continuing...", e);
        }

        // Personal uploads are now fetched via the unified project artifacts
        // endpoint above (the backend's GET /api/v1/uploads was changed to
        // require a projectId query param and use JWT auth instead of the old
        // uploaderId param, so the separate uploads fetch was removed).

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
    async getArtifactContent(projectId: string, artifactId: string, _sourceSystem: string = 'GITHUB'): Promise<ArtifactContent> {
        try {
            if (keycloak.authenticated) {
                await keycloak.updateToken(30);
            }
        } catch (error) {
            console.error('Failed to refresh Keycloak token for artifact content', error);
            void keycloak.login();
            throw new Error('Authentication required');
        }

        const endpoint = `/api/v1/projects/${projectId}/artifacts/${artifactId}/content`;

        const response = await fetch(endpoint, {
            headers: keycloak.token ? { 'Authorization': `Bearer ${keycloak.token}` } : {},
        });

        if (response.status === 401) {
            void keycloak.login();
            throw new ApiError(401, 'Unauthorized');
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            throw new ApiError(response.status, errorBody || response.statusText);
        }

        const mimeType = response.headers.get('Content-Type') ?? 'text/plain';

        if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
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
    async streamArtifactSummary(projectId: string, artifactId: string, handlers: SummaryStreamHandlers, signal?: AbortSignal): Promise<void> {
        try {
            if (keycloak.authenticated) {
                await keycloak.updateToken(30);
            }
        } catch (error) {
            console.error('Failed to refresh Keycloak token for artifact summary stream', error);
            void keycloak.login();
            throw new Error('Authentication required');
        }

        const endpoint = `/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: keycloak.token ? { 'Authorization': `Bearer ${keycloak.token}` } : {},
            signal,
        });

        if (response.status === 401) {
            void keycloak.login();
            throw new ApiError(401, 'Unauthorized');
        }

        if (response.status === 503) {
            throw new ApiError(503, 'Artifact is still being indexed by the AI service. Please try again in a few moments.');
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            throw new ApiError(response.status, errorBody || response.statusText);
        }

        const stream = response.body;
        if (!stream) {
            throw new Error('No response stream');
        }

        try {
            for await (const event of parseSSEStream<SummaryStreamEvent>(stream)) {
                switch (event.type) {
                    case 'stage':
                        handlers.onStage?.(event.name, event.detail);
                        break;

                    case 'token':
                        handlers.onToken(event.content);
                        break;

                    case 'citation':
                        handlers.onCitation({
                            artifactId: event.artifactId,
                            filename: event.filename,
                            sourceUrl: event.sourceUrl,
                        });
                        break;

                    case 'done':
                        handlers.onDone();
                        return;

                    case 'error': {
                        const message = event.message;
                        handlers.onError?.(message);
                        throw new Error(message);
                    }
                }
            }
            // Fallback: ensure onDone is called when the stream ends without an explicit done event.
            handlers.onDone();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            if (error instanceof Error) throw error;
            throw new Error(String(error));
        }
    },

    /**
     * Deletes a single uploaded artifact by its id.
     *
     * Sends a multipart DELETE to `/api/v1/uploads/{artifactId}` with a `request`
     * JSON part containing the artifactIds batch, the removerId (authenticated user)
     * and the projectId scope. The backend mirrors the same multipart contract as
     * the upload endpoint — the path variable is captured for REST semantics but
     * the actual deletion target(s) are read from the body's `artifactIds` set.
     *
     * @remarks Permission: the backend currently allows any `USER` role. The
     * frontend gates this call to PM/HR/ADMIN via `accessPolicy` Pattern A.
     * Tightening the backend `@PreAuthorize` to `hasAnyRole('PM','HR','ADMIN')`
     * is tracked as a restricted backend follow-up.
     *
     * @param projectId  UUID of the project that scopes the deletion.
     * @param artifactId UUID of the uploaded artifact to remove.
     * @param removerId  UUID of the authenticated user requesting the deletion.
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
        formData.append('request', new Blob([JSON.stringify(requestPayload)], { type: 'application/json' }));

        await apiClient.fetch<void>(`/api/v1/uploads/${encodeURIComponent(artifactId)}`, {
            method: 'DELETE',
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
    async uploadDocuments(projectId: string, files: File[]): Promise<{ filename: string; status: 'success' | 'error'; error?: string }[]> {
        const results: { filename: string; status: 'success' | 'error'; error?: string }[] = [];

        const profile = await userService.getProfile();
        if (!profile) {
            throw new Error("Could not retrieve backend user profile for upload.");
        }

        const uploaderId = profile.id;

        for (const file of files) {
            const formData = new FormData();
            formData.append('files', file);

            const requestPayload = {
                projectId,
                uploaderId
            };
            formData.append('request', new Blob([JSON.stringify(requestPayload)], { type: 'application/json' }));

            try {
                const uploadResults = await apiClient.fetch<UploadResponseItem[]>(`/api/v1/uploads`, {
                    method: 'POST',
                    body: formData,
                });

                const mappedResults = uploadResults.map((res): { filename: string; status: 'success' | 'error'; error?: string } => ({
                    filename: String(res.filename),
                    status: res.status === 'failed' ? 'error' : 'success',
                    error: res.error ? String(res.error) : undefined
                }));
                results.push(...mappedResults);
            } catch (error) {
                console.error(`Failed to upload file ${file.name}:`, error);
                results.push({
                    filename: file.name,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }
};
