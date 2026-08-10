import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "../../../components/ui/useScrollLock";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { ConfettiBurst } from "./ConfettiBurst.tsx";
import { rocketSizeFor } from "../flightGeometry.ts";
import { celebrationSpringToken } from "../../../styles/tokens.ts";

interface MissionCompleteProps {
    /** Greeted by name on the final card when the profile is loaded. */
    displayName?: string;
    onDismiss: () => void;
}

/**
 * Stages of the sequence, in order. Each one is a distinct beat rather than a
 * slice of a single long animation, so any of them can be retimed without
 * recomputing the rest.
 */
type Stage = "ignition" | "ascent" | "arrival";

const STAGE_MS: Record<Stage, number> = {
    ignition: 900,
    // Runs a little long on purpose: the rocket leaving the frame is the last
    // thing to watch before the card, so it gets a beat to actually be gone.
    ascent: 1250,
    // Terminal: the card stays until dismissed.
    arrival: 0,
};

const STAGE_ORDER: Stage[] = ["ignition", "ascent", "arrival"];

/**
 * The finale: finishing the entire onboarding path.
 *
 * This is the loudest thing the app does, and it is allowed to be, because it
 * happens exactly once per person. Everything else in the moments layer is
 * tuned to stay under it — a step flyby passes in under a second and never
 * dims the page, a phase celebration is a card. This one takes over the screen
 * for about three seconds and earns it.
 *
 * Three beats: the rocket lights up, climbs away, and the arrival card lands.
 * Skippable at any point — a sequence you cannot escape stops being a reward
 * the second time someone sees it — and reduced to the arrival card alone under
 * `prefers-reduced-motion`.
 */
