import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getTeamOverview, onPmAttentionChanged } from "../../services/teamManagementService";
import { MIN_REFRESH_INTERVAL_MS, useRateLimitedRead } from "../../hooks/useRateLimitedRead";
import { queryKeys } from "../../services/queryKeys";
import { waitingOn } from "../pm-area/memberStatus";
import type { TeamOverviewUser } from "./types";

export { MIN_REFRESH_INTERVAL_MS };

const NO_USERS: TeamOverviewUser[] = [];

/**
 * How many team members are waiting on the PM: a pending skip request, or feedback nobody has
 * read yet.
 *
 * Counts people, not requests, and asks `waitingOn` which of them count -- the same rule the
 * dashboard's "Waiting on you" figure and the team list's "Waiting on you" filter use, so the
 * number on the sidebar is always one the manager finds again on the page it opens. It used to
 * be a bare dot on the argument that a derived count would drift from the page; sharing the rule
 * is what keeps it from drifting.
 *
 * Both signals come from the team overview: `currentStep.skip` carries the skip request, and the
 * service already folds unread feedback into `hasFeedback`. There is no lighter endpoint for
 * either.
 *
 * Reads under `queryKeys.teamOverview.filtered`, the same key (and the same `getTeamOverview`
 * call) `TeamOverviewWidget` uses -- the sidebar badge and the dashboard card share one cache
 * entry instead of each firing their own request for the same project's overview.
 *
 * The freshness machinery — rate limiting, revalidating on tab focus, surviving StrictMode's
 * double-invoke — lives in {@link useRateLimitedRead}.
 *
 * @param refreshKey Changing this asks for a recheck -- the caller passes the current route, so
 * switching views refreshes the count. Rate-limited by {@link MIN_REFRESH_INTERVAL_MS}.
 */
export function usePmWaitingCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  const queryClient = useQueryClient();
  const isActive = enabled && Boolean(projectId);

  // Re-subscribed on a project switch so the closure always invalidates the project actually on
  // screen.
  useEffect(() => {
    if (!projectId) return;
    return onPmAttentionChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamOverview.filtered(projectId) });
    });
  }, [queryClient, projectId]);

  const users = useRateLimitedRead(
    queryKeys.teamOverview.filtered(projectId ?? null),
    () => getTeamOverview(undefined, undefined, [projectId as string]),
    NO_USERS,
    { enabled: isActive, refreshKey },
  );

  return users.filter((user) => waitingOn(user).length > 0).length;
}
