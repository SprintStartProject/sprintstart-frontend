/**
 * How loud a celebration should be.
 *
 * The tone drives confetti volume, badge colour and copy weight, so callers
 * describe *what happened* and never hand-tune the animation themselves — that
 * is what keeps two different celebrations feeling like the same product.
 */
export type MomentTone = "success" | "milestone" | "triumph";

/** A celebration waiting to be shown, or currently on screen. */
export interface Celebration {
    /** Stable key for React and for de-duplicating rapid repeat triggers. */
    id: string;
    /**
     * Re-seeds the confetti spread so two celebrations in a row don't produce
     * an identical burst. Assigned by the provider, not by callers.
     */
    seed: number;
    tone: MomentTone;
    /** Headline. Short — this is a moment, not a dialog. */
    title: string;
    /** One sentence on what the user just achieved and what it unlocked. */
    message: string;
    /** Overrides the dismiss button label (defaults per tone). */
    actionLabel?: string;
}

/** What callers pass to `celebrate` — id and seed are assigned by the provider. */
export type CelebrationInput = Omit<Celebration, "id" | "seed">;
