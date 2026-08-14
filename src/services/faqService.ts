import { apiClient } from "./apiClient";
import type { FAQOverview, FAQDetail } from "../features/faq/types";
import faqMock from "../mocks/faqMock.json";
import faqDetailMock from "../mocks/faqDetailMock.json";

/**
 * FAQ insights are project-scoped: the groups are built from the questions asked in
 * one project's chats, so every call has to say which project it means.
 */
export const insightsService = {
  /**
   * Fetches all recurring question groups sorted by frequency.
   */
  async fetchFAQGroups(projectId: string): Promise<FAQOverview> {
    try {
      return await apiClient.fetch<FAQOverview>(
        `/api/v1/insights/faq?projectId=${encodeURIComponent(projectId)}`,
      );
    } catch (_error) {
      // Asserted rather than inferred: a JSON import widens the trend literals
      // to `string`, which no longer matches the union.
      return faqMock as FAQOverview;
    }
  },

  /**
   * Fetches detailed information about a specific FAQ group.
   */
  async fetchFAQGroup(projectId: string, groupId: string): Promise<FAQDetail> {
    try {
      return await apiClient.fetch<FAQDetail>(
        `/api/v1/insights/faq/${groupId}?projectId=${encodeURIComponent(projectId)}`,
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
  async refreshFAQGroups(projectId: string): Promise<{ groupCount: number }> {
    return await apiClient.fetch<{ groupCount: number }>(
      `/api/v1/insights/faq/refresh?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST" },
    );
  },
};
