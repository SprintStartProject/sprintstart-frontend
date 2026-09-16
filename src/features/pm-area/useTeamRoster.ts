import { useQueryFetch } from "../../hooks/useQueryFetch";
import { queryKeys } from "../../services/queryKeys";
import { getTeamOverview } from "../../services/teamManagementService";
import { useProjectContext } from "../projects/useProjectContext";

/**
 * The selected project's team overview, from the one cache entry every PM surface shares.
 *
 * Same key and call as the sidebar's attention flag and the dashboard's team widget, so the
 * overview, the team page and the member panel are never told different things — and a skip
 * decision anywhere (which fires `onPmAttentionChanged`, and so invalidates this key) refreshes
 * all of them at once.
 */
export function useTeamRoster() {
  const { selectedProjectId } = useProjectContext();

  return useQueryFetch(queryKeys.teamOverview.filtered(selectedProjectId || null), () =>
    getTeamOverview(undefined, undefined, selectedProjectId ? [selectedProjectId] : undefined),
  );
}
