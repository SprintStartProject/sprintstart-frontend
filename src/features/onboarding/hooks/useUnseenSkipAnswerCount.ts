import { useEffect, useState } from "react";
import { useRateLimitedRead } from "../../../hooks/useRateLimitedRead";
import { onboardingService } from "../../../services/onboardingService";
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
  const [seenNonce, setSeenNonce] = useState(0);
  useEffect(() => onSkipAnswerSeen(() => setSeenNonce((current) => current + 1)), []);

  return useRateLimitedRead(
    async () => unseenSkipAnswerCount((await onboardingService.fetchPath()).phases),
    0,
    { key: userId, enabled, refreshKey, nonce: seenNonce },
  );
}
