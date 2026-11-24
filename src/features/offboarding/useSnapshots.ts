import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useQueryFetch } from "../../hooks/useQueryFetch";
import { offboardingService } from "../../services/offboardingService";
import type { RiskQuery } from "../../services/offboardingTypes";
import { queryKeys } from "../../services/queryKeys";

/**
 * The project's stored risk maps, and the two things a manager does with them: store the ranking on
 * screen and remove one. Both refresh the list; failures propagate to the caller, who reports them.
 */
export function useSnapshots(projectId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.offboarding.snapshots(projectId);
  const list = useQueryFetch(key, () => offboardingService.fetchSnapshots(projectId), {
    enabled: projectId !== "",
  });

  const save = useCallback(
    async (query: RiskQuery, label: string) => {
      const stored = await offboardingService.saveSnapshot(projectId, query, label);
      await queryClient.invalidateQueries({ queryKey: key });
      return stored;
    },
    [projectId, queryClient, key],
  );

  const remove = useCallback(
    async (snapshotId: string) => {
      await offboardingService.deleteSnapshot(projectId, snapshotId);
      await queryClient.invalidateQueries({ queryKey: key });
    },
    [projectId, queryClient, key],
  );

  return { ...list, save, remove };
}

/** How two stored rankings compare, once both are chosen. */
export function useComparison(projectId: string, left: string | null, right: string | null) {
  return useQueryFetch(
    queryKeys.offboarding.comparison(projectId, left ?? "", right ?? ""),
    () => offboardingService.compareSnapshots(projectId, left ?? "", right ?? ""),
    { enabled: projectId !== "" && left !== null && right !== null && left !== right },
  );
}
