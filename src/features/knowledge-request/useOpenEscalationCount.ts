import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  knowledgeRequestService,
  onOpenEscalationsChanged,
} from "../../services/knowledgeRequestService";
import { useRateLimitedRead } from "../../hooks/useRateLimitedRead";
import { queryKeys } from "../../services/queryKeys";

/**
 * How many escalated questions are still waiting on a person for this project.
 *
 * The number is the endpoint's own answer, and it is only trustworthy if it
 * keeps up with the page it points at, which is what the subscription below is
 * for: the PM who empties the queue is looking at this badge while they do it,
 * and a stale "5" beside a list of two is exactly the untrustworthy count a
 * badge must not show.
 *
 * Counted through its own endpoint, not `listOpen(...).length`. The full read
 * resolves every asker's name and onboarding position, and this is asked on
 * every navigation for every PM session.
 *
 * Returns 0 while disabled or with no project — so somebody who cannot open the
 * inbox never pays for the request nor sees the badge — and 0 when the read
 * fails, since a badge is not worth surfacing an error for.
 *
 * @param refreshKey Changing this asks for a recheck; callers pass the current
 * route, so returning to the sidebar from elsewhere refreshes it.
 */
export function useOpenEscalationCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  return useKnownOpenEscalationCount(projectId, enabled, refreshKey) ?? 0;
}

/**
 * The same count, but `null` while it is loading or after the read failed, instead of 0.
 *
 * For a caller that adds it into a bigger number: there, a failed read counted as zero would
 * quietly shrink the total. Returns 0 (a known nothing) while disabled or with no project -- the
 * caller cannot open the inbox, so there is nothing of it to count. Shares the cache entry with
 * {@link useOpenEscalationCount}, so both together still make one request.
 */
export function useKnownOpenEscalationCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): number | null {
  const queryClient = useQueryClient();
  const isActive = enabled && Boolean(projectId);

  // Re-subscribed on a project switch so the closure always invalidates the
  // project actually on screen. What used to be a local nonce bumped on this
  // event is now a direct cache invalidation of that project's own query.
  useEffect(() => {
    if (!projectId) return;
    return onOpenEscalationsChanged(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeRequest.openCount(projectId),
      });
    });
  }, [queryClient, projectId]);

  const count = useRateLimitedRead<number | null>(
    queryKeys.knowledgeRequest.openCount(projectId ?? ""),
    () => knowledgeRequestService.countOpen(projectId as string),
    null,
    { enabled: isActive, refreshKey },
  );

  return isActive ? count : 0;
}
