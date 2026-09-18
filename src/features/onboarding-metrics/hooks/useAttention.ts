import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { queryKeys } from "../../../services/queryKeys";
import type { ProjectAttention } from "../types";

type UseAttentionResult = {
  attention: ProjectAttention | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Loads a project's attention list — who is waiting on a review or stalling — for
 * the PM/HR/ADMIN dashboard.
 *
 * The list is composed from the same metrics derivation as everything else on the
 * dashboard, so it stays consistent with the hire's own view. It is a read-only
 * list: acting on it means talking to the person, not clicking something here.
 *
 * @param projectId The selected project, or empty string when none is chosen.
 */
export function useAttention(projectId: string): UseAttentionResult {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.attention.byProject(projectId);

  const {
    data,
    isLoading: isQueryLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => onboardingMetricsService.fetchAttention(projectId),
    enabled: Boolean(projectId),
  });

  return {
    attention: projectId ? (data ?? null) : null,
    isLoading: Boolean(projectId) && isQueryLoading,
    error: isError
      ? error instanceof Error
        ? error.message
        : "Could not load the attention list."
      : null,
    // Cancels any in-flight fetch first (react-query only supersedes one on its
    // own once the query has data, and the very first load never does), so an
    // explicit reload always wins over a slow one already in flight.
    reload: async () => {
      await queryClient.cancelQueries({ queryKey });
      await refetch();
    },
  };
}
