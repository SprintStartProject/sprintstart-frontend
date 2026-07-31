import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useAuth } from "../../context/useAuth.ts";
import { MomentsContext } from "./MomentsContext.ts";
import { LaunchSequence } from "./components/LaunchSequence.tsx";
import { MomentCelebration } from "./components/MomentCelebration.tsx";
import type { Celebration, CelebrationInput } from "./types.ts";

/**
 * Owns the app's celebratory layer: the launch sequence that covers boot, and
 * the queue of celebration overlays.
 *
 * Must sit inside `AuthProvider` — it reads the auth status to stay off the
 * login screen. Renders its overlays as siblings of `children`; both portal
 * into `<body>`, so nothing here wraps the app in a new stacking or containing
 * block.
 */
export function MomentsProvider({ children }: { children: ReactNode }) {
    const { status, profile } = useAuth();
    const reduceMotion = useReducedMotion();

    const [hasLaunchPlayed, setHasLaunchPlayed] = useState(false);
    const [queue, setQueue] = useState<Celebration[]>([]);
    const nextId = useRef(0);

    // Runs from mount, while `status` is still "loading" — the sequence covers
    // Keycloak's check-sso and the profile fetch, so the app boots behind it
    // instead of after it. Signing in is a redirect, so a fresh sign-in is a
    // fresh page load and gets the sequence for free.
    //
    // Bailing on "unauthenticated" is what keeps it off the login screen:
    // launching a rocket at someone who then gets asked to sign in is a promise
    // the app cannot keep.
    const isLaunching =
        !hasLaunchPlayed && !reduceMotion && status !== "unauthenticated";

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

    const value = useMemo(
        () => ({ celebrate, playLaunchSequence, isLaunching }),
        [celebrate, playLaunchSequence, isLaunching],
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

            {current && (
                <MomentCelebration
                    key={current.id}
                    celebration={current}
                    onDismiss={dismissCurrent}
                />
            )}
        </MomentsContext.Provider>
    );
}
