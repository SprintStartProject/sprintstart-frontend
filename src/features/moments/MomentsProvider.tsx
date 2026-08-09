import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useAuth } from "../../context/useAuth.ts";
import { dismissBootSplash, rememberBootGreeting } from "../../bootSplash.ts";
import { MomentsContext } from "./MomentsContext.ts";
import { useMomentDevShortcuts } from "./useMomentDevShortcuts.ts";
import { LaunchSequence } from "./components/LaunchSequence.tsx";
import { MomentCelebration } from "./components/MomentCelebration.tsx";
import { MissionComplete } from "./components/MissionComplete.tsx";
import { PathReveal } from "./components/PathReveal.tsx";
import { RocketFlyby } from "./components/RocketFlyby.tsx";
import type {
    Celebration,
    CelebrationInput,
    PathRevealHandlers,
} from "./types.ts";

const ROCKET_PET_KEY = "sprintstart.moments.showRocketPet";

/** Off unless the user has explicitly turned it on in Settings. */
function getInitialShowRocketPet(): boolean {
    try {
        return window.localStorage.getItem(ROCKET_PET_KEY) === "true";
    } catch (error) {
        console.warn("Failed to read rocket pet preference", error);
        return false;
    }
}

/**
 * Owns the app's celebratory layer: the celebration overlays, the rocket
 * moments, and the hand-over from the boot splash that `index.html` paints
 * before this bundle exists.
 *
 * Must sit inside `AuthProvider` — it reads the auth status to stay off the
 * login screen. Renders its overlays as siblings of `children`; both portal
 * into `<body>`, so nothing here wraps the app in a new stacking or containing
 * block.
 */
