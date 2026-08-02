import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { petFlight, PET_ROCKET_SIZE } from "../flightGeometry.ts";
import type { FlightPath } from "../loopFlight.ts";
import {
    FLIGHT_DURATION_S,
    hoverSpringToken,
    idleDriftToken,
    petPeekSpringToken,
} from "../../../styles/tokens.ts";

const LAUNCH_COUNT_KEY = "rocketLaunchCount";

/** How long the pet waits between one peek and the next. */
const PEEK_EVERY_MIN_MS = 20_000;
const PEEK_EVERY_MAX_MS = 45_000;

/** How long it stays leaning out before ducking back. */
const PEEK_HOLD_MS = 2_800;

/**
 * How long it is gone after a launch — minutes, not seconds. Long enough that
 * you stop waiting for it, so noticing it back in the corner later is its own
 * small moment. A pet that is instantly back never went anywhere.
 */
const AWAY_MIN_MS = 150_000;
const AWAY_MAX_MS = 360_000;

/**
 * How long a tap keeps the pet out on a touchscreen, standing in for the hover
 * that a finger cannot do. Long enough to aim the second tap without hurrying.
 */
const TOUCH_HOLD_MS = 5_000;

/**
 * Where the rocket sits in each pose, relative to its perch.
 *
 * Positive `y` pushes it down past the corner container's clip edge, so "hidden"
 * leaves only the nose showing and "peeking" shows nose and porthole. The tilt
 * is what turns a vertical slide into leaning out from behind the corner; it
 * pivots about the rocket's tail (see `transformOrigin` below).
 */
const POSE = {
    hidden: { x: 13, y: 40, rotate: -20 },
    peeking: { x: 6, y: 24, rotate: -12 },
    out: { x: 0, y: 0, rotate: 0 },
} as const;

type PetPose = keyof typeof POSE;

/**
 * `hidden` and `peeking` cycle on a timer; `flying` and `away` are the launch.
 * The pose the user actually sees is derived from this plus attention — see
 * `pose` below — so that attention beats the schedule.
 */
type PetState = "hidden" | "peeking" | "flying" | "away";

