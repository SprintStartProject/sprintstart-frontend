import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";

/**
 * Whether the onboarding entry should be offered to this user.
 *
 * Path existence is deliberately not part of navigation availability. The
 * onboarding page owns that state and offers manual personalization when the
 * real path endpoint returns 404.
 */
export function useOnboardingAvailable(): boolean {
  const { profile } = useAuth();

  return isOnboardingAccessible(profile);
}
