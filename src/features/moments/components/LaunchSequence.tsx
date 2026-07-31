import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { headingOf, loopFlight } from "../loopFlight.ts";
import { flightEaseToken } from "../../../styles/tokens.ts";

interface LaunchSequenceProps {
    /** Greeted by name when the profile is loaded; falls back to the wordmark alone. */
    displayName?: string;
    /** Called when the sequence finishes, or when the user skips it. */
    onDone: () => void;
}

/** Total runtime before the overlay hands over to the app, in seconds. */
const HOLD = 1.85;

/** Flight vector across the screen, in viewport units: up and to the right. */
const FLIGHT_X_VW = 78;
const FLIGHT_Y_VH = -64;

/** One loop-the-loop partway across, sized for the bigger 64px rocket. */
const LOOP = loopFlight(78, headingOf(FLIGHT_X_VW, FLIGHT_Y_VH));

/**
 * The post-sign-in launch sequence.
 *
 * A rocket arcs across the screen, the wordmark resolves, and the overlay then
 * rushes past the viewer — the app is revealed by being flown *through* rather
 * than faded to.
 *
 * Two deliberate constraints:
 * - It never gates anything. The app is already mounted and interactive
 *   underneath; this only covers it. Any click, key or Escape skips instantly.
 * - The overlay does not transform its ancestors. A `transform` on a wrapper
 *   would become the containing block for every `position: fixed` descendant
 *   and silently break modals and drawers, so all motion stays inside here.
 */
export function LaunchSequence({ displayName, onDone }: LaunchSequenceProps) {
    // Any input skips. Someone who has seen it forty times should never wait.
    useEffect(() => {
        const skip = () => onDone();
        document.addEventListener("keydown", skip);
        document.addEventListener("pointerdown", skip);
        return () => {
            document.removeEventListener("keydown", skip);
            document.removeEventListener("pointerdown", skip);
        };
    }, [onDone]);

    return createPortal(
        <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[90] overflow-hidden bg-app-bg"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: [1, 1, 0], scale: [1, 1, 1.7] }}
            transition={{
                duration: HOLD + 0.55,
                times: [0, HOLD / (HOLD + 0.55), 1],
                ease: [0.5, 0, 0.75, 0],
            }}
            onAnimationComplete={onDone}
        >
            {/* Ignition bloom at the launch pad. */}
            <motion.div
                className="absolute left-[8%] top-[78%] h-3 w-3 rounded-full"
                style={{
                    background:
                        "radial-gradient(circle, var(--progress-fill-end) 0%, var(--brand) 40%, transparent 70%)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 16, 70], opacity: [0, 0.75, 0] }}
                transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Exhaust trail. Grows along the flight line, then burns out. */}
            <motion.div
                className="absolute left-[8%] top-[78%] h-[3px] origin-left rounded-full"
                style={{
                    rotate: -40,
                    background:
                        "linear-gradient(90deg, transparent, var(--brand) 30%, var(--progress-fill-end))",
                    boxShadow: "0 0 26px 3px var(--brand-glow)",
                }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: ["0vw", "62vw", "96vw"], opacity: [0, 0.9, 0] }}
                transition={{ ...flightEaseToken, delay: 0.25 }}
            />

            <motion.div
                className="absolute left-[8%] top-[78%] flex items-center justify-center"
                initial={{ x: 0, y: 60, scale: 0.5, opacity: 0 }}
                animate={{
                    x: `${FLIGHT_X_VW}vw`,
                    y: `${FLIGHT_Y_VH}vh`,
                    scale: 1.05,
                    opacity: [0, 1, 1],
                }}
                transition={{ ...flightEaseToken, delay: 0.25 }}
            >
                {/* The loop rides on an inner element, so it adds a circular
                    detour to the travel transform above rather than replacing
                    it. Linear easing keeps the circle round — easing it would
                    flatten two of its sides. */}
                <motion.div
                    className="flex items-center justify-center text-app-brand"
                    style={{ filter: "drop-shadow(0 0 22px var(--brand-glow))" }}
                    initial={{ x: 0, y: 0, rotate: LOOP.rotate[0] }}
                    animate={{ x: LOOP.x, y: LOOP.y, rotate: LOOP.rotate }}
                    transition={{
                        duration: flightEaseToken.duration,
                        delay: 0.25,
                        times: LOOP.times,
                        ease: "linear",
                    }}
                >
                    <RocketGlyph size={64} flame />
                </motion.div>
            </motion.div>

            <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
                initial={{ opacity: 0, y: 14, scale: 0.97, filter: "blur(6px)" }}
                animate={{
                    opacity: [0, 1, 1, 0],
                    y: [14, 0, 0, 0],
                    scale: [0.97, 1, 1, 1.03],
                    filter: ["blur(6px)", "blur(0px)", "blur(0px)", "blur(3px)"],
                }}
                transition={{
                    duration: 1.5,
                    delay: 0.45,
                    times: [0, 0.35, 0.72, 1],
                    ease: "easeOut",
                }}
            >
                <span className="text-4xl font-bold tracking-tight text-app-text">
                    SprintStart
                </span>
                <span className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-app-text-subtle">
                    {displayName ? `Welcome back, ${displayName}` : "Mission ready"}
                </span>
            </motion.div>
        </motion.div>,
        document.body,
    );
}
