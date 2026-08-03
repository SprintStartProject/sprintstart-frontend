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
    /** Replays the launch sequence (used by the post-login trigger and dev tools). */
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
