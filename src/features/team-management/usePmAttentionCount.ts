import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPmAttentionCount,
  onPmAttentionChanged,
  type PmAttentionCount,
} from "../../services/teamManagementService";
import { MIN_REFRESH_INTERVAL_MS, useRateLimitedRead } from "../../hooks/useRateLimitedRead";
import { queryKeys } from "../../services/queryKeys";

export { MIN_REFRESH_INTERVAL_MS };

/**
 * How many onboarding items wait on the project manager in the selected project: pending skip
 * requests and unread feedback, for the number on the sidebar's PM Dashboard entry.
 *
 * This used to be a boolean -- "there is something" -- because the only source was the team
 * overview, whose read falls back to mock users when it fails. The count comes from
 * {@link getPmAttentionCount} instead, which only ever answers from the backend.
 *
 * `null` means "no number to show": while the first read is in flight, after a read failed,
 * while disabled, and with no project. A badge that says 0 while loading, or keeps the last
 * number through an outage, would be a wrong answer rather than a quiet one.
 *
 * Deciding a skip request or marking feedback read announces itself through
 * `onPmAttentionChanged`, which refetches this project's count straight away rather than
 * waiting out the rate limit -- the PM who clears an item is looking at the badge while they do.
 *
 * The freshness machinery -- rate limiting, revalidating on tab focus, surviving StrictMode's
 * double-invoke -- lives in {@link useRateLimitedRead}.
 *
 * @param refreshKey Changing this asks for a recheck -- the caller passes the current route, so
 * switching views refreshes the count. Rate-limited by {@link MIN_REFRESH_INTERVAL_MS}.
 */
export function usePmAttentionCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): PmAttentionCount | null {
  const queryClient = useQueryClient();
  const isActive = enabled && Boolean(projectId);

  // Re-subscribed on a project switch so the closure always invalidates the project actually on
  // screen.
  useEffect(() => {
    if (!projectId) return;
    return onPmAttentionChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pmAttention.count(projectId) });
    });
  }, [queryClient, projectId]);

  const count = useRateLimitedRead<PmAttentionCount | null>(
    queryKeys.pmAttention.count(projectId ?? ""),
    () => getPmAttentionCount(projectId as string),
    null,
    { enabled: isActive, refreshKey },
  );

  return isActive ? count : null;
}
