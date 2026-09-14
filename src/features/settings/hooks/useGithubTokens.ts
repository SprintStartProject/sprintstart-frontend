import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGithubPatNames } from "../../../services/sources/githubService";
import { queryKeys } from "../../../services/queryKeys";

type UseGithubTokensResult = {
  tokenNames: string[];
  tokensLoaded: boolean;
  tokensError: string | null;
  isRefreshing: boolean;
  /** Reloads the token list from the server. */
  loadTokenNames: () => Promise<void>;
  /**
   * Adds a just-created token name to the local list without a round-trip, so a
   * successful add is reflected immediately even if the follow-up reload fails
   * or is aborted. A later `loadTokenNames` reconciles with the server.
   */
  addTokenNameLocally: (name: string) => void;
};

/**
 * Loads the list of stored GitHub PAT names.
 *
 * Shares its cache entry with `useAdminData`'s own slice — same global tokens,
 * same key — so the user-settings PAT UI and the Access Management panel never
 * show two different answers, and whichever one loads first saves the other
 * the round trip.
 *
 * Out-of-order responses (an explicit `loadTokenNames` outrunning a slower,
 * earlier fetch) are react-query's own: it only ever applies the result of the
 * most recently started fetch for this key.
 */
export function useGithubTokens(): UseGithubTokensResult {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.githubTokenNames(),
    queryFn: ({ signal }) => getGithubPatNames(signal),
  });

  const addTokenNameLocally = (name: string) => {
    queryClient.setQueryData(queryKeys.admin.githubTokenNames(), (prev: string[] | undefined) =>
      prev?.includes(name) ? prev : [...(prev ?? []), name],
    );
  };

  return {
    tokenNames: data ?? [],
    tokensLoaded: !isLoading,
    tokensError: isError ? (error instanceof Error ? error.message : "Failed to load tokens.") : null,
    isRefreshing: isFetching,
    // Cancels any in-flight fetch first (react-query only supersedes one on
    // its own once a query has data, and the very first load never does),
    // so an explicit reload always wins over a slow one already in flight.
    loadTokenNames: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.githubTokenNames() });
      await refetch();
    },
    addTokenNameLocally,
  };
}
