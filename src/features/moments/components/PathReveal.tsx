import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { StarField } from "./StarField.tsx";
import { rocketSizeFor } from "../flightGeometry.ts";
import { flightEaseToken } from "../../../styles/tokens.ts";

interface PathRevealProps {
    /** Called when the launch is over, or as soon as the user skips it. */
    onDone: () => void;
}

/**
 * Beats of the launch, in order.
 *
 * One timer per beat rather than one long schedule: skipping mid-sequence then
 * cancels cleanly, and any beat can be retimed without recomputing the others.
 */
type Stage = "pad" | "ignition" | "ascent" | "departure";

const STAGE_MS: Record<Stage, number> = {
    // Just long enough to register that the rocket is standing on something.
    pad: 700,
    ignition: 850,
    ascent: 1150,
    // The hand-over: the rocket leaves the frame and the sky goes with it.
    departure: 850,
};

const STAGE_ORDER: Stage[] = ["pad", "ignition", "ascent", "departure"];

/** How long the sky takes to clear the screen, in seconds. */
const DEPARTURE_S = 0.75;

/**
 * The moment an onboarding path is finished being built, the first time its
 * owner lays eyes on it.
 *
 * The other moments mark something the user *did*. This one marks something
 * that was made for them while they waited, so it is the departure: the rocket
 * stands on Earth, lights up, and leaves. The step flybys are the journey
 * between here and there, and `MissionComplete` is the far end of it.
 *
 * Two things carry it:
 *
 * - **The camera stays with the rocket.** It barely moves up the frame; the
 *   planet dropping away underneath and the stars sliding past are what do the
 *   travelling. A rocket that simply slides up the screen reads as an icon
 *   being animated.
 * - **It ends by getting out of the way.** No card, no button: the rocket
 *   accelerates out of the top and drags the whole sky up with it, uncovering
 *   the onboarding page from the bottom edge upwards. The sequence hands over
 *   to the page rather than asking to be dismissed first, so the last thing it
 *   does is show the user what it was about.
 *
 * The page itself is not transformed to slide it in, tempting as that is: a
 * transform on an ancestor becomes the containing block for every
 * `position: fixed` descendant, which would knock the sidebar and any open
 * drawer out of place for the duration and snap them back at the end. Moving
 * the cover instead is the same reveal with none of that.
 *
 * Teardown is on a timer rather than on `onAnimationComplete` — the same reason
 * `RocketFlyby` does it that way. That callback is the animation reporting on
 * itself: if it never starts, the callback never fires and this overlay stays
 * over the app forever.
 *
 * Renders nothing at all under `prefers-reduced-motion` — it is a piece of
 * motion carrying no information, so the honest reduced version is none of it.
 */
