import { useEffect, useRef } from "react";
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
 * Plays the launch the first time someone sees a finished onboarding path.
 *
 * Both ways in are the same case here, which is why this hangs off the loaded
 * path rather than off the generator finishing: it fires whether the user
 * watched their path being built or it was generated earlier and they are only
 * now opening onboarding.
 *
 * Pass `null` while the page is loading, generating or in error — the reveal
 * belongs on a path that is actually on screen behind it.
 *
 * Guarded twice against replaying: `localStorage` across sessions, and a ref
 * for this mount, because the page re-fetches the path in place after a
 * knowledge check and would otherwise hand over a new object for the same path.
 */
export function usePathRevealMoment(path: OnboardingPathEndpoint | null): void {
    const { revealPath } = useMoments();
    const revealedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!path) return;
        if (revealedRef.current === path.id) return;
        if (readRevealedPathId() === path.id) return;
        if (!isPathUntouched(path)) return;

        // Marked before playing, not after: the reveal is dismissed by the user
        // and there is no guarantee they ever get round to it — closing the tab
        // mid-animation still counts as having been shown it.
        revealedRef.current = path.id;
        markRevealed(path.id);

        revealPath();
    }, [path, revealPath]);
}
