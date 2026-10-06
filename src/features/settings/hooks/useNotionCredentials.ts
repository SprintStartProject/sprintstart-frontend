import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyNotionCredentials } from "../../../services/sources/notionService";
import type { NotionCredentialDto } from "../../../services/sources/notionService";
import { queryKeys } from "../../../services/queryKeys";

type UseNotionCredentialsResult = {
  credentials: NotionCredentialDto[];
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
  addCredentialLocally: (credential: NotionCredentialDto) => void;
};

/**
 * Loads the Notion credentials owned by the authenticated user.
 *
 * When disabled, the hook settles into a loaded-empty state without fetching.
 * Out-of-order responses (an explicit `reload` outrunning a slower, earlier
 * fetch) are react-query's own: it only ever applies the result of the most
 * recently started fetch for this key.
 */
export function useNotionCredentials(enabled = true): UseNotionCredentialsResult {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.notionCredentials.mine(),
    queryFn: ({ signal }) => getMyNotionCredentials(signal),
    enabled,
  });

  const addCredentialLocally = (credential: NotionCredentialDto) => {
    queryClient.setQueryData(
      queryKeys.notionCredentials.mine(),
      (prev: NotionCredentialDto[] | undefined) =>
        prev?.some((existing) => existing.name === credential.name)
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
        : "Failed to load Notion credentials."
      : null,
    isRefreshing: isFetching,
    // Cancels any in-flight fetch first so an explicit reload always wins over
    // a slow one already in flight (see `useAtlassianCredentials`).
    reload: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notionCredentials.mine() });
      await refetch();
    },
    addCredentialLocally,
  };
}
