import { motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { SleepStage } from "../hooks/useIdleSleep";
import type { Gaze } from "../hooks/usePointerGaze";

/**
 * What the bot is doing.
 *
 * The idle stages come from `useIdleSleep`; the other two are driven by what the
 * assistant is actually up to and are never reached by sitting still.
 */
export type BotState = SleepStage | "thinking" | "cheering" | "dizzy";

interface BotGlyphProps {
    /** Edge length in px. The glyph is square and reads down to ~15px. */
    size?: number;
    state: BotState;
    /** True for the brief startled beat right after waking. */
    isWaking?: boolean;
    /**
     * Pupil offset, in viewBox units, for following the pointer. Applied only
     * while awake — the other states already have the eyes doing something, and
     * a bot that tracks the cursor in its sleep is just a bot that is awake.
     */
    gaze?: Gaze;
    /**
     * Starstruck: eyes held wide, mouth a round little "o". For the beat while
     * a rocket crosses the screen and the gaze is glued to it. Only read while
     * awake — the other states have their own faces, and an astonished
     * expression on a sleeping bot is a bot having a nightmare.
     */
    awed?: boolean;
    className?: string;
}

/** How each eye behaves per state. `scaleY` of 1 is wide open, 0.07 is shut. */
interface EyeBehaviour {
    keyframes: number[];
    transition: Transition;
}

const EYE: Record<BotState, EyeBehaviour> = {
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
    // Narrowed rather than closed — concentrating, not dozing. The glancing
    // about is what actually sells thinking, and that rides on `EYE_DRIFT`.
    thinking: {
        keyframes: [0.8],
        transition: { duration: 0.3 },
    },
    // Wide open. Squinting with joy would be the other classic read, but at this
    // size a squint is indistinguishable from a bot falling asleep.
    cheering: {
        keyframes: [1.15],
        transition: { duration: 0.25 },
    },
    // Held wide the whole time. Blinking would break the roll, and the roll is
    // the part that reads as "the room is spinning".
    dizzy: {
        keyframes: [1],
        transition: { duration: 0.2 },
    },
};

/**
 * Pupils rolling in a circle. Both eyes go round together rather than
 * independently — crossed eyes are the other cartoon shorthand for dizzy, but
 * at 44px two pupils meeting in the middle just looks like a rendering fault.
 *
 * Three laps at close to the limit of the socket: the pupils sit 1.45 across on
 * a plate running 6 to 18, leaving a little under two units of clearance either
 * side, so 1.15 swings them nearly to the bezel without clipping through it.
 */
const EYE_ROLL = {
    x: [0, 1.15, 0, -1.15, 0, 1.15, 0, -1.15, 0, 1.15, 0, -1.15, 0],
    y: [-0.85, 0, 0.85, 0, -0.85, 0, 0.85, 0, -0.85, 0, 0.85, 0, -0.85],
};

/**
 * The stagger: three wide sways, then a fast shake to snap out of it.
 *
 * One keyframe track rather than two animations back to back, so the shake
 * starts from wherever the sway left the head instead of jumping to centre
 * first.
 */
const DIZZY_SWAY = {
    rotate: [0, -10, 9, -8, 7, -5, 4, -3, 2, 0],
    times: [0, 0.12, 0.28, 0.44, 0.58, 0.68, 0.76, 0.84, 0.92, 1],
};

/** How long the whole dizzy beat runs, in seconds. */
export const DIZZY_DURATION_S = 1.5;

/**
 * Where the eyes wander while thinking, in viewBox units.
 *
 * Up and to one side, then the other, then back — the direction people look
 * when they are working something out rather than reading it off a screen. Kept
 * under a unit of travel: the pupils sit on a 12-unit face plate, and anything
 * larger has them leaving it.
 */
const EYE_DRIFT = {
    x: [0, -0.75, 0.75, 0],
    y: [0, -0.55, -0.55, 0],
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
export function BotGlyph({
    size = 24,
    state,
    isWaking = false,
    gaze,
    awed = false,
    className,
}: BotGlyphProps) {
    const reduceMotion = useReducedMotion();
    const asleep = state === "asleep";
    const thinking = state === "thinking" && !reduceMotion;
    const cheering = state === "cheering" && !reduceMotion;
    const dizzy = state === "dizzy" && !reduceMotion;
    const isAwed = awed && state === "awake" && !isWaking;

    // Gaze rides on `style` as motion values while every other eye movement is
    // an `animate` keyframe. The two cannot both own x/y, so the tracking is
    // dropped for any state that already moves the pupils.
    const isTracking = Boolean(gaze) && state === "awake" && !isWaking;

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

    /**
     * A little hop, on a loop, plus a wiggle. Faster and shallower than the
     * startle: that one is a single shock, this has to stay watchable for as
     * long as a game of dino lasts.
     */
    const cheer = cheering
        ? {
              rotate: [-5, 5, -5],
              y: [0, -size * 0.09, 0],
              scale: [1, 1.05, 1],
          }
        : null;

    // Startled: eyes snap wider than normal before settling. This is the whole
    // "wait, what?" beat, and it only reads if it overshoots.
    //
    // Awed: held wide with no blink loop — nobody blinks at a rocket. Distinct
    // from the startle, which overshoots and settles; awe just stays.
    const eyeAnimation = isWaking
        ? { scaleY: [1.45, 1] }
        : isAwed
          ? { scaleY: [1.3] }
          : {
                scaleY: reduceMotion ? [EYE[state].keyframes.at(-1) ?? 1] : EYE[state].keyframes,
                ...(thinking
                    ? EYE_DRIFT
                    : dizzy
                      ? EYE_ROLL
                      : isTracking
                        ? {}
                        : { x: 0, y: 0 }),
            };

    const eyeTransition: Transition = isWaking
        ? { duration: 0.45, ease: "easeOut" }
        : isAwed
          ? { duration: 0.25, ease: "easeOut" }
          : reduceMotion
            ? { duration: 0 }
            : thinking
            ? {
                  ...EYE[state].transition,
                  x: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
                  y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
              }
            : dizzy
              ? {
                    ...EYE[state].transition,
                    // Two full rolls inside the beat, easing out as the head
                    // settles — the spin slows down with the bot, not on its
                    // own clock.
                    x: { duration: DIZZY_DURATION_S, ease: "easeOut" },
                    y: { duration: DIZZY_DURATION_S, ease: "easeOut" },
                }
              : EYE[state].transition;

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
            // The startle wins over the cheer: waking up is a one-off beat, and
            // an interrupted loop can pick up again straight after.
            animate={
                startle ??
                (dizzy ? { rotate: DIZZY_SWAY.rotate, y: 0, scale: 1 } : null) ??
                cheer ?? { rotate: asleep && !reduceMotion ? 7 : 0, y: 0, scale: 1 }
            }
            transition={
                startle
                    ? { duration: 0.5, times: [0, 0.22, 0.55, 1], ease: "easeOut" }
                    : dizzy
                      ? {
                            duration: DIZZY_DURATION_S,
                            times: DIZZY_SWAY.times,
                            ease: "easeOut",
                        }
                      : cheer
                        ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
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
                    // out — and a pulse while it is working. Readable even at
                    // 15px, where the eyes are barely two pixels across.
                    animate={
                        thinking
                            ? { opacity: [1, 0.2, 1] }
                            : {
                                  opacity: isWaking || cheering
                                      ? 1
                                      : state === "awake"
                                        ? 1
                                        : state === "drowsy"
                                          ? 0.45
                                          : state === "asleep"
                                            ? 0.15
                                            : 1,
                              }
                    }
                    transition={
                        thinking
                            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.5 }
                    }
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
                    style={{
                        transformOrigin: `${cx}px 10.6px`,
                        ...(isTracking ? { x: gaze?.x, y: gaze?.y } : {}),
                    }}
                    animate={eyeAnimation}
                    transition={eyeTransition}
                />
            ))}

            {/* Mouth. Flat by default, a small open "o" when startled, and
                shouting on a loop while cheering — the mouth doing the work is
                what keeps the cheer readable at 30px, where a bouncing body
                alone could just as well be a loading spinner. */}
            {isAwed ? (
                // Awe gets its own round mouth rather than a scaled-up bar: a
                // rect stretched tall enough to gape stops reading as a mouth
                // and starts reading as a slot. Swapped, not morphed — the pop
                // from flat to "ooo" *is* the take.
                <motion.ellipse
                    data-testid="bot-awe-mouth"
                    cx="12"
                    cy="13.55"
                    rx="0.95"
                    ry="1.05"
                    fill="currentColor"
                    opacity="0.55"
                    style={{ transformOrigin: "12px 13.55px" }}
                    initial={reduceMotion ? false : { scale: 0.3 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                />
            ) : (
                <motion.rect
                    x="10.3"
                    y="13"
                    width="3.4"
                    height="0.85"
                    rx="0.42"
                    fill="currentColor"
                    opacity="0.55"
                    style={{ transformOrigin: "12px 13.4px" }}
                    animate={{
                        scaleY: cheering ? [1, 2.8, 1] : isWaking ? 2.2 : 1,
                    }}
                    transition={
                        cheering
                            ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.4, ease: "easeOut" }
                    }
                />
            )}
        </motion.svg>
    );
}
