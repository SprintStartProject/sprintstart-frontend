import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Shortest gap between two checks triggered by navigation or by returning to
 * the tab.
 *
 * Without this, clicking quickly through the app would fire the request on
 * every single view. Kept short because a badge turning *on* depends on it:
 * the thing being counted is created on somebody else's device, so a caller
 * cannot learn about it any sooner than its next check.
 *
 * A caller-invalidated query (see `queryClient.invalidateQueries`) always
 * refetches immediately regardless, since the answer demonstrably changed.
 */
export const MIN_REFRESH_INTERVAL_MS = 5_000;

type RateLimitedReadOptions = {
  /** Whether the caller is allowed to see this at all, and has something to key it by. */
  enabled: boolean;
  /**
   * Changing this asks for a recheck — callers pass the current route, so
   * switching views refreshes. Rate-limited by {@link MIN_REFRESH_INTERVAL_MS}.
   */
  refreshKey?: string;
};

/**
 * A small read whose answer decorates the shell of the app — a badge, a count,
 * a dot — kept fresh without a subscription and without hammering the backend.
 *
 * Backed by the shared query cache, with `staleTime` doing the rate limiting
 * that this hook used to hand-roll. What is left to do by hand is asking for a
 * recheck in the first place: the sidebar that calls this never unmounts, so
 * react-query's own refetch-on-mount and refetch-on-window-focus have nothing
 * to attach to. A route change (`refreshKey`) or the tab regaining focus both
 * ask, by reading the query's cache entry straight from the client rather than
 * from this render's `useQuery` result -- a raw `focus` listener fires as soon
 * as the event dispatches, which can be before React has re-rendered to catch
 * up with a fetch that already resolved a moment earlier, and the client's own
 * cache entry (unlike this render's snapshot) is always current.
 *
 * `queryKey` is the caller's own — unlike the single shared `key` this hook
 * used to take, a bare project id would collide between two different badges
 * reading the same project. Use the central `queryKeys` factory.
 *
 * Errors are swallowed to `fallback`: a badge is not worth surfacing an error
 * for, and staying quiet beats claiming there is nothing to do. Unlike
 * `useLiveFetch`, a failed refetch does not keep the last good value on
 * screen — a stale badge is a wrong answer, not a stand-in for a fresh one.
 */
export function useRateLimitedRead<T>(
  queryKey: QueryKey,
  read: () => Promise<T>,
  fallback: T,
  { enabled, refreshKey }: RateLimitedReadOptions,
): T {
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useQuery({
    queryKey,
    queryFn: read,
    enabled,
    staleTime: MIN_REFRESH_INTERVAL_MS,
  });

  // Read from a ref inside the long-lived focus listener and the recheck
  // effect below, so neither needs to be torn down and re-added on every
  // render. Synced in an effect rather than assigned during render so it is
  // always this render's values by the time an event fires (effects run
  // after commit, in declaration order).
  const latest = useRef({ enabled, refetch, queryKey });
  useEffect(() => {
    latest.current = { enabled, refetch, queryKey };
  });

  const recheck = useCallback(() => {
    const { enabled: isEnabled, refetch: doRefetch, queryKey: key } = latest.current;
    if (!isEnabled) return;
    const state = queryClient.getQueryState(key);
    // A fetch already in flight (e.g. this same mount's initial load) is
    // joined rather than duplicated by react-query, but still worth skipping
    // here so a burst of navigation/focus events doesn't queue up refetches.
    if (state?.fetchStatus === "fetching") return;
    // `errorUpdatedAt` also counts as "checked recently": without it, a
    // failing read never advances past `dataUpdatedAt`, so every navigation
    // or focus event during an outage would retry immediately instead of
    // respecting the throttle.
    const lastCheckedAt = Math.max(state?.dataUpdatedAt ?? 0, state?.errorUpdatedAt ?? 0);
    if (Date.now() - lastCheckedAt >= MIN_REFRESH_INTERVAL_MS) {
      void doRefetch();
    }
  }, [queryClient]);

  useEffect(() => {
    recheck();
  }, [refreshKey, recheck]);

  // Coming back to the tab is the strongest hint that time has passed and the
  // answer may be stale. Costs nothing while the tab sits in the background,
  // unlike a timer, and covers the common "I was in Slack for ten minutes"
  // case that navigation alone never catches.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [recheck]);

  return enabled && !isError ? (data ?? fallback) : fallback;
}
