import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRateLimitedRead } from "../../../hooks/useRateLimitedRead";
import { onboardingService } from "../../../services/onboardingService";
import { queryKeys } from "../../../services/queryKeys";
import { onSkipAnswerSeen, unseenSkipAnswerCount } from "../skipAnswers";

/**
 * How many of the member's skip requests the project manager has answered that the member has not
 * looked at yet.
 *
 * Drives the marker on the sidebar's onboarding entry. The path is read on navigation (rate limited,
 * like the other sidebar markers) and again the moment the onboarding page marks an answer seen, so
 * the marker goes as soon as the step is opened.
 *
 * @param refreshKey Changing this asks for a recheck; callers pass the current route.
 */
export function useUnseenSkipAnswerCount(
  userId: string | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return onSkipAnswerSeen(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.unseenSkipAnswers(userId),
      });
    });
  }, [queryClient, userId]);

  return useRateLimitedRead(
    queryKeys.onboarding.unseenSkipAnswers(userId ?? ""),
    async () => unseenSkipAnswerCount((await onboardingService.fetchPath()).phases),
    0,
    { enabled: enabled && Boolean(userId), refreshKey },
  );
}
