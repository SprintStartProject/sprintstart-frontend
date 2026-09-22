import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { UseFetchResult } from "./useFetch";

export interface UseQueryFetchResult<T> extends UseFetchResult<T> {
  /** Reload now, bypassing staleness. For an explicit user action (a "Refresh" button). */
  refetch: () => void;
  /**
   * True for any fetch in flight, initial or a manually triggered `refetch()` alike —
   * unlike `loading`, which stays `false` for a refetch of a key that already has data.
   * For code that needs to know "is a request in flight right now" (e.g. a manual
   * refresh's completion callback), rather than "is there nothing to show yet."
   */
  isFetching: boolean;
  /**
   * True when a refetch (not the initial load) just failed while valid cached
   * data is still on screen. Separate from `error`, which only covers the case
   * where there is nothing usable to show — a background refetch failure should
   * not replace good cached content with a full error state, but a caller doing
   * a manual refresh still wants to know it didn't work.
   */
  refetchError: boolean;
}

export type UseQueryFetchOptions = {
  /** Skip the request until every input and permission required by the loader is available. */
  enabled?: boolean;
};

/**
 * `useFetch`, backed by the shared query cache instead of a private
 * `useState`/`useEffect` pair — same return shape (plus `refetch`, for the
 * couple of call sites that used to force a reload through a `refreshKey` in
 * `deps`), so a call site swaps one import and adds the `queryKey` its data
 * was missing.
 *
 * `useFetch` never had a cache key, only `deps` that re-ran the effect, so a
 * revisit re-fetched even data that was on screen seconds ago. A real key is
 * what lets a widget and the page it summarizes (or two mounts of the same
 * page) share one request instead of each running their own.
 *
 * `loading` maps to `isLoading` (react-query's "nothing to show yet, and a
 * fetch is in flight" flag) rather than `isFetching`, so a cached revisit
 * renders immediately instead of behind a spinner — the whole point of this
 * migration.
 */
export function useQueryFetch<T>(
  queryKey: QueryKey,
  loader: () => Promise<T>,
  { enabled = true }: UseQueryFetchOptions = {},
): UseQueryFetchResult<T> {
  const { data, isLoading, isFetching, isLoadingError, isRefetchError, refetch } = useQuery({
    queryKey,
    queryFn: loader,
    enabled,
  });

  return {
    data: enabled ? (data ?? null) : null,
    loading: enabled && isLoading,
    error: enabled && isLoadingError,
    refetchError: enabled && isRefetchError,
    refetch: () => void refetch(),
    isFetching: enabled && isFetching,
  };
}
