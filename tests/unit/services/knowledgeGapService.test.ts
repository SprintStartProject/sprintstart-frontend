import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { knowledgeGapService } from '../../../src/services/knowledgeGapService';
import { server } from '../../unit/setup/vitest.setup';

describe('knowledgeGapService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchKnowledgeGaps', () => {
        it('returns the backend overview on success', async () => {
            const overview = {
                totalGaps: 3,
                severitySummary: { high: 1, medium: 1, low: 1 },
                gaps: [{ id: 'g1', title: 'Gap 1', severity: 'high' }],
            };
            server.use(
                http.get('/api/v1/insights/knowledge-gaps', () => HttpResponse.json(overview)),
            );

            const result = await knowledgeGapService.fetchKnowledgeGaps();

            expect(result).toEqual(overview);
        });

        it('returns mock fallback data on non-404 errors', async () => {
            server.use(
                http.get('/api/v1/insights/knowledge-gaps', () => HttpResponse.json({}, { status: 500 })),
            );

            const result = await knowledgeGapService.fetchKnowledgeGaps();

            expect(result).toBeDefined();
            expect(result.gaps).toBeInstanceOf(Array);
        });

        it('returns mock fallback data silently on 404', async () => {
            server.use(
                http.get('/api/v1/insights/knowledge-gaps', () => new HttpResponse(null, { status: 404 })),
            );

            const result = await knowledgeGapService.fetchKnowledgeGaps();

            expect(result).toBeDefined();
        });
    });

    describe('fetchKnowledgeGap', () => {
        it('returns the backend gap detail on success', async () => {
            const detail = { id: 'g1', title: 'Gap 1', severity: 'high', missingTypes: [] };
            server.use(
                http.get('/api/v1/insights/knowledge-gaps/g1', () => HttpResponse.json(detail)),
            );

            const result = await knowledgeGapService.fetchKnowledgeGap('g1');

            expect(result).toEqual(detail);
        });

        it('returns mock fallback data on 404', async () => {
            server.use(
                http.get('/api/v1/insights/knowledge-gaps/missing', () => new HttpResponse(null, { status: 404 })),
            );

            const result = await knowledgeGapService.fetchKnowledgeGap('missing');

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('returns mock fallback data on 500 errors', async () => {
            server.use(
                http.get('/api/v1/insights/knowledge-gaps/g2', () => HttpResponse.json({}, { status: 500 })),
            );

            const result = await knowledgeGapService.fetchKnowledgeGap('g2');

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });
    });
});
