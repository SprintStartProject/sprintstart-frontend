import { useCallback, useEffect, useRef, useState } from "react";

export type SleepStage = "awake" | "drowsy" | "asleep";

/**
 * Idle window before the eyes start to droop. Randomised per bot *and* per
 * cycle, which is the whole reason several of them on one screen are worth
 * having: they nod off one after another instead of blinking out in unison like
 * a bank of monitors losing power.
 */
export const DROWSY_MIN_MS = 30_000;
export const DROWSY_MAX_MS = 90_000;

/** Gap between drooping and being properly out. */
export const ASLEEP_DELAY_MS = 20_000;

/** How long the startled look lasts after waking. */
const WAKING_MS = 600;

function drowsyDelay(): number {
    return DROWSY_MIN_MS + Math.random() * (DROWSY_MAX_MS - DROWSY_MIN_MS);
}

interface UseIdleSleepOptions {
    /**
     * Whether the bot is allowed to nod off at all. Pass `false` while it is
     * actually doing something — falling asleep mid-answer would read as the
     * app having hung rather than as a joke.
     */
    enabled?: boolean;
}

interface IdleSleep {
    stage: SleepStage;
    /** True for the brief startled beat right after waking. */
    isWaking: boolean;
    /** Wakes the bot immediately — for clicking it directly. */
    wake: () => void;
}

/**
 * Tracks how long the user has been idle and reports back a sleep stage.
 *
 * Activity is keystrokes and pointer presses, deliberately *not* pointer
 * movement: a bot that snaps awake because the cursor drifted across the screen
 * would never get to fall asleep on a desk where anything nudges the mouse.
 *
 * The timers keep running while the tab is in the background, so coming back
 * from a coffee to a sleeping bot works — that being the case the whole thing
 * exists for. Browsers throttle background timers to roughly once a minute, so
 * the transition may land late; it will not be missed.
 */
export function useIdleSleep({ enabled = true }: UseIdleSleepOptions = {}): IdleSleep {
    const [stage, setStage] = useState<SleepStage>("awake");
    const [isWaking, setIsWaking] = useState(false);
    const [activityToken, setActivityToken] = useState(0);

    // Mirrors `stage` for the timers to read without re-subscribing on every
    // stage change. Assigning a ref is not a state update, so no cascade.
    const stageRef = useRef<SleepStage>(stage);
    useEffect(() => {
        stageRef.current = stage;
    }, [stage]);

    const wake = useCallback(() => setActivityToken((token) => token + 1), []);

    useEffect(() => {
        if (!enabled) return;

        // Every stage transition is scheduled here, including the return to
        // "awake". Doing it with a zero-delay timer rather than a synchronous
        // set keeps this effect free of cascading renders, and the functional
        // update bails out when the bot is already awake — which is every
        // keystroke of normal typing.
        const wakeTimer = window.setTimeout(() => {
            if (stageRef.current === "asleep") setIsWaking(true);
            setStage((current) => (current === "awake" ? current : "awake"));
        }, 0);

        // Redrawn on every restart, so a bot that has been woken and left alone
        // again does not fall asleep on the same schedule as last time.
        const untilDrowsy = drowsyDelay();

        const drowsyTimer = window.setTimeout(() => setStage("drowsy"), untilDrowsy);
        const asleepTimer = window.setTimeout(
            () => setStage("asleep"),
            untilDrowsy + ASLEEP_DELAY_MS,
        );

        return () => {
            window.clearTimeout(wakeTimer);
            window.clearTimeout(drowsyTimer);
            window.clearTimeout(asleepTimer);
        };
    }, [enabled, activityToken]);

    // Clears the startled look a moment after it starts.
    useEffect(() => {
        if (!isWaking) return;
        const timer = window.setTimeout(() => setIsWaking(false), WAKING_MS);
        return () => window.clearTimeout(timer);
    }, [isWaking]);

    useEffect(() => {
        if (!enabled) return;

        const onActivity = () => setActivityToken((token) => token + 1);

        document.addEventListener("keydown", onActivity);
        document.addEventListener("pointerdown", onActivity);
        return () => {
            document.removeEventListener("keydown", onActivity);
            document.removeEventListener("pointerdown", onActivity);
        };
    }, [enabled]);

    // Derived rather than reset through an effect: while the bot is busy it is
    // awake by definition, whatever the timers last recorded.
    return { stage: enabled ? stage : "awake", isWaking: enabled && isWaking, wake };
}
