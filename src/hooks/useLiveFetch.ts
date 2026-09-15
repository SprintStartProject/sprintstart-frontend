import { useQuery, type QueryKey } from "@tanstack/react-query";

/** How often an open, visible panel re-reads its data on its own. */
const DEFAULT_INTERVAL_MS = 30_000;
/** Smallest gap between two loads, whatever triggered them. */
const DEFAULT_MIN_INTERVAL_MS = 10_000;

export interface UseLiveFetchOptions {
  /** Polling cadence while the tab is visible. `0` polls only on focus. */
  intervalMs?: number;
  /**
   * Throttle floor (`staleTime`): a focus/mount check inside this window serves
   * the cached answer instead of firing a request.
   */
  minIntervalMs?: number;
  /** Skip loading entirely, e.g. before a project has been selected. */
  enabled?: boolean;
}

export interface UseLiveFetchResult<T> {
  data: T | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  /** True while refreshing data that is already on screen. */
  revalidating: boolean;
  error: boolean;
  /** Reload now, ignoring the throttle. For an explicit user action. */
  refresh: () => void;
}

/**
 * Loads data and keeps it current without the user reloading the page.
 *
 * Backed by the shared query cache: a mount that finds a fresh answer already
 * there (within `minIntervalMs`) renders it immediately with no request at
 * all, and two components reading the same `queryKey` — a dashboard widget
 * and the page it summarizes — share one.
 *
 * The difference to {@link import("./useQueryFetch").useQueryFetch} is what
 * happens on a *re*-fetch: the data already on screen stays there and only
 * `revalidating` flips, so a panel that refreshes itself every 30 seconds
 * doesn't blink through a spinner every 30 seconds. For the same reason a
 * failed background reload does not raise `error` — the last good data is a
 * better thing to show than an error state. Only a load with nothing to fall
 * back on reports failure.
 *
 * A `queryKey` change is treated as a different question, not a stale answer
 * to the same one: it starts from `null`/`loading` rather than keeping the
 * previous key's data on screen, since a project switch showing the *last*
 * project's data would be wrong, not merely old.
 *
 * Revalidation is otherwise react-query's own: on window focus (the shared
 * `queryClient` default), on an interval while the tab is visible
 * (`refetchInterval` skips background tabs by default), and on remount.
 */
export function useLiveFetch<T>(
  queryKey: QueryKey,
  loader: () => Promise<T>,
  options: UseLiveFetchOptions = {},
): UseLiveFetchResult<T> {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    enabled = true,
  } = options;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: loader,
    enabled,
    staleTime: minIntervalMs,
    refetchInterval: intervalMs > 0 ? intervalMs : false,
  });

  return {
    data: data ?? null,
    // Derived rather than stored: a disabled query never fetches, so
    // reporting it as loading would leave a caller spinning forever.
    loading: enabled && isLoading,
    revalidating: isFetching && !isLoading,
    // Only when there is nothing to fall back on — a failed background
    // refetch leaves the last good `data` in place and is not surfaced.
    error: isError && data === undefined,
    refresh: () => void refetch(),
  };
}