export function MissionComplete({ displayName, onDismiss }: MissionCompleteProps) {
    // A deliberate full-screen moment rather than a dialog, so it does not
    // use `Modal` — but the page behind it must still hold still.
    useScrollLock(true);

    const reduceMotion = useReducedMotion();
    const [stage, setStage] = useState<Stage>(() =>
        reduceMotion ? "arrival" : "ignition",
    );

    const rocketSize = useMemo(() => rocketSizeFor(window.innerWidth) * 1.6, []);
    const actionRef = useRef<HTMLButtonElement>(null);

    // Focus lands on the dismiss button once the card arrives, so a keyboard
    // user is never stranded in an overlay they cannot leave.
    useEffect(() => {
        if (stage === "arrival") actionRef.current?.focus();
    }, [stage]);

    // Advances through the beats. A single timer per stage rather than one long
    // schedule, so skipping mid-sequence cancels cleanly.
    useEffect(() => {
        const hold = STAGE_MS[stage];
        if (hold === 0) return;

        const timer = window.setTimeout(() => {
            const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
            if (next) setStage(next);
        }, hold);

        return () => window.clearTimeout(timer);
    }, [stage]);

    // Any input jumps to the card. The sequence is a gift, not a toll.
    useEffect(() => {
        if (stage === "arrival") return;

        const skip = () => setStage("arrival");
        document.addEventListener("keydown", skip);
        document.addEventListener("pointerdown", skip);
        return () => {
            document.removeEventListener("keydown", skip);
            document.removeEventListener("pointerdown", skip);
        };
    }, [stage]);

    const isFlying = stage === "ignition" || stage === "ascent";

    return createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-app-bg">
            {/* Ignition. Not one expanding circle — that reads as an explosion
                going off next to the rocket rather than as thrust coming out of
                it. Three parts instead: exhaust piling up against the pad and
                spreading sideways, a short plume straight down from the nozzle,
                and a brief flash at the moment of release. */}
            <AnimatePresence>
                {isFlying && !reduceMotion && (
                    <motion.div
                        key="ignition"
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2"
                        style={{ marginTop: rocketSize * 0.42 }}
                        exit={{ opacity: 0, transition: { duration: 0.4 } }}
                    >
                        {/* Exhaust hitting the pad: widens far more than it
                            grows tall, which is what makes it read as ground. */}
                        <motion.span
                            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-[50%]"
                            style={{
                                width: rocketSize * 1.5,
                                height: rocketSize * 0.5,
                                background:
                                    "radial-gradient(50% 50%, var(--progress-fill-end) 0%, var(--brand) 45%, transparent 72%)",
                                filter: "blur(14px)",
                            }}
                            initial={{ scaleX: 0.2, scaleY: 0.3, opacity: 0 }}
                            animate={{
                                scaleX: [0.2, 3.2, 4.4],
                                scaleY: [0.3, 1.15, 1.4],
                                opacity: [0, 0.9, stage === "ascent" ? 0 : 0.75],
                            }}
                            transition={{ duration: 1.1, ease: "easeOut" }}
                        />

                        {/* Plume straight down out of the nozzle. */}
                        <motion.span
                            className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
                            style={{
                                width: rocketSize * 0.3,
                                height: rocketSize * 1.4,
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

                        {/* Release flash. Short and small — a long one turns the
                            whole beat into a blast rather than a launch. */}
                        <motion.span
                            className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full"
                            style={{
                                background:
                                    "radial-gradient(circle, white 0%, var(--progress-fill-end) 40%, transparent 70%)",
                            }}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 9, 14], opacity: [0, 0.8, 0] }}
                            transition={{ duration: 0.42, ease: "easeOut" }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The rocket: holds on the pad shaking, then climbs out of frame. */}
            <AnimatePresence>
                {isFlying && !reduceMotion && (
                    <motion.div
                        key="rocket"
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-[62%] text-app-brand"
                        style={{ filter: "drop-shadow(0 0 26px var(--brand-glow))" }}
                        initial={{ x: "-50%", y: 0, scale: 1, opacity: 1 }}
                        animate={
                            stage === "ignition"
                                ? {
                                      // Held down by its own thrust before release.
                                      x: ["-50%", "-52%", "-48%", "-50%"],
                                      y: [0, -2, 2, 0],
                                  }
                                : { x: "-50%", y: "-135vh", scale: 0.55, opacity: [1, 1, 0] }
                        }
                        exit={{ opacity: 0 }}
                        transition={
                            stage === "ignition"
                                ? { duration: 0.16, repeat: Infinity }
                                : { duration: 1.05, ease: [0.5, 0, 0.75, 0] }
                        }
                    >
                        <RocketGlyph size={rocketSize} flame />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Arrival card. */}
            <AnimatePresence>
                {stage === "arrival" && (
                    <motion.div
                        key="card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mission-complete-title"
                        className="relative z-10 mx-6 w-full max-w-lg overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface px-8 py-10 text-center shadow-2xl"
                        initial={
                            reduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.8, y: 26 }
                        }
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={reduceMotion ? { duration: 0 } : celebrationSpringToken}
                    >
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-app-brand-glow blur-3xl"
                        />

                        <ConfettiBurst count={140} seedOffset={7} />

                        <motion.div
                            className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full text-app-brand"
                            style={{
                                background: "var(--brand-soft)",
                                filter: "drop-shadow(0 0 20px var(--brand-glow))",
                            }}
                            initial={reduceMotion ? false : { scale: 0.3, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : { ...celebrationSpringToken, delay: 0.1 }
                            }
                        >
                            <RocketGlyph size={54} flame />
                        </motion.div>

                        <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-app-brand-text">
                            Onboarding complete
                        </p>

                        <h2
                            id="mission-complete-title"
                            className="relative mt-3 text-3xl font-bold tracking-tight text-app-text"
                        >
                            {displayName ? `You're on board, ${displayName}` : "You're on board"}
                        </h2>

                        <p className="relative mx-auto mt-3 max-w-sm text-sm leading-relaxed text-app-text-muted">
                            Every phase cleared, every check passed. You know where things
                            live, how they fit together, and who to ask. Go build something.
                        </p>

                        <button
                            ref={actionRef}
                            type="button"
                            onClick={onDismiss}
                            className="relative mt-8 rounded-xl bg-app-brand px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        >
                            Let&apos;s go
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip affordance, so the sequence never feels like a lock-in. */}
            {stage !== "arrival" && (
                <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[0.18em] text-app-text-subtle">
                    Press any key to skip
                </p>
            )}
        </div>,
        document.body,
    );
}
