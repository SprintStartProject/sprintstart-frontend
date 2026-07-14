import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { insightsService } from '../../../src/services/faqService';
import { server } from '../../unit/setup/vitest.setup';

describe('faqService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchFAQGroups', () => {
        it('returns the backend FAQ overview on success', async () => {
            const overview = {
                totalQuestions: 5,
                groups: [{ id: 'g1', title: 'Group 1', questionCount: 3 }],
            };
            server.use(
                http.get('/api/v1/insights/faq', () => HttpResponse.json(overview)),
            );

            const result = await insightsService.fetchFAQGroups();

            expect(result).toEqual(overview);
        });

        it('returns mock fallback data on error', async () => {
            server.use(
                http.get('/api/v1/insights/faq', () => HttpResponse.json({}, { status: 500 })),
            );

            const result = await insightsService.fetchFAQGroups();

            expect(result).toBeDefined();
            expect(Array.isArray((result as { groups: unknown[] }).groups)).toBe(true);
        });
    });

    describe('fetchFAQGroup', () => {
        it('returns the backend FAQ detail on success', async () => {
            const detail = {
                id: 'g1',
                title: 'Group 1',
                questions: [{ id: 'q1', question: 'Why?' }],
                documents: [],
            };
            server.use(
                http.get('/api/v1/insights/faq/g1', () => HttpResponse.json(detail)),
            );

            const result = await insightsService.fetchFAQGroup('g1');

            expect(result).toEqual(detail);
        });

        it('returns mock fallback data on error', async () => {
            server.use(
                http.get('/api/v1/insights/faq/g1', () => HttpResponse.json({}, { status: 500 })),
            );

            const result = await insightsService.fetchFAQGroup('g1');

            expect(result).toBeDefined();
            expect((result as { groupId: string }).groupId).toBeDefined();
        });
    });
});
