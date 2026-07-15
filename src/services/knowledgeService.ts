import { apiClient, ApiError } from './apiClient';
import { userService } from './userService';
import keycloak from '../config/keycloak';
import type { Artifact, ArtifactContent, SummaryStreamHandlers } from '../features/knowledge-base/types';

/**
 * SSE event shape emitted by the artifact summary streaming endpoint.
 */
interface SummaryStreamEvent {
    type: 'token' | 'citation' | 'done' | 'error' | 'stage';
    content?: string;
    message?: string;
    name?: string;
    detail?: string;
    artifactId?: string;
    filename?: string;
    sourceUrl?: string | null;
}

/**
 * Service responsible for managing the knowledge base unified artifacts.
 */
interface UploadResponseItem {
    filename: string;
    status: string;
    error?: string;
}

export const knowledgeService = {
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

        try {
            const profile = await userService.getProfile();
            if (profile) {
                interface UploadListItemResponse {
                    id: string;
                    filename: string;
                    mime: string;
                    uploadedAt: string;
                }
                const uploads = await apiClient.fetch<UploadListItemResponse[]>(`/api/v1/uploads?uploaderId=${encodeURIComponent(profile.id)}`);

                const uploadArtifacts: Artifact[] = uploads.map(u => ({
                    id: u.id,
                    title: u.filename,
                    artifactType: 'FILE',
                    sourceSystem: 'UPLOAD',
                    sourceId: u.id,
                    sourceUrl: null,
                    mime: u.mime,
                    language: null,
                    ingestedAt: u.uploadedAt,
                    createdAtSource: null,
                    updatedAtSource: u.uploadedAt,
                    contentHash: null,
                    ingestionRunId: null,
                }));

                // Deduplicate using title (filename) as a temporary frontend workaround,
                // because the backend doesn't return sourceId for ingested artifacts yet.
                const existingTitles = new Set(artifacts.map(a => a.title));
                const uniqueUploads = uploadArtifacts.filter(a => !existingTitles.has(a.title));

                artifacts = [...artifacts, ...uniqueUploads];
            }
        } catch (e) {
            console.warn("Failed to fetch personal uploads", e);
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

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            throw new ApiError(response.status, errorBody || response.statusText);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response stream');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;

                    const payload = line.replace('data:', '').trim();
                    if (!payload) continue;

                    const event = JSON.parse(payload) as SummaryStreamEvent;

                    switch (event.type) {
                        case 'stage':
                            if (event.name && event.detail) {
                                handlers.onStage?.(event.name, event.detail);
                            }
                            break;

                        case 'token':
                            if (event.content !== undefined) {
                                handlers.onToken(event.content);
                            }
                            break;

                        case 'citation':
                            if (event.artifactId && event.filename) {
                                handlers.onCitation({
                                    artifactId: event.artifactId,
                                    filename: event.filename,
                                    sourceUrl: event.sourceUrl ?? null,
                                });
                            }
                            break;

                        case 'done':
                            handlers.onDone();
                            return;

                        case 'error': {
                            const message = event.message ?? 'Unknown error';
                            handlers.onError?.(message);
                            throw new Error(message);
                        }
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
