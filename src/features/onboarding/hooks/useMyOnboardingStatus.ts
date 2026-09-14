import { useQuery } from "@tanstack/react-query";
import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { ApiError } from "../../../services/apiClient";
import { onboardingService } from "../../../services/onboardingService";
import { queryKeys } from "../../../services/queryKeys";
import {
  countPathProgress,
  resolveNextAction,
  type OnboardingNextAction,
  type PathProgress,
} from "../nextAction";

/**
 * `absent` covers both ends of the journey — no path built yet, and none any more — since
 * neither gives the dashboard anything to show.
 */
export type MyOnboardingStatus =
  | { state: "loading" }
  | { state: "absent" }
  | { state: "error" }
  | { state: "ready"; progress: PathProgress; nextAction: OnboardingNextAction };

const ABSENT: MyOnboardingStatus = { state: "absent" };

type OnboardingQueryResult =
  | { kind: "absent" }
  | { kind: "ready"; progress: PathProgress; nextAction: OnboardingNextAction };

/**
 * How far the signed-in user is through their own onboarding, and what comes next.
 *
 * Gated like the sidebar entry, and for the same reason: the card should exist exactly
 * while the journey does. `isOnboardingAccessible` answers both ends from the profile
 * alone — no project role means no path has been generated yet, a completed journey is
 * gone for good — so the common case of having nothing to show costs no request at all.
 *
 * A missing path is `absent`, not an error: the backend answers 404 until a path exists,
 * which also covers a project with nothing ingested yet. Unlike the onboarding page this
 * never *starts* a generation — opening the dashboard is not a request to build a path,
 * and firing one from a widget would race the page that owns it.
 *
 * Anything else that fails is `error`, kept apart from `absent` on purpose: an onboarding
 * shown for someone who has none is the bug this replaced (mock data stood in for a
 * failed read), and "this could not be loaded" is a different statement from "you have
 * none".
 */
export function useMyOnboardingStatus(): MyOnboardingStatus {
  const { profile } = useAuth();
  const isAvailable = isOnboardingAccessible(profile);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.onboarding.myStatus(profile?.id ?? ""),
    queryFn: async (): Promise<OnboardingQueryResult> => {
      try {
        const path = await onboardingService.fetchPath();
        const nextAction = resolveNextAction(path);

        // The review pool only decides anything once every step and check is behind the
        // user: up to that point something else is already next. So it costs a request
        // exactly then — and a failed read leaves the journey looking finished rather
        // than broken, which is the harmless way to be wrong here.
        const openReviewCount =
          nextAction.kind === "done"
            ? await onboardingService
                .fetchReviewCheck()
                .then((pool) => pool.openCount)
                .catch(() => 0)
            : 0;

        return {
          kind: "ready",
          progress: countPathProgress(path),
          nextAction:
            openReviewCount > 0 ? { kind: "review", openCount: openReviewCount } : nextAction,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { kind: "absent" };
        }
        throw error;
      }
    },
    enabled: isAvailable,
  });

  // Derived rather than stored, so a profile that loses its onboarding (role removed,
  // journey completed) can never leave a stale card behind.
  if (!isAvailable) return ABSENT;
  if (isLoading) return { state: "loading" };
  if (isError) return { state: "error" };
  if (data?.kind === "absent") return ABSENT;
  if (data?.kind === "ready") return { state: "ready", progress: data.progress, nextAction: data.nextAction };
  return { state: "loading" };
}