export function PathReveal({ onDone }: PathRevealProps) {
    const reduceMotion = useReducedMotion();
    const [stage, setStage] = useState<Stage>("pad");

    // Resolved once: the launch is over in about three and a half seconds, so a
    // resize mid-sequence is not worth re-deriving for.
    const rocketSize = useMemo(() => rocketSizeFor(window.innerWidth) * 1.4, []);

    useEffect(() => {
        if (reduceMotion) onDone();
    }, [reduceMotion, onDone]);

    useEffect(() => {
        if (reduceMotion) return;

        const timer = window.setTimeout(() => {
            const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
            if (next) setStage(next);
            else onDone();
        }, STAGE_MS[stage]);

        return () => window.clearTimeout(timer);
    }, [stage, reduceMotion, onDone]);

    // Any input cuts to the hand-over rather than to nothing: someone who has
    // seen the launch still has to arrive somewhere, and a screen that vanishes
    // mid-frame reads as a crash. A second input while it is already leaving
    // takes the rest.
    useEffect(() => {
        if (reduceMotion) return;

        const skip = () => {
            if (stage === "departure") onDone();
            else setStage("departure");
        };
        document.addEventListener("keydown", skip);
        document.addEventListener("pointerdown", skip);
        return () => {
            document.removeEventListener("keydown", skip);
            document.removeEventListener("pointerdown", skip);
        };
    }, [stage, reduceMotion, onDone]);

    if (reduceMotion) return null;

    const isFlying = stage !== "pad";
    const hasClimbed = stage === "ascent" || stage === "departure";
    const isLeaving = stage === "departure";

    return createPortal(
        <motion.div
            aria-hidden="true"
            data-testid="path-reveal"
            className="fixed inset-0 z-[85] overflow-hidden bg-app-bg"
            // The sky leaves through the top, so the page underneath is
            // uncovered from the bottom edge upwards — the user is slid onto it
            // rather than handed it.
            initial={{ y: 0 }}
            animate={{ y: isLeaving ? "-100%" : 0 }}
            transition={{ duration: DEPARTURE_S, ease: [0.5, 0, 0.75, 0] }}
        >
            <StarField travel={1} moving={hasClimbed} duration={1.6} />

            {/* The Moon, far off and dead ahead: where this is all going. Small
                and static — it is a destination, not a participant. */}
            <motion.span
                className="absolute left-1/2 top-[12%] rounded-full"
                style={{
                    width: 54,
                    height: 54,
                    marginLeft: -27,
                    // Greys that stay grey in both themes, so the moon keeps a
                    // defined edge instead of fading into a light background.
                    background:
                        "radial-gradient(circle at 38% 32%, var(--text-muted) 0%, var(--text-subtle) 62%, var(--border-strong) 100%)",
                    boxShadow: "0 0 34px 2px var(--brand-glow)",
                }}
                initial={{ opacity: 0.45, scale: 0.85 }}
                animate={{
                    opacity: hasClimbed ? 1 : 0.45,
                    scale: hasClimbed ? 1.12 : 0.85,
                }}
                transition={{ duration: 1.6, ease: "easeOut" }}
            />

            {/* Earth. A disc far wider than the screen, sitting mostly below it,
                so what shows is a curved horizon rather than a ball — the
                difference between standing on a planet and looking at one. */}
            <motion.div
                className="absolute left-1/2 w-[280vw] max-w-[2400px] -translate-x-1/2 rounded-full"
                style={{
                    aspectRatio: "1 / 1",
                    top: "78%",
                    // Every stop is a token that holds its value across themes.
                    // A planet is an object, not a surface — it should look the
                    // same in light and dark, and the theme-flipping tokens
                    // dissolve its edge into the page in one of the two.
                    background:
                        "radial-gradient(circle at 42% 26%, var(--brand-border-strong) 0%, var(--brand) 44%, var(--progress-fill-end) 100%)",
                    boxShadow:
                        "0 0 120px 26px var(--brand-glow), inset 0 14px 60px -10px var(--brand-glow)",
                }}
                initial={{ y: 0, scale: 1 }}
                animate={{
                    y: isLeaving ? "70%" : hasClimbed ? "26%" : 0,
                    scale: isLeaving ? 0.6 : hasClimbed ? 0.82 : 1,
                }}
                transition={{
                    duration: isLeaving ? DEPARTURE_S : 1.6,
                    ease: "easeIn",
                }}
            >
                {/* Cloud banding, so the limb is not a flat gradient. Blurred
                    and low-contrast on purpose: it should read at a glance and
                    survive being looked at directly. */}
                <span className="absolute left-[26%] top-[6%] h-[9%] w-[34%] rounded-[50%] bg-app-surface opacity-[0.14] blur-xl" />
                <span className="absolute left-[52%] top-[14%] h-[7%] w-[26%] rounded-[50%] bg-app-surface opacity-10 blur-xl" />
            </motion.div>

            {/* Atmosphere: a bright rim hugging the horizon, which is what
                actually sells the curve. */}
            <motion.div
                className="absolute left-1/2 w-[280vw] max-w-[2400px] -translate-x-1/2 rounded-full"
                style={{
                    aspectRatio: "1 / 1",
                    top: "78%",
                    boxShadow: "0 0 60px 8px var(--brand-border-strong)",
                    opacity: 0.35,
                }}
                initial={{ y: 0, scale: 1 }}
                animate={{
                    y: isLeaving ? "70%" : hasClimbed ? "26%" : 0,
                    scale: isLeaving ? 0.6 : hasClimbed ? 0.82 : 1,
                }}
                transition={{
                    duration: isLeaving ? DEPARTURE_S : 1.6,
                    ease: "easeIn",
                }}
            />

            {/* Ignition: exhaust piling up against the ground and a plume out of
                the nozzle. Anchored to the pad, so it stays behind when the
                rocket goes. */}
            <AnimatePresence>
                {isFlying && (
                    <motion.div
                        key="ignition"
                        className="absolute left-1/2 top-[78%] -translate-x-1/2"
                        style={{ marginTop: rocketSize * 0.1 }}
                        exit={{ opacity: 0, transition: { duration: 0.5 } }}
                    >
                        <motion.span
                            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-[50%]"
                            style={{
                                width: rocketSize * 1.6,
                                height: rocketSize * 0.5,
                                background:
                                    "radial-gradient(50% 50%, var(--progress-fill-end) 0%, var(--brand) 45%, transparent 72%)",
                                filter: "blur(14px)",
                            }}
                            initial={{ scaleX: 0.2, scaleY: 0.3, opacity: 0 }}
                            animate={{
                                scaleX: [0.2, 3, 4.2],
                                scaleY: [0.3, 1.1, 1.35],
                                opacity: [0, 0.9, hasClimbed ? 0 : 0.8],
                            }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                        />

                        <motion.span
                            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
                            style={{
                                width: rocketSize * 0.28,
                                height: rocketSize * 1.3,
                                transformOrigin: "50% 0%",
                                background:
                                    "linear-gradient(180deg, var(--progress-fill-end), var(--brand) 40%, transparent)",
                                filter: "blur(9px)",
                            }}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={{
                                scaleY: [0, 1, 0.8, 1],
                                opacity: [0, 0.95, 0.8, 0.9],
                            }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The rocket. Stands on the horizon, shakes against its own thrust,
                climbs a fifth of the screen while the world falls away, then
                accelerates out of the top. */}
            <motion.div
                className="absolute left-1/2 top-[78%] text-app-brand"
                style={{
                    marginLeft: -rocketSize / 2,
                    marginTop: -rocketSize,
                    filter: "drop-shadow(0 0 24px var(--brand-glow))",
                }}
                initial={{ x: 0, y: 0, scale: 1 }}
                animate={
                    stage === "ignition"
                        ? { x: [0, -2, 2, 0], y: 0, scale: 1 }
                        : {
                              x: 0,
                              y: isLeaving ? "-150vh" : hasClimbed ? "-22vh" : 0,
                              scale: isLeaving ? 0.55 : hasClimbed ? 0.8 : 1,
                          }
                }
                transition={
                    stage === "ignition"
                        ? { duration: 0.14, repeat: Infinity }
                        : stage === "ascent"
                          ? { ...flightEaseToken, duration: 1.6 }
                          : isLeaving
                            ? { duration: DEPARTURE_S * 0.9, ease: [0.5, 0, 0.75, 0] }
                            : { duration: 0.3 }
                }
            >
                <RocketGlyph size={rocketSize} flame={isFlying} />
            </motion.div>

            {/* Skip affordance, so the launch never feels like a lock-in. */}
            {!isLeaving && (
                <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[0.18em] text-app-text-subtle">
                    Press any key to skip
                </p>
            )}
        </motion.div>,
        document.body,
    );
}
