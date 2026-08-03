import { motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { SleepStage } from "../hooks/useIdleSleep";

interface BotGlyphProps {
    /** Edge length in px. The glyph is square and reads down to ~15px. */
    size?: number;
    stage: SleepStage;
    /** True for the brief startled beat right after waking. */
    isWaking?: boolean;
    className?: string;
}

/** How each eye behaves per stage. `scaleY` of 1 is wide open, 0.07 is shut. */
interface EyeBehaviour {
    keyframes: number[];
    transition: Transition;
}

const EYE: Record<SleepStage, EyeBehaviour> = {
    // Occasional quick blink. Long gaps on purpose — a bot that blinks
    // constantly reads as twitchy rather than alive.
    awake: {
        keyframes: [1, 1, 0.07, 1],
        transition: { duration: 0.22, times: [0, 0.4, 0.7, 1], repeat: Infinity, repeatDelay: 4.2 },
    },
    // Falling asleep is sold by the *blink*, not by the lid: eyes rest lower,
    // then close more often and stay shut longer each time. A lid sinking
    // steadily over thirty seconds just looks broken.
    drowsy: {
        keyframes: [0.55, 0.06, 0.06, 0.55],
        transition: { duration: 0.9, times: [0, 0.25, 0.75, 1], repeat: Infinity, repeatDelay: 1.1 },
    },
    asleep: {
        keyframes: [0.07],
        transition: { duration: 0.45 },
    },
};

/**
 * The chat assistant, drawn rather than borrowed from the icon set.
 *
 * `lucide-react`'s `Bot` cannot be made to fall asleep: an outline glyph has no
 * separately addressable eyes, so there is nothing to close. This one keeps the
 * same silhouette — antenna, boxy head, side nubs — but builds the face out of
 * parts that can be animated independently.
 *
 * The body is `currentColor`, so callers pick the colour with a text class. The
 * face plate uses the surface token so the eyes read as sitting on a screen in
 * both themes, and the antenna bulb borrows the rocket's warm accent, which is
 * what ties the two characters together as belonging to the same app.
 */
export function BotGlyph({ size = 24, stage, isWaking = false, className }: BotGlyphProps) {
    const reduceMotion = useReducedMotion();
    const asleep = stage === "asleep";

    /**
     * The startle: a jolt off the ground, an overshoot past upright, and a
     * wobble into place.
     *
     * Scaled to `size` so the hop is proportional — a fixed pixel jump reads as
     * a twitch at 44px and as the bot leaving the building at 15px. The squash
     * on the way back down is what sells it as weight rather than as a slide;
     * without it the whole thing looks like the icon was nudged.
     */
    const startle =
        isWaking && !reduceMotion
            ? {
                  rotate: [7, -7, 2, 0],
                  y: [0, -size * 0.16, size * 0.03, 0],
                  scale: [1, 1.16, 0.95, 1],
              }
            : null;

    // Startled: eyes snap wider than normal before settling. This is the whole
    // "wait, what?" beat, and it only reads if it overshoots.
    const eyeAnimation = isWaking
        ? { scaleY: [1.45, 1] }
        : { scaleY: reduceMotion ? [EYE[stage].keyframes.at(-1) ?? 1] : EYE[stage].keyframes };

    const eyeTransition: Transition = isWaking
        ? { duration: 0.45, ease: "easeOut" }
        : reduceMotion
          ? { duration: 0 }
          : EYE[stage].transition;

    return (
        <motion.svg
            width={size}
            height={size}
            // Shifted window, not shifted artwork: the bot spans y 0.35 to 17.9,
            // so a plain 0 0 24 24 box hangs it from the ceiling with six units
            // of dead space underneath. Moving the viewBox centres it while
            // leaving every coordinate — and every transform-origin below —
            // exactly where it was.
            viewBox="0 -2.9 24 24"
            fill="none"
            className={className}
            aria-hidden="true"
            animate={startle ?? { rotate: asleep && !reduceMotion ? 7 : 0, y: 0, scale: 1 }}
            transition={
                startle
                    ? { duration: 0.5, times: [0, 0.22, 0.55, 1], ease: "easeOut" }
                    : { duration: 0.6, ease: "easeOut" }
            }
            // Percentages, not px. On SVG *children* a px transform-origin is
            // read in viewBox units, but on the root <svg> it is read in real
            // CSS pixels — so a fixed "12px 18px" pivots the head somewhere
            // different at every size the bot is rendered at. 87% is where the
            // old value landed in user space, once the shifted viewBox is
            // accounted for: the base of the head, which is what it should
            // pivot around.
            style={{ transformOrigin: "50% 87%" }}
        >
            {/* Antenna. Droops with the head rather than staying at attention. */}
            <motion.g
                style={{ transformOrigin: "12px 4.2px" }}
                animate={{ rotate: asleep && !reduceMotion ? -16 : 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                <path
                    d="M12 4.2V2.4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <motion.circle
                    cx="12"
                    cy="1.6"
                    r="1.25"
                    className="fill-app-orange-text"
                    // The status light is the quietest tell of all: full, dim,
                    // out. Readable even at 15px where the eyes are two pixels.
                    animate={{
                        opacity: isWaking ? 1 : stage === "awake" ? 1 : stage === "drowsy" ? 0.45 : 0.15,
                    }}
                    transition={{ duration: 0.5 }}
                />
            </motion.g>

            {/* Side nubs */}
            <rect x="1.3" y="9.3" width="1.9" height="4.6" rx="0.95" fill="currentColor" opacity="0.6" />
            <rect x="20.8" y="9.3" width="1.9" height="4.6" rx="0.95" fill="currentColor" opacity="0.6" />

            {/* Head */}
            <rect x="3.5" y="4.2" width="17" height="13.7" rx="4.3" fill="currentColor" />

            {/* Face plate, knocked out of the head so the eyes sit on a screen. */}
            <rect x="6" y="7.3" width="12" height="7.8" rx="3" className="fill-app-surface" />
            <rect x="6" y="7.3" width="12" height="7.8" rx="3" fill="currentColor" opacity="0.12" />

            {[9.4, 14.6].map((cx) => (
                <motion.circle
                    key={cx}
                    cx={cx}
                    cy="10.6"
                    r="1.45"
                    fill="currentColor"
                    style={{ transformOrigin: `${cx}px 10.6px` }}
                    animate={eyeAnimation}
                    transition={eyeTransition}
                />
            ))}

            {/* Mouth. Flat while awake, a small open "o" when startled. */}
            <motion.rect
                x="10.3"
                y="13"
                width="3.4"
                height="0.85"
                rx="0.42"
                fill="currentColor"
                opacity="0.55"
                style={{ transformOrigin: "12px 13.4px" }}
                animate={{ scaleY: isWaking ? 2.2 : 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            />
        </motion.svg>
    );
}
