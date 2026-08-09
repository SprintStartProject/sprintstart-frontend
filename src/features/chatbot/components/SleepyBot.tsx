import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { BotGlyph, DIZZY_DURATION_S } from "./BotGlyph";
import { useIdleSleep } from "../hooks/useIdleSleep";
import { usePointerGaze } from "../hooks/usePointerGaze";

interface SleepyBotProps {
    /** Edge length of the bot in px. */
    size?: number;
    /**
     * Whether the bot may fall asleep. Pass `false` while the assistant is
     * thinking or streaming — dozing off mid-answer reads as a hang, not a joke.
     */
    canSleep?: boolean;
    /**
     * Whether the eyes follow the pointer while awake.
     *
     * Off by default, and meant for the large bots only — the dashboard widget
     * and the empty chat. At the 30px of a message avatar the pupils are barely
     * two pixels across, so the tracking is invisible detail that still costs a
     * `pointermove` listener per row.
     */
    tracksPointer?: boolean;
    className?: string;
}

/** Points sampled around the stun orbit. More = rounder. */
const ORBIT_SAMPLES = 16;

/** Where each stun star starts on that orbit, as a fraction of a lap. */
const STUN_PHASES = [0, 1 / 3, 2 / 3];

/** Seconds per lap. Two laps fit inside the dizzy beat. */
const STUN_LAP_S = 0.75;

/**
 * Keyframes for one star circling the bot's head, offset by `phase`.
 *
 * The ellipse is wide and flat rather than round, which is what reads as an
 * orbit seen almost edge-on — a circular path looks like the stars are pinned
 * to the screen in front of the bot instead of going around behind it. `scale`
 * follows the same idea: smaller across the back half, larger across the front.
 */
function stunOrbit(radiusX: number, radiusY: number, phase: number) {
    const x: number[] = [];
    const y: number[] = [];
    const scale: number[] = [];

    for (let step = 0; step <= ORBIT_SAMPLES; step++) {
        const angle = (step / ORBIT_SAMPLES + phase) * Math.PI * 2;
        x.push(Number((Math.cos(angle) * radiusX).toFixed(2)));
        y.push(Number((Math.sin(angle) * radiusY).toFixed(2)));
        scale.push(Number((0.65 + 0.35 * (0.5 + 0.5 * Math.sin(angle))).toFixed(2)));
    }

    return { x, y, scale };
}

/**
 * The three Z's, smallest first, so they read as drifting away.
 *
 * `drift` is a multiple of the letter's own size rather than a pixel distance:
 * the type scales with the bot, and a fixed travel that looks right at 30px has
 * the letters piling on top of each other at 76px.
 */
const ZS = [
    { delay: 0, scale: 0.7, drift: 0.95 },
    { delay: 0.75, scale: 0.9, drift: 1.5 },
    { delay: 1.5, scale: 1.1, drift: 2 },
];

/**
 * The chat assistant, which nods off if left alone and wakes when you come back.
 *
 * Purely decorative — it is `aria-hidden` and announces nothing, because a
 * screen reader user has no idea there is a cartoon here and does not need a
 * running commentary on its eyelids. Clicking it wakes it, but so does typing
 * anywhere, so the click is a bonus rather than the way out. A press also
 * gets a little jump — direct, immediate proof that the click landed on the
 * bot — except when it is the one thing that wakes it up from properly
 * asleep, where the built-in startle already is that proof.
 *
 * Under `prefers-reduced-motion` the bot still falls asleep — the state is the
 * joke — but holds a static pose: no blinking, no drifting Z's.
 */
