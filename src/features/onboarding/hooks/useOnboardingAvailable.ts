import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useOnboardingJourney } from "../generation/OnboardingJourneyContext";

/**
 * Whether the onboarding entry should be offered to this user.
 *
 * Offered while there is onboarding to do: a path that exists, one being built, or one that can be
 * built from the selected project. Left out when a path could only end empty -- no project, no
 * published blueprint, nothing ingested -- which is what used to surface as an error on the page.
 * Still "yes" while that is being worked out, so the entry does not blink out and back in on every
 * load. See `OnboardingJourneyProvider`.
 *
 * Not used by `AuthGuard`: someone who reaches `/onboarding` by URL still gets the page, which
 * explains its own state.
 */
export function useOnboardingAvailable(): boolean {
  const { profile } = useAuth();
  const { availability } = useOnboardingJourney();

  return isOnboardingAccessible(profile) && availability !== "unavailable";
}
