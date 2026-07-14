import { apiClient } from './apiClient';
import { ApiError } from './apiClient';
import type {
    KnowledgeGapOverview,
    KnowledgeGap,
    KnowledgeGapOwner
} from '../features/knowledge-gaps/types';

import knowledgeGapMock from '../mocks/knowledgeGapsMock.json';
import knowledgeGapDetailMock from '../mocks/knowledgeGapsDetailMock.json';

export const knowledgeGapService = {

    async fetchKnowledgeGaps(): Promise<KnowledgeGapOverview> {
        try {
            return await apiClient.fetch<KnowledgeGapOverview>(
                '/api/v1/insights/knowledge-gaps'
            );
        } catch (error) {
            if (!(error instanceof ApiError && error.status === 404)) {
                console.error('Error fetching knowledge gaps:', error);
            }

            return knowledgeGapMock as KnowledgeGapOverview;
        }
    },

    async fetchKnowledgeGap(gapId: string): Promise<KnowledgeGap> {
        try {
            return await apiClient.fetch<KnowledgeGap>(
                `/api/v1/insights/knowledge-gaps/${gapId}`
            );
        } catch (error) {
            if (!(error instanceof ApiError && error.status === 404)) {
                console.error(
                    `Error fetching knowledge gap with ID ${gapId}:`,
                    error
                );
            }

            return knowledgeGapDetailMock as KnowledgeGap;
        }
    },

    /**
     * Triggers the backend to (re)detect knowledge gaps via the AI service.
     *
     * Unlike the fetch methods, this does not fall back to mock data: the caller
     * needs to know whether the refresh actually succeeded, so errors propagate.
     *
     * @returns The number of gaps stored after the refresh.
     */
    async refreshKnowledgeGaps(): Promise<{ gapCount: number }> {
        return await apiClient.fetch<{ gapCount: number }>(
            '/api/v1/insights/knowledge-gaps/refresh',
            { method: 'POST' }
        );
    },

    /**
     * Returns the users currently assigned as owners of a component.
     */
    async getComponentOwners(component: string): Promise<KnowledgeGapOwner[]> {
        return await apiClient.fetch<KnowledgeGapOwner[]>(
            `/api/v1/insights/knowledge-gaps/component-owners?component=${encodeURIComponent(component)}`
        );
    },

    /**
     * Replaces the owners of a component and returns the resolved owners.
     */
    async setComponentOwners(
        component: string,
        userIds: string[]
    ): Promise<KnowledgeGapOwner[]> {
        return await apiClient.fetch<KnowledgeGapOwner[]>(
            '/api/v1/insights/knowledge-gaps/component-owners',
            {
                method: 'PUT',
                body: JSON.stringify({ component, userIds }),
            }
        );
    },
};