export function SleepyBot({
    size = 44,
    canSleep = true,
    tracksPointer = false,
    className,
}: SleepyBotProps) {
    const reduceMotion = useReducedMotion();
    const { stage, isWaking, wake } = useIdleSleep({ enabled: canSleep });
    const botRef = useRef<HTMLSpanElement>(null);
    const [isDizzy, setIsDizzy] = useState(false);
    const bounceControls = useAnimationControls();

    const handleOrbit = useCallback(() => {
        // Circling is unmistakably deliberate, so it counts as activity even
        // though plain pointer movement does not — it would be odd for the bot
        // to be made dizzy and then doze off mid-stagger.
        wake();
        setIsDizzy(true);
    }, [wake]);

    // Direct feedback for a plain press: waking up from asleep already gets
    // its own startle (jolt, overshoot, wobble) inside `BotGlyph`, but nothing
    // happens if you press an already-awake or drowsy bot — there is no state
    // transition for the eyes or antenna to react to. This is that reaction,
    // for exactly the presses the built-in startle does not cover.
    //
    // Lives on the wrapping span rather than as a `BotGlyph` prop: it is a
    // separate physical reaction on a separate element, the same reasoning
    // that already puts the dizzy stun-stars outside the glyph. Composes
    // cleanly with whatever `BotGlyph` is doing on its own root (blinking,
    // the dizzy spin) since the two never touch the same transform.
    //
    // `useAnimationControls` rather than a boolean+timeout: a second press
    // mid-bounce should restart the jump from wherever it currently is, not
    // queue behind the first one, which is exactly what `.start()` does when
    // called again on a component it already controls.
    const handlePress = useCallback(() => {
        wake();
        if (stage !== "asleep" && !reduceMotion) {
            // Same curve as `BotGlyph`'s wake startle — one physical vocabulary
            // for "the bot just noticed a press," reused rather than
            // reinvented, and safe to share since the two never fire together
            // (this is skipped exactly when that one is about to run).
            void bounceControls.start(
                { y: [0, -size * 0.16, size * 0.03, 0], scale: [1, 1.16, 0.95, 1] },
                { duration: 0.5, times: [0, 0.22, 0.55, 1], ease: "easeOut" },
            );
        }
    }, [wake, stage, reduceMotion, bounceControls, size]);

    // Tracking is off while dizzy: the roll drives the pupils through `animate`,
    // and the gaze drives them through `style`. Only one of the two can own them.
    // The same gaze also snaps to any rocket crossing the screen, and
    // `isWatchingRocket` is what turns the rest of the face along with it.
    const { gaze, isWatchingRocket } = usePointerGaze(
        botRef,
        tracksPointer && stage === "awake" && !isDizzy,
        handleOrbit,
    );

    useEffect(() => {
        if (!isDizzy) return;
        const timer = window.setTimeout(
            () => setIsDizzy(false),
            DIZZY_DURATION_S * 1000,
        );
        return () => window.clearTimeout(timer);
    }, [isDizzy]);

    const asleep = stage === "asleep";
    const zFontSize = Math.max(9, size * 0.36);
    const drift = (multiple: number) => multiple * zFontSize;

    return (
        <span className={`relative inline-flex ${className ?? ""}`}>
            {/* Not a button: it is decoration, and putting it in the tab order
                would hand keyboard users a control that does nothing they need.
                Pointer presses anywhere already wake it. */}
            <motion.span
                ref={botRef}
                onPointerDown={handlePress}
                className="inline-flex"
                animate={bounceControls}
            >
                <BotGlyph
                    size={size}
                    state={isDizzy ? "dizzy" : stage}
                    isWaking={isWaking}
                    gaze={tracksPointer ? gaze : undefined}
                    awed={isWatchingRocket}
                />
            </motion.span>

            {/* Comic stun stars, circling the head while the room spins.
                Rendered out here rather than inside the glyph so they can orbit
                *outside* its box — the viewBox has barely two units of headroom
                above the antenna, which is not an orbit, it is a hat. */}
            {isDizzy && !reduceMotion && (
                <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-0"
                    style={{ marginTop: -size * 0.16 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{
                        duration: DIZZY_DURATION_S,
                        times: [0, 0.12, 0.72, 1],
                    }}
                >
                    {STUN_PHASES.map((phase, index) => {
                        const orbit = stunOrbit(size * 0.44, size * 0.13, phase);

                        return (
                            <motion.span
                                key={index}
                                className="absolute rounded-full bg-app-orange-text"
                                style={{
                                    width: Math.max(3, size * 0.09),
                                    height: Math.max(3, size * 0.09),
                                }}
                                animate={orbit}
                                transition={{
                                    duration: STUN_LAP_S,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                            />
                        );
                    })}
                </motion.span>
            )}

            {/* Deliberately not wrapped in `AnimatePresence`. Its exit only
                completes once every descendant animation has settled, and these
                loop forever — so the Z's went on drifting out of a wide-awake
                bot for a good while after it woke. Waking should snap them off,
                which unmounting plainly does. */}
            {asleep && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-0 select-none font-semibold leading-none text-app-brand-text"
                    style={{ fontSize: zFontSize }}
                >
                    {ZS.map((z, index) => (
                        <motion.span
                            key={index}
                            className="absolute"
                            style={{ scale: z.scale }}
                            initial={{ opacity: 0, x: 0, y: 0 }}
                            animate={
                                reduceMotion
                                    ? { opacity: index === ZS.length - 1 ? 0.8 : 0 }
                                    : {
                                          opacity: [0, 0.9, 0],
                                          x: [0, drift(z.drift) * 0.6, drift(z.drift)],
                                          y: [0, -drift(z.drift), -drift(z.drift) * 1.9],
                                      }
                            }
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : {
                                          duration: 2.4,
                                          delay: z.delay,
                                          repeat: Infinity,
                                          repeatDelay: 0.3,
                                          ease: "easeOut",
                                      }
                            }
                        >
                            z
                        </motion.span>
                    ))}
                </span>
            )}
        </span>
    );
}