function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribeToPointerType(onChange: () => void): () => void {
    if (typeof window.matchMedia !== "function") return () => {};

    const query = window.matchMedia(COARSE_POINTER_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function getCoarsePointer(): boolean {
    return (
        typeof window.matchMedia === "function" &&
        window.matchMedia(COARSE_POINTER_QUERY).matches
    );
}

/**
 * True when the primary pointer cannot hover — a finger, essentially.
 *
 * The pet is built around hover: it leans out when you come near and launches
 * when you click. Half of that vocabulary does not exist on a touchscreen, so
 * the tap has to carry both, and this is how the component knows.
 *
 * It can change without a reload — a tablet with a keyboard case attached, a
 * desktop browser's device emulation — so it is subscribed to rather than read
 * once.
 */
function useCoarsePointer(): boolean {
    return useSyncExternalStore(subscribeToPointerType, getCoarsePointer, () => false);
}

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
 * A little rocket that lives behind the bottom-right corner of the screen.
 *
 * It hides there, leans out every half-minute or so to see what you are doing,
 * and comes fully out when you go near it. Set it off and it flies across the
 * screen with a loop on the way — and then it is actually gone for a few
 * minutes, because a pet that reappears instantly was never really away.
 *
 * It does nothing. That is the point — it is the one place in the app that
 * exists purely because someone cared. Kept deliberately quiet: no button
 * chrome, below every modal in the stacking order, and inert (one friendly
 * wiggle, no hiding and no flight) for users who prefer reduced motion.
 *
 * **On a touchscreen** the first tap does the job hover does — the rocket comes
 * out and stays out for a moment — and a second tap launches it. One tap would
 * fire it off from a corner where only its nose is showing, which is an easter
 * egg you trigger by accident rather than find.
 *
 * The hit target is a plain square in the corner, deliberately *not* the rocket:
 * the drawing is clipped by the screen edge it hides behind, and a clipped
 * element is only tappable where it is visible — which for a tucked-away rocket
 * is about twelve pixels. Keyboard users reach it the same way, including while
 * it is away, because an easter egg only some people can reach is not one.
 */
export function RocketPet() {
    const reduceMotion = useReducedMotion();
    const isCoarsePointer = useCoarsePointer();

    const [state, setState] = useState<PetState>("hidden");
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isTapHeld, setIsTapHeld] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [isWiggling, setIsWiggling] = useState(false);
    const [launchCount, setLaunchCount] = useState(readLaunchCount);
    const [flight, setFlight] = useState<FlightPath | null>(null);

    const isEngaged = isHovered || isFocused || isTapHeld;

    // Drives the hide/peek cycle and the wait after a launch. The peek cycle
    // pauses while the user is on the pet, so it never ducks away from under the
    // pointer; the wait after a launch does not, or parking a pointer in the
    // corner would keep it away forever.
    useEffect(() => {
        if (reduceMotion) return;

        let next: PetState;
        let delay: number;

        if (state === "away") {
            // Comes back the way it left: a cautious look around the corner
            // first, not a pop straight back onto the perch.
            next = "peeking";
            delay = randomBetween(AWAY_MIN_MS, AWAY_MAX_MS);
        } else if (isEngaged) {
            return;
        } else if (state === "hidden") {
            next = "peeking";
            delay = randomBetween(PEEK_EVERY_MIN_MS, PEEK_EVERY_MAX_MS);
        } else if (state === "peeking") {
            next = "hidden";
            delay = PEEK_HOLD_MS;
        } else {
            // "flying" ends on the flight's own animation callback.
            return;
        }

        const timeoutId = window.setTimeout(() => setState(next), delay);
        return () => window.clearTimeout(timeoutId);
    }, [state, isEngaged, reduceMotion]);

    // A tap stands in for hover, so it has to time out like a pointer leaving.
    useEffect(() => {
        if (!isTapHeld) return;

        const timeoutId = window.setTimeout(() => setIsTapHeld(false), TOUCH_HOLD_MS);
        return () => window.clearTimeout(timeoutId);
    }, [isTapHeld]);

    const handleActivate = useCallback(() => {
        if (state === "flying") return;

        // First tap brings it out; only the second one lights the fuse.
        if (isCoarsePointer && !isTapHeld) {
            setIsTapHeld(true);
            return;
        }

        const next = readLaunchCount() + 1;
        setLaunchCount(next);
        persistLaunchCount(next);
        setIsTapHeld(false);

        if (reduceMotion) {
            setIsWiggling(true);
            return;
        }

        // Sized against the viewport at the moment of launch rather than at
        // mount, so the loop stays in proportion after a window resize.
        setFlight(petFlight(window.innerWidth, window.innerHeight));
        setState("flying");
    }, [state, isCoarsePointer, isTapHeld, reduceMotion]);

    let pose: PetPose;
    if (reduceMotion) {
        pose = "out";
    } else if (state === "flying") {
        // The airborne copy has taken over; two rockets must never be on screen.
        pose = "hidden";
    } else if (state === "away") {
        pose = isFocused ? "out" : "hidden";
    } else if (isEngaged) {
        pose = "out";
    } else {
        pose = state;
    }

    const isGone = !reduceMotion && (state === "flying" || (state === "away" && !isFocused));

    const scale = isPressed ? 0.88 : pose === "out" && isHovered ? 1.1 : 1;

    return (
        <>
            {/* Clipping frame. This is what the pet hides *behind*: everything
                pushed past its bottom-right edge is cut off. Purely a drawing —
                the hit target below is a separate element, because clipping an
                element clips where it can be tapped along with where it shows. */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed right-0 z-30 h-[104px] w-[104px] overflow-hidden"
                style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
            >
                <motion.div
                    className="absolute bottom-[14px] right-[14px] flex h-10 w-10 items-center justify-center text-app-text-subtle"
                    // Tail pivot, so tilting swings the nose out from behind the
                    // corner instead of rolling the whole body on the spot.
                    style={{ transformOrigin: "50% 100%" }}
                    animate={{ ...POSE[pose], scale, opacity: isGone ? 0 : 1 }}
                    transition={{
                        ...petPeekSpringToken,
                        // Instant on the way out — it left under its own power,
                        // so there is nothing to fade. Gentle on the way back.
                        opacity: { duration: state === "flying" ? 0 : 0.4 },
                    }}
                >
                    {/* Idle bob rides on its own element: the pose above already
                        owns `y`, and two animations cannot share a transform
                        component. */}
                    <motion.span
                        className="flex items-center justify-center"
                        animate={
                            isWiggling
                                ? { rotate: [0, -12, 10, -6, 0] }
                                : reduceMotion
                                  ? undefined
                                  : { y: [0, -3, 0] }
                        }
                        transition={isWiggling ? { duration: 0.5 } : idleDriftToken}
                        onAnimationComplete={() => setIsWiggling(false)}
                    >
                        <RocketGlyph size={PET_ROCKET_SIZE} />
                    </motion.span>
                </motion.div>
            </div>

            {/* The hit target: a full-size square in the corner, never clipped,
                so the rocket stays reachable by finger and by pointer no matter
                how far it has tucked itself away. */}
            <motion.button
                type="button"
                onClick={handleActivate}
                aria-label={
                    launchCount > 0
                        ? `Launch the rocket (launched ${launchCount} times)`
                        : "Launch the rocket"
                }
                title="Go on, launch it"
                className={`fixed right-1 z-30 h-12 w-12 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                    // Invisible but present while it is away; without this you
                    // could set off a rocket that is not there.
                    isGone && !isFocused ? "pointer-events-none" : "pointer-events-auto"
                }`}
                style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)" }}
                // Framer's hover is mouse-only, which is exactly the split this
                // component wants: pointers hover, fingers tap.
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                onPointerDown={() => setIsPressed(true)}
                onPointerUp={() => setIsPressed(false)}
                onPointerCancel={() => setIsPressed(false)}
                // Only *keyboard* focus counts as attention. Clicking a button
                // focuses it too, and treating that as attention is what used to
                // drag the rocket straight back out of its post-launch hiding.
                onFocus={(event) => setIsFocused(event.currentTarget.matches(":focus-visible"))}
                onBlur={() => setIsFocused(false)}
            />

            {/* Deliberately outside the clipping frame — the flight leaves the
                corner behind. One element, one transform: travel and loop are a
                single curve, so there is nothing to layer. */}
            <AnimatePresence>
                {state === "flying" && flight && (
                    <motion.div
                        key="rocket-flight"
                        aria-hidden="true"
                        className="pointer-events-none fixed right-[14px] z-30 flex h-10 w-10 items-center justify-center text-app-brand-text"
                        style={{
                            bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
                            filter: "drop-shadow(0 0 14px var(--brand-glow))",
                        }}
                        initial={{ x: 0, y: 0, rotate: flight.rotate[0], scale: 1, opacity: 1 }}
                        animate={{
                            x: flight.x,
                            y: flight.y,
                            rotate: flight.rotate,
                            // Recedes rather than exits: shrinks away and fades
                            // over the last quarter of the flight.
                            scale: flight.progress.map((s) => 1 - 0.55 * s * s),
                            opacity: flight.progress.map((s) =>
                                s < 0.75 ? 1 : Math.max(0, (1 - s) / 0.25),
                            ),
                        }}
                        exit={{ opacity: 0 }}
                        // Linear on purpose: the easing is already baked into the
                        // keyframes, and easing them again ripples the curve.
                        transition={{
                            duration: FLIGHT_DURATION_S,
                            times: flight.times,
                            ease: "linear",
                        }}
                        onAnimationComplete={() => setState("away")}
                    >
                        <RocketGlyph size={PET_ROCKET_SIZE} flame />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tally, shown briefly after a launch. A tiny "someone counted" wink. */}
            <AnimatePresence>
                {state === "flying" && launchCount > 1 && (
                    <motion.span
                        key="rocket-tally"
                        aria-hidden="true"
                        className="pointer-events-none fixed bottom-[68px] right-[10px] z-30 rounded-full border border-app-border bg-app-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-app-text-subtle shadow-sm"
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
