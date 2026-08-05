/** Matches the element, class and globals set up in `index.html`. */
const SPLASH_ID = "boot-splash";
const READY_CLASS = "is-ready";
const GREETING_KEY = "sprintstart.boot.greeting";
const SIGNOUT_KEY = "sprintstart.boot.signout";

/**
 * How long the exit runs before the node is taken out of the DOM.
 *
 * Must outlast the `is-ready` animation in `index.html` (0.45s). Removing it
 * earlier cuts the fade off halfway.
 */
const EXIT_MS = 520;

declare global {
    interface Window {
        /** Published by the inline boot script; absent in tests and Storybook. */
        __bootSplash?: { start: number; flightMs: number };
    }
}

/** Milliseconds still to run before the launch has played out. */
function remainingFlightMs(): number {
    const boot = window.__bootSplash;
    if (!boot) return 0;
    return Math.max(0, boot.start + boot.flightMs - Date.now());
}

/**
 * Remembers whom to greet on the next boot.
 *
 * The splash has to render its greeting before any of the app exists, so the
 * name cannot come from the profile — it has to already be in storage when the
 * document is parsed. Written once a profile is loaded, read on the next load.
 * A name the browser has been shown before, kept in that browser: it never
 * leaves, and the worst case is a stale first name after a rename.
 */
export function rememberBootGreeting(firstName: string | null | undefined): void {
    try {
        if (firstName) window.localStorage.setItem(GREETING_KEY, firstName);
        else window.localStorage.removeItem(GREETING_KEY);
    } catch {
        // The splash falls back to an unnamed greeting.
    }
}

/**
 * Tells the next document load that it arrived by signing out.
 *
 * Called just before handing over to Keycloak's logout, which navigates the
 * page away and brings it back with nothing on the URL to distinguish that
 * load from a normal cold start. Without the note, the splash would put a
 * rocket on the pad on the way out of the app — the beginning of a send-off
 * for somebody leaving, cut short a moment later when the app works out that
 * nobody is signed in.
 *
 * In `sessionStorage` rather than `localStorage`, and cleared by the very next
 * load that reads it: it describes one navigation, not a preference.
 */
export function markSigningOut(): void {
    try {
        window.sessionStorage.setItem(SIGNOUT_KEY, "1");
    } catch {
        // The splash will briefly show a pad. Not worth failing a sign-out for.
    }
}

/**
 * Takes down the boot splash that `index.html` paints before the bundle loads.
 *
 * Called once the app knows what it is showing — signed in, or signed out and
 * about to render the login screen. Until then the splash is what the user is
 * looking at, which is the point: it covers the module fetch, React mounting
 * and Keycloak's silent-SSO redirect, none of which the app can animate over
 * because two of the three happen before it exists and the third navigates the
 * page out from under it.
 *
 * **`"flight"` never cuts the launch short.** If the app is ready before the
 * flight has played out, the fade waits for it. A loading screen that vanishes
 * mid-flight reads as a glitch, and the half second it costs is spent on the
 * one part of the boot anybody enjoys. The other way round — ready long after
 * the flight — the held frame simply stays up until this is called, and the
 * user can always skip it.
 *
 * `"now"` fades without waiting, for the case where the launch turned out to be
 * for nobody: a signed-out user is about to be shown a login form, and
 * finishing a send-off in front of it is a promise the app cannot keep.
 * `"instant"` skips the fade too — see below.
 *
 * A no-op when there is no splash in the document (unit tests and Storybook
 * render the app without `index.html`), and idempotent. Idempotence is read off
 * the DOM rather than held in a module flag: the app calls this whenever auth
 * settles, which includes signing out and back in within one session, and a
 * flag would make every call after the first one silently do nothing.
 */
export function dismissBootSplash(
    mode: "flight" | "now" | "instant" = "flight",
): void {
    const splash = document.getElementById(SPLASH_ID);
    if (!splash || splash.dataset.exiting === "true") return;

    // "instant" is for the entries that were never being loaded *into* — the
    // Keycloak login theme boots from the same `index.html`, and holding a
    // sign-in form behind a launch is a send-off for a journey nobody started.
    if (mode === "instant") {
        splash.remove();
        return;
    }

    // Flagged before the wait rather than by the class that starts the fade:
    // the class has to land when the flight is over, and a second call in the
    // meantime must not queue a second exit behind it.
    splash.dataset.exiting = "true";

    window.setTimeout(
        () => {
            splash.classList.add(READY_CLASS);
            // On a timer rather than on `animationend`: that event is the
            // animation reporting on itself, and if it never starts — reduced
            // motion, a dropped frame, a backgrounded tab — it never fires and
            // the splash stays over the app for good.
            window.setTimeout(() => splash.remove(), EXIT_MS);
        },
        mode === "now" ? 0 : remainingFlightMs(),
    );
}
