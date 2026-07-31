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
