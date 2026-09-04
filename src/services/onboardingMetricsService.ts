import { apiClient } from "./apiClient";
import type {
  HireTimeline,
  ProjectAttention,
  ProjectOnboardingMetrics,
} from "../features/onboarding-metrics/types";

const BASE = "/api/v1/onboarding/metrics";

export const onboardingMetricsService = {
  /**
   * A project's onboarding metrics: the aggregates (median time-to-first-merged-PR,
   * review-latency median/p90, stalls, PRs waiting on anyone) plus every hire's
   * timeline in one read. PM/HR/ADMIN only.
   *
   * Derived on request on the backend — there is no pipeline to fall behind — so
   * an empty `hires` list means "no hires yet", not a stale cache.
   *
   * @param projectId The project to read metrics for.
   * @throws ApiError 403 when the caller lacks the role.
   */
  async fetchProjectMetrics(projectId: string): Promise<ProjectOnboardingMetrics> {
    return await apiClient.fetch<ProjectOnboardingMetrics>(
      `${BASE}/projects/${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * One hire's onboarding timeline on a project (PM/HR/ADMIN). The project read
   * already embeds every hire's timeline, so this is only for a focused view.
   *
   * @param projectId The project the hire belongs to.
   * @param userId The hire.
   * @throws ApiError 404 when the user is not a member of the project.
   */
  async fetchHireTimeline(projectId: string, userId: string): Promise<HireTimeline> {
    return await apiClient.fetch<HireTimeline>(
      `${BASE}/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}`,
    );
  },

  /**
   * The authenticated hire's own onboarding timeline on a project — the self-serve
   * slice of the same derivation (the backend resolves the caller from the JWT).
   * Drives the buddy's proactive nudges, e.g. `longestOpenWaitHours`, how long
   * their pull request has been waiting.
   *
   * @param projectId The project whose timeline to read.
   * @throws ApiError 404 when the caller is not a member of the project.
   */
  async fetchMyTimeline(projectId: string): Promise<HireTimeline> {
    return await apiClient.fetch<HireTimeline>(
      `${BASE}/me?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Who on a project needs a human today (PM/HR/ADMIN): PRs waiting on a
   * response and stalls, worst first, each item's reason stating whose move it
   * is. Composed from the same derivation as the rest of the metrics, so it
   * never disagrees with the hire's own view.
   *
   * @param projectId The project to read the attention list for.
   */
  async fetchAttention(projectId: string): Promise<ProjectAttention> {
    return await apiClient.fetch<ProjectAttention>(
      `${BASE}/projects/${encodeURIComponent(projectId)}/attention`,
    );
  },
};
