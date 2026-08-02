import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { launchGeometry } from "../flightGeometry.ts";
import { FLIGHT_DURATION_S, flightEaseToken } from "../../../styles/tokens.ts";

interface LaunchSequenceProps {
    /** Greeted by name when the profile is loaded; falls back to the wordmark alone. */
    displayName?: string;
    /** Called when the sequence finishes, or when the user skips it. */
    onDone: () => void;
}

/** Total runtime before the overlay hands over to the app, in seconds. */
const HOLD = 1.85;

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
    // Resolved once: the sequence is over in under three seconds, so a resize
    // mid-flight is not worth re-deriving for.
    const { padX, padY, rocketSize, trailLength, trailAngle, flight } = useMemo(
        () => launchGeometry(window.innerWidth, window.innerHeight),
        [],
    );

    // Any key skips. Someone who has seen it forty times should never wait.
    // Pointers are handled on the overlay itself rather than on `document`: it
    // has to *swallow* the click, not just react to it. While this is up the
    // app underneath is invisible, and nobody should be able to press a button
    // they cannot see.
    useEffect(() => {
        const skip = () => onDone();
        document.addEventListener("keydown", skip);
        return () => document.removeEventListener("keydown", skip);
    }, [onDone]);

    return createPortal(
        <motion.div
            aria-hidden="true"
            onPointerDown={onDone}
            className="fixed inset-0 z-[90] overflow-hidden bg-app-bg"
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
                className="absolute h-3 w-3 rounded-full"
                style={{
                    left: padX,
                    top: padY,
                    background:
                        "radial-gradient(circle, var(--progress-fill-end) 0%, var(--brand) 40%, transparent 70%)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 16, 70], opacity: [0, 0.75, 0] }}
                transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Exhaust trail. Grows along the flight line, then burns out.
                Stops at the length of the flight itself — running it to the far
                edge draws a streak to somewhere the rocket never went. */}
            <motion.div
                className="absolute h-[3px] origin-left rounded-full"
                style={{
                    left: padX,
                    top: padY,
                    rotate: trailAngle,
                    background:
                        "linear-gradient(90deg, transparent, var(--brand) 30%, var(--progress-fill-end))",
                    boxShadow: "0 0 26px 3px var(--brand-glow)",
                }}
                initial={{ width: 0, opacity: 0 }}
                animate={{
                    width: [0, trailLength * 0.62, trailLength],
                    opacity: [0, 0.9, 0],
                }}
                transition={{ ...flightEaseToken, delay: 0.25 }}
            />

            {/* One element, one transform: travel and loop are a single curve,
                so there is nothing to layer. Linear playback on purpose — the
                easing is already baked into the keyframes, and easing them again
                would ripple the curve. */}
            <motion.div
                className="absolute flex items-center justify-center text-app-brand"
                style={{
                    left: padX,
                    top: padY,
                    filter: "drop-shadow(0 0 22px var(--brand-glow))",
                }}
                initial={{ x: 0, y: 60, rotate: flight.rotate[0], scale: 0.5, opacity: 0 }}
                animate={{
                    x: flight.x,
                    y: flight.y,
                    rotate: flight.rotate,
                    scale: flight.progress.map((s) => 0.5 + 0.55 * Math.min(1, s * 4)),
                    opacity: flight.progress.map((s) => Math.min(1, s * 6)),
                }}
                transition={{
                    duration: FLIGHT_DURATION_S,
                    delay: 0.25,
                    times: flight.times,
                    ease: "linear",
                }}
            >
                <RocketGlyph size={rocketSize} flame />
            </motion.div>

            <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
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
                <span className="text-3xl font-bold tracking-tight text-app-text sm:text-4xl">
                    SprintStart
                </span>
                {/* Wide tracking plus a long first name overflows a 360px phone
                    on one line, and the wordmark has no container to clip it. */}
                <span className="mt-2 max-w-full text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-subtle sm:text-xs sm:tracking-[0.24em]">
                    {displayName ? `Welcome back, ${displayName}` : "Mission ready"}
                </span>
            </motion.div>
        </motion.div>,
        document.body,
    );
}
