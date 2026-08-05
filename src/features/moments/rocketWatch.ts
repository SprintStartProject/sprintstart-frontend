/**
 * Lets the rest of the app know when a rocket is crossing the screen, and where.
 *
 * The rockets and their audience live in different features — the flights are
 * moments, the bot that gapes at them is the chatbot's — and neither should
 * know the other exists. This module is the whole contract between them: a
 * flight registers the element it is moving, watchers subscribe and read the
 * element's position off the DOM for as long as it is up.
 *
 * Only the flights that cross the *app* announce themselves: the step flyby and
 * the pet's launch. The launch sequence, the path reveal and the moon landing
 * play on opaque full-screen overlays, where anything watching from the page is
 * covered up — announcing those would have the bot marvelling at a rocket
 * nobody can see it react to.
 *
 * A module singleton rather than context on purpose. The flights portal into
 * `<body>` and the watchers sit in arbitrary corners of the tree; threading a
 * provider above both would couple the app's layout to what is, in the end,
 * one nullable element reference.
 */

type Listener = () => void;

let flyingRocket: HTMLElement | null = null;
const listeners = new Set<Listener>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

/**
 * Registers `element` as the rocket currently in flight. Returns the teardown,
 * which only clears the slot if this flight still owns it — two overlapping
 * flights resolve to "the newest one wins", and the older teardown arriving
 * late must not wipe out the flight that superseded it.
 */
export function announceRocketFlight(element: HTMLElement): () => void {
    flyingRocket = element;
    notify();

    return () => {
        if (flyingRocket !== element) return;
        flyingRocket = null;
        notify();
    };
}

/** The rocket currently crossing the screen, if any. */
export function getFlyingRocket(): HTMLElement | null {
    return flyingRocket;
}

/**
 * Calls `listener` whenever a flight starts or ends. Returns the unsubscribe.
 * Shaped for `useSyncExternalStore`, but a plain effect works just as well.
 */
export function subscribeToRocketFlight(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
