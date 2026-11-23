import { useQueryFetch } from "../../hooks/useQueryFetch";
import { offboardingService } from "../../services/offboardingService";
import type { RiskQuery } from "../../services/offboardingTypes";
import { queryKeys } from "../../services/queryKeys";

const NO_DEPARTURE: RiskQuery = { leaving: [] };

/**
 * The risk map of a departure, once there is one to rank.
 *
 * Nothing is requested until [query] is given, so a page that has not asked yet shows no error and
 * no spinner.
 */
export function useRiskMap(projectId: string, query: RiskQuery | null) {
  const asked = query ?? NO_DEPARTURE;
  return useQueryFetch(
    queryKeys.offboarding.riskMap(projectId, asked),
    () => offboardingService.fetchRiskMap(projectId, asked),
    { enabled: query !== null && projectId !== "" },
  );
}
