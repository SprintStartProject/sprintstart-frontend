import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getTeamOverview, onPmAttentionChanged } from "../../services/teamManagementService";
import { MIN_REFRESH_INTERVAL_MS, useRateLimitedRead } from "../../hooks/useRateLimitedRead";
import { queryKeys } from "../../services/queryKeys";

export { MIN_REFRESH_INTERVAL_MS };

/**
 * Whether the PM Dashboard has anything waiting: a pending skip request, or
 * feedback nobody has read yet.
 *
 * Deliberately a boolean and not a count. The sidebar only needs to say "there
 * is something", and a count here would have to stay accurate to be
 * trustworthy — the two signals come from a page-sized read, not from an
 * endpoint that answers "how many". Where a count *is* the endpoint's own
 * answer it is worth showing; see `useOpenEscalationCount`.
 *
 * Both signals come from the team overview: `currentStep.skip` carries the skip
 * request, and the service already folds unread feedback into `hasFeedback`.
 * There is no lighter endpoint for either.
 *
 * The freshness machinery — rate limiting, revalidating on tab focus, surviving
 * StrictMode's double-invoke — lives in {@link useRateLimitedRead}, which was
 * extracted from this hook when the escalation inbox needed the same thing.
 *
 * @param refreshKey Changing this asks for a recheck -- the caller passes the
 * current route, so switching views refreshes the flag. Rate-limited by
 * {@link MIN_REFRESH_INTERVAL_MS}.
 */
export function usePmAttentionFlag(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): boolean {
  const queryClient = useQueryClient();
  const isActive = enabled && Boolean(projectId);

  // Re-subscribed on a project switch so the closure always invalidates the
  // project actually on screen. What used to be a local nonce bumped on this
  // event is now a direct cache invalidation of that project's own query.
  useEffect(() => {
    if (!projectId) return;
    return onPmAttentionChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmAttention.byProject(projectId) });
    });
  }, [queryClient, projectId]);

  return useRateLimitedRead(
    queryKeys.pmAttention.byProject(projectId ?? ""),
    async () => {
      const users = await getTeamOverview(undefined, undefined, [projectId as string]);
      return users.some((user) => user.hasFeedback || user.currentStep?.skip?.status === "PENDING");
    },
    false,
    { enabled: isActive, refreshKey },
  );
}
