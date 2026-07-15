import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { getIngestionRuns, getIngestionStatus } from '../../../src/services/ingestionService';
import { server } from '../../unit/setup/vitest.setup';

describe('ingestionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getIngestionRuns', () => {
        it('maps canonical run responses to IngestionRun objects', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', ({ request }) => {
                    const url = new URL(request.url);
                    expect(url.searchParams.get('limit')).toBe('50');
                    return HttpResponse.json([
                        {
                            runId: 'r1',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            ingestedCount: 10,
                            updatedCount: 2,
                            failedCount: 0,
                            failedItems: [],
                            status: 'COMPLETED',
                            aiSyncStatus: 'SUCCEEDED',
                            aiSyncFailureReason: null,
                        },
                    ]);
                }),
            );

            const runs = await getIngestionRuns();

            expect(runs).toHaveLength(1);
            expect(runs[0]).toEqual({
                runId: 'r1',
                sourceSystem: 'GITHUB',
                startedAt: '2026-07-01T00:00:00Z',
                finishedAt: '2026-07-01T01:00:00Z',
                ingestedCount: 10,
                updatedCount: 2,
                failedCount: 0,
                status: 'COMPLETED',
                failedItems: [],
                aiSyncStatus: 'SUCCEEDED',
                aiSyncFailureReason: null,
            });
        });

        it('defaults aiSyncStatus to NOT_APPLICABLE when the backend omits it', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r1b',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            status: 'COMPLETED',
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();

            expect(runs[0].aiSyncStatus).toBe('NOT_APPLICABLE');
            expect(runs[0].aiSyncFailureReason).toBeNull();
        });

        it('normalizes SUCCESS status to COMPLETED', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r2',
                            sourceSystem: 'JIRA',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            status: 'SUCCESS',
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].status).toBe('COMPLETED');
        });

        it('infers RUNNING when status is missing and no finishedAt', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r3',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: null,
                            status: null,
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].status).toBe('RUNNING');
        });

        it('infers FAILED when finishedAt is present and failedCount > 0', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r4',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            failedCount: 3,
                            status: null,
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].status).toBe('FAILED');
            expect(runs[0].failedCount).toBe(3);
        });

        it('infers FAILED when failedItems are present even with failedCount 0', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r5',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            failedCount: 0,
                            failedItems: [
                                { sourceId: 's1', artifactType: 'COMMIT', sourceUrl: null, reason: 'boom' },
                            ],
                            status: null,
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].status).toBe('FAILED');
            expect(runs[0].failedItems[0].artifactIdentifier).toBe('COMMIT: s1');
        });

        it('infers COMPLETED when finishedAt present and no failures', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r6',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            failedCount: 0,
                            failedItems: [],
                            status: null,
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].status).toBe('COMPLETED');
        });

        it('clamps the limit to 1..100 and truncates to integer', async () => {
            let capturedLimit: string | null = null;
            server.use(
                http.get('/api/v1/ingestion-runs', ({ request }) => {
                    capturedLimit = new URL(request.url).searchParams.get('limit');
                    return HttpResponse.json([]);
                }),
            );

            await getIngestionRuns(0);
            expect(capturedLimit).toBe('1');

            await getIngestionRuns(500);
            expect(capturedLimit).toBe('100');

            await getIngestionRuns(12.7);
            expect(capturedLimit).toBe('12');
        });

        it('maps failed artifacts using sourceId first, then sourceUrl, then fallback', async () => {
            server.use(
                http.get('/api/v1/ingestion-runs', () =>
                    HttpResponse.json([
                        {
                            runId: 'r7',
                            sourceSystem: 'GITHUB',
                            startedAt: '2026-07-01T00:00:00Z',
                            finishedAt: '2026-07-01T01:00:00Z',
                            failedItems: [
                                { sourceId: null, artifactType: 'FILE', sourceUrl: 'http://x/y', reason: 'err' },
                                { sourceId: null, artifactType: 'ISSUE', sourceUrl: null, reason: 'err2' },
                            ],
                            status: 'FAILED',
                        },
                    ]),
                ),
            );

            const runs = await getIngestionRuns();
            expect(runs[0].failedItems[0].artifactIdentifier).toBe('FILE: http://x/y');
            expect(runs[0].failedItems[1].artifactIdentifier).toBe('ISSUE: Unknown artifact');
        });
    });

    describe('getIngestionStatus', () => {
        it('maps canonical status responses to SourceIngestionStatus objects', async () => {
            server.use(
                http.get('/api/v1/ingestion-status', () =>
                    HttpResponse.json([
                        {
                            sourceSystem: 'GITHUB',
                            lastRunTime: '2026-07-01T00:00:00Z',
                            ingestedCount: 5,
                            updatedCount: 1,
                            failedCount: 0,
                            failedItems: [],
                            status: 'COMPLETED',
                        },
                    ]),
                ),
            );

            const statuses = await getIngestionStatus();
            expect(statuses).toHaveLength(1);
            expect(statuses[0].sourceSystem).toBe('GITHUB');
            expect(statuses[0].status).toBe('COMPLETED');
            expect(statuses[0].failedCount).toBe(0);
        });

        it('defaults counts to 0 when missing and nullifies unknown status', async () => {
            server.use(
                http.get('/api/v1/ingestion-status', () =>
                    HttpResponse.json([
                        {
                            sourceSystem: 'JIRA',
                            lastRunTime: null,
                            failedItems: [
                                { sourceId: 's1', artifactType: 'PULL_REQUEST', sourceUrl: null, reason: 'boom' },
                            ],
                        },
                    ]),
                ),
            );

            const statuses = await getIngestionStatus();
            expect(statuses[0].ingestedCount).toBe(0);
            expect(statuses[0].updatedCount).toBe(0);
            expect(statuses[0].failedCount).toBe(1);
            expect(statuses[0].status).toBeNull();
            expect(statuses[0].lastRunTime).toBeNull();
            expect(statuses[0].failedItems).toHaveLength(1);
        });
    });
});
