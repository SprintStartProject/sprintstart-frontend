import { useQuery, useQueryClient } from "@tanstack/react-query";
import { starterWorkService } from "../../../services/starterWorkService";
import { queryKeys } from "../../../services/queryKeys";
import type { ProposalStatus } from "../types";

/**
 * Loads the starter-work pool at one status, for the compact overview surface.
 *
 * Kept separate from the review hook because the two collections have different meanings:
 * unreviewed tasks are the PM's queue, while the pool also contains the tasks somebody already
 * vouched for. Callers can reload after a review, removal or manual promotion so both surfaces stay
 * in sync without coupling their local state.
 *
 * `status` defaults to `LIVE` — what nearly every caller wants — but also takes `STALE` for the
 * collapsed "Closed in the tracker" list and the Overview tab's count of it.
 *
 * `reload` no longer takes a `preserveContent` option: react-query already keeps the pool on
 * screen during a refetch (`isLoading` only reports a load with nothing to show yet), which is
 * what every caller of that option wanted.
 */
export function useStarterWorkPool(status: ProposalStatus = "LIVE") {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.starterWork.poolByStatus(status);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => starterWorkService.fetchPool(status),
  });

  return {
    pool: data ?? [],
    isLoading,
    error: isError
      ? error instanceof Error
        ? error.message
        : "Could not load the starter-work pool."
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
