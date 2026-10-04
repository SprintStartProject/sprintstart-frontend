import { useEffect, useState } from "react";
import { onboardingService } from "../../../services/onboardingService";
import { onBuddyPathChanged } from "../../buddy/aiBuddyBus";
import type { OnboardingPathEndpoint } from "../../onboarding/types";

/**
 * The hire's onboarding path, for the board to place its cards against.
 *
 * Null while it loads and whenever there is none — a hire without a path is an ordinary state, and
 * the board simply has no ramp to file anything under. Read again when the buddy moves the path on,
 * the way the path strip does, so a phase finished in the dock moves its cards up on the board
 * underneath it.
 */
export function useOnboardingPath(): OnboardingPathEndpoint | null {
  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);

  useEffect(() => {
    let cancelled = false;

    const read = () =>
      void onboardingService
        .fetchPath()
        .then((next) => {
          if (!cancelled) setPath(next);
        })
        .catch(() => {
          if (!cancelled) setPath(null);
        });

    read();
    const unsubscribe = onBuddyPathChanged(read);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return path;
}
