import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";

/**
 * Whether the onboarding entry should be offered to this user.
 *
 * Always, while onboarding is theirs to do -- whether or not a path can be built right now. The page
 * says why not (no project, no published blueprint, nothing in the knowledge base yet) and only offers
 * to start when a start can succeed; an entry that appears and disappears with the project's state
 * was harder to find than one that explains itself.
 */
export function useOnboardingAvailable(): boolean {
  const { profile } = useAuth();

  return isOnboardingAccessible(profile);
}
