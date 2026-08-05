import { createContext } from "react";
import type { CelebrationInput } from "./types.ts";

/**
 * Shape of the moments context.
 *
 * "Moments" are the deliberately non-functional beats of the app: the launch
 * sequence after signing in, and the celebrations that mark real progress.
 * Nothing here is load-bearing — every moment is skippable, and the whole layer
 * collapses to nothing when the user prefers reduced motion.
 */
export interface MomentsContextValue {
    /**
     * Queues a celebration overlay. Safe to call from anywhere in the tree;
     * overlapping calls are shown one after another rather than stacking.
     */
    celebrate: (input: CelebrationInput) => void;
    /**
     * Sends a rocket streaking across the screen. For small, frequent wins — a
     * step completed — where a card would be an interruption. Never blocks, and
     * repeat calls while one is in flight are ignored rather than queued.
     */
    flyby: () => void;
    /**
     * Plays the full mission-complete sequence: the once-per-person finale for
     * finishing the whole onboarding path. Everything else is tuned to stay
     * quieter than this.
     */
    completeMission: () => void;
    /**
     * Launches the rocket off Earth and hands over to the page underneath. For
     * the first time someone opens a finished onboarding path — whether they
     * watched it being generated or it was waiting for them when they arrived.
     *
     * Takes nothing and shows no copy: it is a transition onto the path, not a
     * message about it. Deciding *whether* this is that first time is the
     * caller's job (see `usePathRevealMoment`); this only plays it.
     */
    revealPath: () => void;
    /**
     * Plays the arcing launch sequence.
     *
     * No longer fires on boot — that is the CSS splash in `index.html`, which
     * is the only thing that can cover a load that starts before this bundle
     * and survives Keycloak's silent-SSO redirect. This is left for on-demand
     * use (dev tools today).
     */
    playLaunchSequence: () => void;
    /** True while the launch sequence covers the screen. */
    isLaunching: boolean;
}

/**
 * Context for the app's celebratory layer.
 * Should be accessed via the `useMoments` hook.
 */
export const MomentsContext = createContext<MomentsContextValue | undefined>(
    undefined,
);
