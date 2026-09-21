import { QueryClient } from "@tanstack/react-query";

/**
 * Shared cache for every `useQuery`/`useMutation` in the app.
 *
 * `staleTime: 30_000` is the reason a revisit of a page loaded seconds ago
 * shows data immediately instead of refetching — see the smooth-page-navigation
 * plan. `retry: 1` keeps a single flaky request from being resurfaced as a
 * one-off failure, without the default of three retries stacking up latency
 * on a request that is genuinely down (e.g. an expired session).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
