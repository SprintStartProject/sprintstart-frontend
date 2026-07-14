import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { knowledgeService } from '../../../src/services/knowledgeService';
import { DocumentStatus } from '../../../src/services/types';
import { server } from '../../unit/setup/vitest.setup';

describe('knowledgeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchDocuments', () => {
        it('maps backend documents to DocumentMetadata with COMPLETED status', async () => {
            server.use(
                http.get('/api/v1/uploads', ({ request }) => {
                    const url = new URL(request.url);
                    expect(url.searchParams.get('uploaderId')).toBe('user1');
                    return HttpResponse.json([
                        { id: 'd1', filename: 'doc.pdf', mime: 'application/pdf', uploadedAt: '2026-07-01T00:00:00Z' },
                        { id: 'd2', filename: 'notes.md', mime: 'text/markdown', uploadedAt: '2026-07-02T00:00:00Z' },
                    ]);
                }),
            );

            const docs = await knowledgeService.fetchDocuments('user1');

            expect(docs).toHaveLength(2);
            expect(docs[0]).toEqual({
                id: 'd1',
                name: 'doc.pdf',
                mime: 'application/pdf',
                status: DocumentStatus.COMPLETED,
                uploadDate: '2026-07-01T00:00:00Z',
            });
            expect(docs[1].name).toBe('notes.md');
        });

        it('returns an empty array when the backend fails', async () => {
            server.use(http.get('/api/v1/uploads', () => HttpResponse.json({}, { status: 500 })));

            const docs = await knowledgeService.fetchDocuments('user1');
            expect(docs).toEqual([]);
        });
    });

    describe('uploadDocuments', () => {
        it('uploads files and returns their results', async () => {
            server.use(
                http.post('/api/v1/uploads', ({ request }) => {
                    const url = new URL(request.url);
                    expect(url.searchParams.get('uploaderId')).toBe('user1');
                    return HttpResponse.json([{ id: 'up1', filename: 'a.txt', status: 'ok' }]);
                }),
            );

            const file = new File(['content'], 'a.txt', { type: 'text/plain' });
            const results = await knowledgeService.uploadDocuments([file], 'user1');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ id: 'up1', filename: 'a.txt', status: 'ok' });
        });

        it('captures a failed upload as a failed UploadResult', async () => {
            server.use(http.post('/api/v1/uploads', () => HttpResponse.json({}, { status: 500 })));

            const file = new File(['content'], 'bad.txt', { type: 'text/plain' });
            const results = await knowledgeService.uploadDocuments([file], 'user1');

            expect(results).toHaveLength(1);
            expect(results[0].status).toBe('failed');
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
            const results = await knowledgeService.uploadDocuments([goodFile, badFile], 'user1');

            expect(results).toHaveLength(2);
            expect(results[0].status).toBe('ok');
            expect(results[1].status).toBe('failed');
        });
    });

    describe('deleteDocument', () => {
        it('sends a DELETE request for the given id', async () => {
            let capturedId: string | null = null;
            server.use(
                http.delete('/api/v1/uploads/:id', ({ params }) => {
                    capturedId = params.id as string;
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            await knowledgeService.deleteDocument('doc-42');
            expect(capturedId).toBe('doc-42');
        });

        it('rejects when the backend returns a non-OK status', async () => {
            server.use(http.delete('/api/v1/uploads/:id', () => new HttpResponse(null, { status: 404 })));

            await expect(knowledgeService.deleteDocument('missing')).rejects.toMatchObject({
                name: 'ApiError',
                status: 404,
            });
        });
    });
});
