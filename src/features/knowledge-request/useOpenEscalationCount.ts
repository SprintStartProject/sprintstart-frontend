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
 * A count rather than the boolean dot `usePmAttentionFlag` shows, and that is a
 * deliberate departure from the reasoning there ("a count would have to stay
 * accurate to be trustworthy"). It is warranted here because the number is the
 * endpoint's own answer rather than something derived from a page-sized read —
 * but *only* if it keeps up with the page it points at, which is what the
 * subscription below is for: the PM who empties the queue is looking at this
 * badge while they do it, and a stale "5" beside a list of two is exactly the
 * untrustworthy count that reasoning warns about.
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
  const queryClient = useQueryClient();

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

  return useRateLimitedRead(
    queryKeys.knowledgeRequest.openCount(projectId ?? ""),
    () => knowledgeRequestService.countOpen(projectId as string),
    0,
    { enabled: enabled && Boolean(projectId), refreshKey },
  );
}
