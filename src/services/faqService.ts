import { apiClient } from "./apiClient";
import type {
  FAQOverview,
  FAQDetail,
  FAQRebuildScope,
  FAQRebuildPreview,
} from "../features/faq/types";
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
      // Asserted rather than inferred: a JSON import widens the trend literal
      // to `string`, which no longer matches the union.
      return faqDetailMock as FAQDetail;
    }
  },

  /**
   * Asks how much material a rebuild would have, per time window.
   *
   * Errors propagate: the caller uses this to describe a destructive action, and
   * guessing the numbers would be worse than showing none.
   */
  async fetchRebuildPreview(
    projectId: string,
    windowsInDays: number[],
  ): Promise<FAQRebuildPreview> {
    const params = new URLSearchParams({ projectId });
    windowsInDays.forEach((days) => params.append("sinceDays", String(days)));

    return await apiClient.fetch<FAQRebuildPreview>(
      `/api/v1/insights/faq/rebuild-preview?${params.toString()}`,
    );
  },

  /**
   * Triggers the backend to regroup the project's questions from scratch.
   *
   * Destructive: it replaces the stored entries, so anything outside `scope` is
   * gone from the counts afterwards. Unlike the fetch methods this does not
   * fall back to mock data — the caller needs to know whether it succeeded, so
   * errors propagate.
   *
   * @returns The number of groups stored after the rebuild.
   */
  async refreshFAQGroups(
    projectId: string,
    scope: FAQRebuildScope = {},
  ): Promise<{ groupCount: number }> {
    const params = new URLSearchParams({ projectId });
    if (scope.questionLimit !== undefined) {
      params.set("questionLimit", String(scope.questionLimit));
    }
    if (scope.sinceDays !== undefined) {
      params.set("sinceDays", String(scope.sinceDays));
    }

    return await apiClient.fetch<{ groupCount: number }>(
      `/api/v1/insights/faq/refresh?${params.toString()}`,
      { method: "POST" },
    );
  },
};
