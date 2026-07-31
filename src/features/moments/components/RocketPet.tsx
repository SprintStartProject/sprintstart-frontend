import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { headingOf, loopFlight } from "../loopFlight.ts";
import {
    flightEaseToken,
    hoverSpringToken,
    idleDriftToken,
} from "../../../styles/tokens.ts";

const LAUNCH_COUNT_KEY = "rocketLaunchCount";

/** Flight vector from the perch, in viewport units: up and to the left. */
const FLIGHT_X_VW = -84;
const FLIGHT_Y_VH = -72;

/** One loop-the-loop partway along the climb. */
const LOOP = loopFlight(54, headingOf(FLIGHT_X_VW, FLIGHT_Y_VH));

/** Reads the persisted launch tally, tolerating a disabled/blocked localStorage. */
function readLaunchCount(): number {
    try {
        const raw = window.localStorage.getItem(LAUNCH_COUNT_KEY);
        const parsed = Number.parseInt(raw ?? "", 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (error) {
        console.warn("Failed to read rocket launch count", error);
        return 0;
    }
}

function persistLaunchCount(next: number) {
    try {
        window.localStorage.setItem(LAUNCH_COUNT_KEY, String(next));
    } catch (error) {
        console.warn("Failed to persist rocket launch count", error);
    }
}

/**
 * A little rocket perched in the bottom-right corner. Clicking it launches it
 * across the screen — nose-first, with a couple of flips on the way — and it
 * comes back to its perch a moment later.
 *
 * It does nothing. That is the point — it is the one place in the app that
 * exists purely because someone cared. Kept deliberately quiet: dimmed until
 * hovered, below every modal in the stacking order, hidden on small viewports
 * where corner space is scarce, and inert (a single friendly wiggle, no flight)
 * for users who prefer reduced motion.
 */
export function RocketPet() {
    const reduceMotion = useReducedMotion();
    const [isFlying, setIsFlying] = useState(false);
    const [isWiggling, setIsWiggling] = useState(false);
    const [launchCount, setLaunchCount] = useState(readLaunchCount);

    const handleLaunch = useCallback(() => {
        if (isFlying) return;

        const next = readLaunchCount() + 1;
        setLaunchCount(next);
        persistLaunchCount(next);

        if (reduceMotion) {
            setIsWiggling(true);
            return;
        }
        setIsFlying(true);
    }, [isFlying, reduceMotion]);

    return (
        <>
            <div className="pointer-events-none fixed bottom-5 right-5 z-30 hidden sm:block">
                <motion.button
                    type="button"
                    onClick={handleLaunch}
                    aria-label={
                        launchCount > 0
                            ? `Launch the rocket (launched ${launchCount} times)`
                            : "Launch the rocket"
                    }
                    title="Go on, launch it"
                    className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-subtle shadow-sm transition-colors hover:border-app-brand-border-strong hover:text-app-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                    animate={
                        isWiggling
                            ? { rotate: [0, -12, 10, -6, 0] }
                            : reduceMotion
                              ? { opacity: 0.6 }
                              : { y: [0, -3, 0], opacity: isFlying ? 0 : 0.6 }
                    }
                    transition={
                        isWiggling
                            ? { duration: 0.5 }
                            : reduceMotion
                              ? { duration: 0 }
                              : idleDriftToken
                    }
                    onAnimationComplete={() => setIsWiggling(false)}
                    whileHover={reduceMotion ? undefined : { scale: 1.12, opacity: 1 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                >
                    <RocketGlyph size={24} />
                </motion.button>
            </div>

            <AnimatePresence>
                {isFlying && (
                    <motion.div
                        key="rocket-flight"
                        aria-hidden="true"
                        className="pointer-events-none fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center"
                        initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                        animate={{
                            x: `${FLIGHT_X_VW}vw`,
                            y: `${FLIGHT_Y_VH}vh`,
                            scale: [1, 1.35, 0.45],
                            opacity: [1, 1, 0],
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ ...flightEaseToken, times: [0, 0.55, 1] }}
                        onAnimationComplete={() => setIsFlying(false)}
                    >
                        {/* The loop rides on an inner element, so it adds a
                            circular detour to the travel transform above rather
                            than replacing it. Linear easing keeps the circle
                            round — easing it would flatten two of its sides. */}
                        <motion.div
                            className="flex items-center justify-center text-app-brand-text"
                            style={{ filter: "drop-shadow(0 0 14px var(--brand-glow))" }}
                            initial={{ x: 0, y: 0, rotate: LOOP.rotate[0] }}
                            animate={{ x: LOOP.x, y: LOOP.y, rotate: LOOP.rotate }}
                            transition={{
                                duration: flightEaseToken.duration,
                                times: LOOP.times,
                                ease: "linear",
                            }}
                        >
                            <RocketGlyph size={44} flame />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tally, shown briefly after a launch. A tiny "someone counted" wink. */}
            <AnimatePresence>
                {isFlying && launchCount > 1 && (
                    <motion.span
                        key="rocket-tally"
                        aria-hidden="true"
                        className="pointer-events-none fixed bottom-[80px] right-5 z-30 rounded-full border border-app-border bg-app-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-app-text-subtle shadow-sm"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={hoverSpringToken}
                    >
                        launch #{launchCount}
                    </motion.span>
                )}
            </AnimatePresence>
        </>
    );
}
