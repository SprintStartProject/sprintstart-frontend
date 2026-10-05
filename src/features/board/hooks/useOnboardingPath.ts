import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../services/apiClient";
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
 *
 * **A failed re-read keeps the last good path.** `fetchPath` throws both when there is no path (404)
 * and when a request simply failed, and treating the second like the first threw the whole board
 * into its "no path" state on one flaky request: "Behind you" emptied into the board, the path card
 * vanished and every "Back to …" was hidden. So only a 404 means "none"; any other failure leaves
 * whatever was known, including "not known yet".
 *
 * **Only the newest read counts.** Two "path changed" signals in a row start two reads, and they can
 * answer in either order; an answer to a read that has since been superseded is dropped, so an
 * older path never overwrites a newer one.
 */
export function useOnboardingPath(): { path: OnboardingPathEndpoint | null; settled: boolean } {
  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);
  /**
   * Whether the path has been asked for and answered at least once. Null before that means "not
   * known yet"; null after it means "there is none" — the difference between leaving a card's way
   * back alone and hiding one that leads nowhere.
   */
  const [settled, setSettled] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const read = () => {
      const request = ++latest.current;
      const current = () => !cancelled && request === latest.current;

      void onboardingService
        .fetchPath()
        .then((next) => {
          if (!current()) return;
          setPath(next);
          setSettled(true);
        })
        .catch((error: unknown) => {
          if (!current()) return;
          // No path at all: an ordinary answer, and a settled one. Anything else is no answer:
          // keep what was there, and if nothing ever was, the path stays "not known yet" rather
          // than "none" — so nothing that depends on knowing hides itself over a failed request.
          if (error instanceof ApiError && error.status === 404) {
            setPath(null);
            setSettled(true);
          }
        });
    };

    read();
    const unsubscribe = onBuddyPathChanged(read);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { path, settled };
}