export function MomentsProvider({ children }: { children: ReactNode }) {
    const { status, profile } = useAuth();
    const reduceMotion = useReducedMotion();

    // Starts "played": boot is covered by the splash in `index.html`, not by
    // this. The sequence is now only what `playLaunchSequence` asks for.
    const [hasLaunchPlayed, setHasLaunchPlayed] = useState(true);
    const [queue, setQueue] = useState<Celebration[]>([]);
    const [flybyId, setFlybyId] = useState<number | null>(null);
    const [isMissionComplete, setIsMissionComplete] = useState(false);
    const [pathReveal, setPathReveal] = useState<{
        id: number;
        onLaunched?: () => void;
    } | null>(null);
    const nextId = useRef(0);
    const [showRocketPet, setShowRocketPetState] = useState(getInitialShowRocketPet);

    // Boot is *not* covered from here any more, and that is the fix for a
    // launch that used to stutter, cut to black and then start over.
    //
    // Keycloak runs `check-sso` with the login iframe off, which is a full
    // redirect out to the identity provider and back on every single load. A
    // sequence started at mount therefore played into a page that was already
    // on its way out: it janked against the bundle still parsing, the redirect
    // blacked it out mid-flight, and the reload then played it again from the
    // top. Nothing about that is fixable from inside React, because two of the
    // three phases happen before this component exists.
    //
    // So the load is covered by the CSS splash in `index.html` — it paints on
    // the first frame of *both* page loads and animates on the compositor — and
    // this is left for `playLaunchSequence`.
    //
    // Bailing on "unauthenticated" still keeps it off the login screen:
    // launching a rocket at someone who then gets asked to sign in is a promise
    // the app cannot keep.
    const isLaunching =
        !hasLaunchPlayed && !reduceMotion && status !== "unauthenticated";

    // The splash's cue to leave: the app now knows what it is showing, whether
    // that is the app or the login screen. Deliberately not tied to the route or
    // to data loading — a splash that waits for content outstays the moment it
    // was covering and starts reading as a hang. It will not cut the launch
    // short either; `dismissBootSplash` holds the fade until the flight is over.
    //
    // The greeting is stashed on the way past: the splash renders before any of
    // the app exists, so the only name it can say is one from a previous visit.
    useEffect(() => {
        if (status === "loading") return;

        if (status === "authenticated") {
            rememberBootGreeting(profile?.firstName);
            dismissBootSplash();
            return;
        }

        // Signed out: the login form is next, and finishing a launch in front
        // of it would be a send-off for a journey this person has not started.
        rememberBootGreeting(null);
        dismissBootSplash("now");
    }, [status, profile?.firstName]);

    const setShowRocketPet = useCallback((value: boolean) => {
        setShowRocketPetState(value);
        try {
            window.localStorage.setItem(ROCKET_PET_KEY, String(value));
        } catch (error) {
            // Won't survive a reload, but stays in effect for this session.
            console.warn("Failed to persist rocket pet preference", error);
        }
    }, []);

    const playLaunchSequence = useCallback(() => setHasLaunchPlayed(false), []);
    const finishLaunch = useCallback(() => setHasLaunchPlayed(true), []);

    const celebrate = useCallback((input: CelebrationInput) => {
        nextId.current += 1;
        const entry: Celebration = {
            ...input,
            id: `moment-${nextId.current}`,
            seed: nextId.current,
        };
        // Queue rather than replace: two moments landing together (a check
        // passing *and* the phase unlocking) should both get their beat.
        setQueue((current) => [...current, entry]);
    }, []);

    const dismissCurrent = useCallback(() => {
        setQueue((current) => current.slice(1));
    }, []);

    const flyby = useCallback(() => {
        if (reduceMotion) return;
        // Ignored rather than queued while one is already in flight: two rockets
        // chasing each other reads as a glitch, and the second press was almost
        // certainly an impatient double-click on the first.
        setFlybyId((current) => (current === null ? Date.now() : current));
    }, [reduceMotion]);

    // Stable identity: `RocketFlyby` tears itself down on a timer keyed to this
    // callback, so a fresh closure on every provider render would keep resetting
    // that timer and the rocket would never leave.
    const endFlyby = useCallback(() => setFlybyId(null), []);

    const completeMission = useCallback(() => setIsMissionComplete(true), []);

    // Not queued behind `celebrate`: the reveal is the first thing that happens
    // on a brand-new path, so there is nothing for it to collide with, and
    // holding it behind a queue would put it on screen after the user has
    // already started reading the page it is introducing.
    const revealPath = useCallback((handlers?: PathRevealHandlers) => {
        const id = Date.now();

        setPathReveal(
            (current) => current ?? { id, onLaunched: handlers?.onLaunched },
        );

        // Only clears the launch this call actually started. A disposer that
        // fired unconditionally would let a page unmounting late take down a
        // launch that something else has since put up.
        return () =>
            setPathReveal((current) => (current?.id === id ? null : current));
    }, []);

    // Stable identity, for the same reason `endFlyby` is: `PathReveal` runs its
    // beats off timers keyed to this callback, and a fresh closure on every
    // provider render would keep resetting them.
    const endPathReveal = useCallback(() => setPathReveal(null), []);

    // TEMPORARY — remove this call together with the hook before merging to dev.
    useMomentDevShortcuts({
        celebrate,
        flyby,
        completeMission,
        revealPath,
        playLaunchSequence,
    });

    const value = useMemo(
        () => ({
            celebrate,
            flyby,
            completeMission,
            revealPath,
            playLaunchSequence,
            isLaunching,
            showRocketPet,
            setShowRocketPet,
        }),
        [
            celebrate,
            flyby,
            completeMission,
            revealPath,
            playLaunchSequence,
            isLaunching,
            showRocketPet,
            setShowRocketPet,
        ],
    );

    const current = queue[0];

    return (
        <MomentsContext.Provider value={value}>
            {children}

            {isLaunching && (
                <LaunchSequence
                    displayName={profile?.firstName ?? undefined}
                    onDone={finishLaunch}
                />
            )}

            {flybyId !== null && (
                <RocketFlyby key={flybyId} onDone={endFlyby} />
            )}

            {current && (
                <MomentCelebration
                    key={current.id}
                    celebration={current}
                    onDismiss={dismissCurrent}
                />
            )}

            {pathReveal && (
                <PathReveal
                    key={pathReveal.id}
                    onLaunch={pathReveal.onLaunched}
                    onDone={endPathReveal}
                />
            )}

            {isMissionComplete && (
                <MissionComplete
                    displayName={profile?.firstName ?? undefined}
                    onDismiss={() => setIsMissionComplete(false)}
                />
            )}
        </MomentsContext.Provider>
    );
}
