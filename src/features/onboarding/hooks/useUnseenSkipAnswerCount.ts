import { useEffect, useState } from "react";
import { useRateLimitedRead } from "../../../hooks/useRateLimitedRead";
import { onboardingService } from "../../../services/onboardingService";
import { onSkipAnswersSeenChanged, readSeenSkipAnswers, skipAnswersOf } from "../skipAnswers";

/**
 * How many of the member's skip requests the project manager has answered since they last looked.
 *
 * Drives the marker on the sidebar's onboarding entry. The path is read on navigation (rate
 * limited, like the other sidebar markers); what counts as seen is re-read whenever the onboarding
 * page marks answers seen, so the marker goes the moment the notice is dismissed.
 *
 * @param refreshKey Changing this asks for a recheck; callers pass the current route.
 */
export function useUnseenSkipAnswerCount(
  userId: string | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  // Bumped only to render again: what is seen is read from storage below, every render.
  const [, setSeenVersion] = useState(0);
  useEffect(() => onSkipAnswersSeenChanged(() => setSeenVersion((current) => current + 1)), []);

  const answeredIds = useRateLimitedRead(
    async () =>
      skipAnswersOf((await onboardingService.fetchPath()).phases).map((answer) => answer.skipId),
    [] as string[],
    { key: userId, enabled, refreshKey },
  );

  const seen = readSeenSkipAnswers(userId ?? "");
  return answeredIds.filter((id) => !seen.has(id)).length;
}
