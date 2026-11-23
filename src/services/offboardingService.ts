import { apiClient } from "./apiClient";
import type { RiskMap, RiskQuery } from "./offboardingTypes";

/** The query string of a risk request: each leaving person as its own `leaving` parameter. */
function riskSearchParams(query: RiskQuery): string {
  const params = new URLSearchParams();
  query.leaving.forEach((person) => params.append("leaving", person));
  if (query.asOf) params.set("asOf", query.asOf);
  if (query.reviewWeight !== undefined) params.set("reviewWeight", String(query.reviewWeight));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return params.toString();
}

/**
 * What a project loses when people leave. Every call carries the project it asks about, and
 * failures propagate: a ranking that could not be computed must not look like one with no risk.
 */
export const offboardingService = {
  /** Ranks the files that lose the people who know them when [query]'s people leave. */
  async fetchRiskMap(projectId: string, query: RiskQuery): Promise<RiskMap> {
    return await apiClient.fetch<RiskMap>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/offboarding/risk?${riskSearchParams(query)}`,
    );
  },
};
