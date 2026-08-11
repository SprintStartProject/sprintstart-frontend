import { useLayoutEffect, useRef } from "react";
import { useMoments } from "../../moments";
import type { OnboardingPathEndpoint } from "../types";

/**
 * Where the id of the last path a reveal has been played for is kept.
 *
 * Path ids are per user, so this needs no user in the key: signing in as
 * someone else on the same machine looks at a different id and reveals
 * correctly. It is deliberately *not* on the backend — nothing about whether an
 * animation has been watched is worth an API and a migration, and the failure
 * mode of losing it is seeing a three-second animation twice.
 */
const STORAGE_KEY = "sprintstart.onboarding.revealedPathId";

/** Tolerates a disabled or blocked localStorage (private mode, hardened browsers). */
function readRevealedPathId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to read the revealed onboarding path", error);
    return null;
  }
}

function markRevealed(pathId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, pathId);
  } catch (error) {
    console.warn("Failed to persist the revealed onboarding path", error);
  }
}

/**
 * Whether nobody has worked on this path yet.
 *
 * The second half of "first time": storage answers whether the reveal has been
 * *played*, and this answers whether it would still make sense to. Someone who
 * cleared their browser data halfway through onboarding should not be told
 * their path is ready when they are four steps into it.
 *
 * Phrased as "no evidence of progress" rather than "every step is WAITING" on
 * purpose. An unexpected status from the backend then reads as untouched and
 * the reveal still plays, which is the harmless direction to be wrong in — the
 * other way round, one renamed enum value silently removes the moment for
 * everybody and nothing ever reports it.
 */
function isPathUntouched(path: OnboardingPathEndpoint): boolean {
  return path.phases.every(
    (phase) =>
      !phase.checkSummary?.passed &&
      phase.steps.every(
        (step) =>
          step.startedAt === null &&
          step.completedAt === null &&
          step.status !== "IN_PROGRESS" &&
          step.status !== "FINISHED" &&
          step.status !== "SKIPPED",
      ),
  );
}

/**
 * Offers the launch the first time someone opens a finished onboarding path.
 *
 * Both ways in are the same case here, which is why this hangs off the loaded
 * path rather than off the generator finishing: it fires whether the user
 * watched their path being built or it was generated earlier and they are only
 * now opening onboarding.
 *
 * Pass `null` while the page is loading, generating or in error — the launch
 * belongs on a path that is actually on screen behind it.
 *
 * **Spent on launch, not on sight.** The rocket waits for the user to set it
 * off, and only that marks the path. Someone who opens onboarding, clicks
 * through to chat and comes back finds the rocket waiting again, because a
 * launch they never fired is not one they have had. The alternative — marking
 * when it is merely shown — turns a two-second detour into permanently missing
 * the one moment the path gets.
 *
 * The mount-scoped ref is separate from that: it stops a *second* offer inside
 * one visit, since the page re-fetches its path in place and would otherwise
 * hand over a new object for a path already on the pad.
 *
 * Runs as a layout effect so the overlay is committed in the same paint that
 * first shows the path. With a plain effect the browser paints the finished
 * page, *then* the rocket lands on top of it — a frame of the path flashing
 * out from behind its own launch, every time someone opens onboarding.
 */
export function usePathRevealMoment(path: OnboardingPathEndpoint | null): void {
  const { revealPath } = useMoments();
  const offeredRef = useRef<string | null>(null);
  const endLaunchRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!path) return;
    if (offeredRef.current === path.id) return;
    if (readRevealedPathId() === path.id) return;
    if (!isPathUntouched(path)) return;

    const pathId = path.id;
    offeredRef.current = pathId;

    endLaunchRef.current = revealPath({
      onLaunched: () => markRevealed(pathId),
    });
  }, [path, revealPath]);

  // The launch belongs to this page and ends when the page does — not when
  // the user clicks the sidebar. Those are not the same instant: the router
  // keeps the current view on screen while a navigation is pending, so
  // closing on the click uncovers the path for however long that takes,
  // which is the flash you get on the way out. Unmounting is exactly when
  // the new view takes over.
  //
  // Deliberately its own effect with no dependencies: putting the disposer
  // on the effect above would fire it whenever the path object changes
  // identity — a refetch would silently kill a launch still on the pad.
  //
  // A layout effect, so the teardown lands in the same commit as the page
  // swap. A passive one runs after the browser has painted, which leaves a
  // frame of the launch sitting on top of the view the user just moved to —
  // the same flash as before, only pointing the other way.
  useLayoutEffect(
    () => () => {
      endLaunchRef.current?.();
      endLaunchRef.current = null;
    },
    [],
  );
}
