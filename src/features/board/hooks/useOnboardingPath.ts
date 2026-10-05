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
export function useOnboardingPath(): { path: OnboardingPathEndpoint | null; settled: boolean } {
  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);
  /**
   * Whether the path has been asked for and answered at least once. Null before that means "not
   * known yet"; null after it means "there is none" — the difference between leaving a card's way
   * back alone and hiding one that leads nowhere.
   */
  const [settled, setSettled] = useState(false);

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
        })
        .finally(() => {
          if (!cancelled) setSettled(true);
        });

    read();
    const unsubscribe = onBuddyPathChanged(read);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { path, settled };
}
