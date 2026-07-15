import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { knowledgeService } from '../../../src/services/knowledgeService';
import { server } from '../../unit/setup/vitest.setup';

vi.mock('../../../src/services/userService', () => ({
    userService: {
        getProfile: vi.fn().mockResolvedValue({ id: 'user1' })
    }
}));

describe('knowledgeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('uploadDocuments', () => {
        it('uploads files and returns their results', async () => {
            server.use(
                http.post('/api/v1/uploads', () => {
                    return HttpResponse.json([{ id: 'up1', filename: 'a.txt', status: 'ok' }]);
                }),
            );

            const file = new File(['content'], 'a.txt', { type: 'text/plain' });
            const results = await knowledgeService.uploadDocuments('p1', [file]);

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ filename: 'a.txt', status: 'success' });
        });

        it('captures a failed upload as a failed UploadResult', async () => {
            server.use(http.post('/api/v1/uploads', () => HttpResponse.json({}, { status: 500 })));

            const file = new File(['content'], 'bad.txt', { type: 'text/plain' });
            const results = await knowledgeService.uploadDocuments('p1', [file]);

            expect(results).toHaveLength(1);
            expect(results[0].status).toBe('error');
            expect(results[0].filename).toBe('bad.txt');
            expect(results[0].error).toBeTruthy();
        });

        it('uploads multiple files, aggregating success and failure results', async () => {
            let callCount = 0;
            server.use(
                http.post('/api/v1/uploads', () => {
                    callCount += 1;
                    if (callCount === 2) {
                        return HttpResponse.json({}, { status: 500 });
                    }
                    return HttpResponse.json([{ id: 'ok1', filename: 'good.txt', status: 'ok' }]);
                }),
            );

            const goodFile = new File(['a'], 'good.txt');
            const badFile = new File(['b'], 'bad.txt');
            const results = await knowledgeService.uploadDocuments('p1', [goodFile, badFile]);

            expect(results).toHaveLength(2);
            expect(results[0].status).toBe('success');
            expect(results[1].status).toBe('error');
        });
    });

    describe('streamArtifactSummary', () => {
        const projectId = 'project-uuid';
        const artifactId = 'artifact-uuid';

        function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
            const encoder = new TextEncoder();
            return new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                    controller.close();
                },
            });
        }

        it('invokes onToken/onCitation/onDone for token, citation, and done events', async () => {
            server.use(
                http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
                    new HttpResponse(
                        makeStream([
                            'data: {"type":"token","content":"## Key"}\n\n',
                            'data: {"type":"token","content":" points"}\n\n',
                            `data: {"type":"citation","artifactId":"${artifactId}","filename":"README.md","sourceUrl":"https://github.com/owner/repo/blob/main/README.md"}\n\n`,
                            'data: {"type":"done"}\n\n',
                        ]),
                        { headers: { 'Content-Type': 'text/event-stream' } },
                    ),
                ),
            );

            const onToken = vi.fn();
            const onCitation = vi.fn();
            const onDone = vi.fn();
            const onError = vi.fn();

            await knowledgeService.streamArtifactSummary(projectId, artifactId, { onToken, onCitation, onDone, onError });

            expect(onToken).toHaveBeenCalledTimes(2);
            expect(onToken).toHaveBeenNthCalledWith(1, '## Key');
            expect(onToken).toHaveBeenNthCalledWith(2, ' points');
            expect(onCitation).toHaveBeenCalledWith({
                artifactId,
                filename: 'README.md',
                sourceUrl: 'https://github.com/owner/repo/blob/main/README.md',
            });
            expect(onDone).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
        });

        it('rejects with ApiError on 503 so callers can retry on indexing', async () => {
            server.use(
                http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
                    HttpResponse.json({ detail: 'AI service unavailable' }, { status: 503 }),
                ),
            );

            await expect(
                knowledgeService.streamArtifactSummary(projectId, artifactId, {
                    onToken: vi.fn(),
                    onCitation: vi.fn(),
                    onDone: vi.fn(),
                }),
            ).rejects.toMatchObject({ name: 'ApiError', status: 503 });
        });

        it('rejects with ApiError on 404', async () => {
            server.use(
                http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
                    HttpResponse.json({ detail: 'Not found' }, { status: 404 }),
                ),
            );

            await expect(
                knowledgeService.streamArtifactSummary(projectId, artifactId, {
                    onToken: vi.fn(),
                    onCitation: vi.fn(),
                    onDone: vi.fn(),
                }),
            ).rejects.toMatchObject({ name: 'ApiError', status: 404 });
        });

        it('calls onError and rejects with a plain Error on in-stream error event', async () => {
            server.use(
                http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
                    new HttpResponse(
                        makeStream(['data: {"type":"error","message":"Model overload"}\n\n']),
                        { headers: { 'Content-Type': 'text/event-stream' } },
                    ),
                ),
            );

            const onError = vi.fn();

            await expect(
                knowledgeService.streamArtifactSummary(projectId, artifactId, {
                    onToken: vi.fn(),
                    onCitation: vi.fn(),
                    onDone: vi.fn(),
                    onError,
                }),
            ).rejects.toThrow('Model overload');

            expect(onError).toHaveBeenCalledWith('Model overload');
        });
    });
});

