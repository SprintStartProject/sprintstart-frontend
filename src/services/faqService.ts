import { apiClient } from './apiClient';
import type {
    FAQOverview,
    FAQDetail,
} from '../features/faq/types';
import faqMock  from '../mocks/faqMock.json';
import faqDetailMock  from '../mocks/faqDetailMock.json';

/**
 * FAQ insights — recurring question clusters detected by AI.
 * Fetch methods fall back to mock data on failure; refresh propagates errors.
 */
export const insightsService = {

    /**
     * Fetches all recurring question groups sorted by frequency.
     */
    async fetchFAQGroups(): Promise<FAQOverview> {
        try {
            return await apiClient.fetch<FAQOverview>(
                '/api/v1/insights/faq'
            );
        } catch (_error) {
            return faqMock;
        }
    },

    /**
     * Fetches detailed information about a specific FAQ group.
     */
    async fetchFAQGroup(groupId: string): Promise<FAQDetail> {
        try {
            return await apiClient.fetch<FAQDetail>(
                `/api/v1/insights/faq/${groupId}`
            );
        } catch (error) {
            console.error(`Error fetching FAQ group with ID ${groupId}:`, error);
            return faqDetailMock;
        }
    },

    /**
     * Triggers the backend to (re)build the FAQ groups via the AI service.
     *
     * Unlike the fetch methods, this does not fall back to mock data: the caller
     * needs to know whether the refresh actually succeeded, so errors propagate.
     *
     * @returns The number of groups stored after the refresh.
     */
    async refreshFAQGroups(): Promise<{ groupCount: number }> {
        return await apiClient.fetch<{ groupCount: number }>(
            '/api/v1/insights/faq/refresh',
            { method: 'POST' }
        );
    },
};
