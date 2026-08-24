import { apiClient, ApiError } from "./apiClient";
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

  /**
   * Returns the gaps in a project whose component the signed-in user owns.
   *
   * Deliberately without the mock fallback the panel reads use. This answers "what is on
   * *you*", and a fixture standing in for that would put another user's components on the
   * dashboard and make the empty state — the normal case — unreachable. A failure stays a
   * failure, and the widget says so.
   *
   * The failure is logged here and rethrown, because `useFetch` reduces it to a boolean and
   * leaves the cause to the loader by contract. Without this line the widget can only say
   * "could not load" and there is nothing anywhere saying whether that was a 403 (not a
   * member of the project), a 404 (a backend without this endpoint) or a 400 (no project
   * selected) — which is exactly the hole this went missing down the first time.
   */
  async fetchMyKnowledgeGaps(projectId: string): Promise<KnowledgeGapOverview> {
    try {
      return await apiClient.fetch<KnowledgeGapOverview>(
        `/api/v1/insights/knowledge-gaps/mine?projectId=${encodeURIComponent(projectId)}`,
      );
    } catch (error) {
      const status = error instanceof ApiError ? String(error.status) : "no response";
      console.error(`Error fetching the knowledge gaps assigned to you (${status}):`, error);
      throw error;
    }
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
