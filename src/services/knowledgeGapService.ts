import { apiClient } from "./apiClient";
import type {
  KnowledgeGapOverview,
  KnowledgeGap,
  KnowledgeGapOwner,
} from "../features/knowledge-gaps/types";

/**
 * Knowledge gaps are detected and cached per project, so every call carries the
 * project it is asking about.
 *
 * Nothing here falls back to mock data. A fixture returned on failure is
 * indistinguishable from a real answer, so an unreachable backend rendered as a
 * project that simply had different gaps — and the panel's error state could
 * never be reached. Failures propagate; the caller decides what to show.
 */
export const knowledgeGapService = {
  async fetchKnowledgeGaps(projectId: string): Promise<KnowledgeGapOverview> {
    return await apiClient.fetch<KnowledgeGapOverview>(
      `/api/v1/insights/knowledge-gaps?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  async fetchKnowledgeGap(projectId: string, gapId: string): Promise<KnowledgeGap> {
    return await apiClient.fetch<KnowledgeGap>(
      `/api/v1/insights/knowledge-gaps/${gapId}?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Triggers the backend to (re)detect knowledge gaps via the AI service.
   *
   * Unlike the fetch methods, this does not fall back to mock data: the caller
   * needs to know whether the refresh actually succeeded, so errors propagate.
   *
   * @returns The number of gaps stored after the refresh.
   */
  async refreshKnowledgeGaps(projectId: string): Promise<{ gapCount: number }> {
    return await apiClient.fetch<{ gapCount: number }>(
      `/api/v1/insights/knowledge-gaps/refresh?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST" },
    );
  },

  /**
   * Returns the users currently assigned as owners of a component.
   */
  async getComponentOwners(projectId: string, component: string): Promise<KnowledgeGapOwner[]> {
    return await apiClient.fetch<KnowledgeGapOwner[]>(
      `/api/v1/insights/knowledge-gaps/component-owners` +
        `?projectId=${encodeURIComponent(projectId)}&component=${encodeURIComponent(component)}`,
    );
  },

  /**
   * Replaces the owners of a component and returns the resolved owners.
   */
  async setComponentOwners(
    projectId: string,
    component: string,
    userIds: string[],
  ): Promise<KnowledgeGapOwner[]> {
    return await apiClient.fetch<KnowledgeGapOwner[]>(
      `/api/v1/insights/knowledge-gaps/component-owners?projectId=${encodeURIComponent(projectId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ component, userIds }),
      },
    );
  },
};
