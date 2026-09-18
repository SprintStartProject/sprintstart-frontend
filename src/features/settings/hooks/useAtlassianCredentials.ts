import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyAtlassianCredentials } from "../../../services/sources/atlassianService";
import type { AtlassianCredentialDto } from "../../../services/sources/atlassianService";
import { queryKeys } from "../../../services/queryKeys";

type UseAtlassianCredentialsResult = {
  credentials: AtlassianCredentialDto[];
  loaded: boolean;
  error: string | null;
  isRefreshing: boolean;
  /** Reloads the authenticated user's credential list. */
  reload: () => Promise<void>;
  /**
   * Adds a just-created credential to the local list without a round-trip, so a
   * successful add is reflected immediately even if the follow-up reload fails
   * or is aborted. A later `reload` reconciles with the server.
   */
  addCredentialLocally: (credential: AtlassianCredentialDto) => void;
};

/**
 * Loads the Atlassian credentials owned by the authenticated user, shared by
 * the Jira and Confluence connectors.
 *
 * When disabled, the hook settles into a loaded-empty state without fetching.
 * Out-of-order responses (an explicit `reload` outrunning a slower, earlier
 * fetch) are react-query's own: it only ever applies the result of the most
 * recently started fetch for this key.
 */
export function useAtlassianCredentials(enabled = true): UseAtlassianCredentialsResult {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.atlassianCredentials.mine(),
    queryFn: ({ signal }) => getMyAtlassianCredentials(signal),
    enabled,
  });

  const addCredentialLocally = (credential: AtlassianCredentialDto) => {
    queryClient.setQueryData(
      queryKeys.atlassianCredentials.mine(),
      (prev: AtlassianCredentialDto[] | undefined) =>
        prev?.some((existing) => existing.displayName === credential.displayName)
          ? prev
          : [...(prev ?? []), credential],
    );
  };

  return {
    credentials: enabled ? (data ?? []) : [],
    loaded: !enabled || !isLoading,
    error: isError
      ? error instanceof Error
        ? error.message
        : "Failed to load Atlassian credentials."
      : null,
    isRefreshing: isFetching,
    // Cancels any in-flight fetch first (react-query only supersedes one on
    // its own once a query has data, and the very first load never does),
    // so an explicit reload always wins over a slow one already in flight.
    reload: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.atlassianCredentials.mine() });
      await refetch();
    },
    addCredentialLocally,
  };
}
