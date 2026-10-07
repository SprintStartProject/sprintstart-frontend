/**
 * A tiny event bus that lets any surface open the always-on AI buddy and seed it
 * with a draft — without lifting the widget's streaming state into global context.
 *
 * The point is deliberate hierarchy: the AI buddy is the *drafting aid* a hire
 * reaches for on the way to asking a real person, so the human buddy card can
 * say "draft this with the AI" and hand off here. The widget (mounted once at the
 * app root) subscribes; everything else only dispatches.
 */

const OPEN_AI_BUDDY_EVENT = "sprintstart:open-ai-buddy";

/** Detail carried when opening the AI buddy: an optional message to pre-fill. */
export type OpenAiBuddyDetail = { draft?: string };

/**
 * Opens the AI buddy, optionally pre-filling the composer with `draft`.
 * A no-op if the widget is not mounted (e.g. for non-USER roles).
 */
export function openAiBuddy(detail: OpenAiBuddyDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenAiBuddyDetail>(OPEN_AI_BUDDY_EVENT, { detail }));
}

/**
 * Subscribes to open-requests. Returns an unsubscribe function.
 * Used by the AI buddy widget's hook; not intended for other callers.
 */
export function onOpenAiBuddy(handler: (detail: OpenAiBuddyDetail) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<OpenAiBuddyDetail>).detail ?? {});
  window.addEventListener(OPEN_AI_BUDDY_EVENT, listener);
  return () => window.removeEventListener(OPEN_AI_BUDDY_EVENT, listener);
}

const BUDDY_PAGE_READY_EVENT = "sprintstart:buddy-page-ready";

/**
 * Announced by `/buddy` once it has mounted and painted.
 *
 * The dock's hand-off needs this because navigation is not synchronous: React Router wraps route
 * changes in `React.startTransition`, so React keeps the *previous* page on screen until the new
 * one is ready to commit. A hand-off timed on a clock therefore uncovered whatever was underneath
 * — which, during that window, is still the page the hire was leaving.
 *
 * A signal rather than a longer timeout: the wait depends on how long the page takes to render,
 * which is not ours to guess. The widget keeps a fallback for the case where this never arrives.
 */
export function announceBuddyPageReady(): void {
  window.dispatchEvent(new Event(BUDDY_PAGE_READY_EVENT));
}

/** Subscribes to the page's ready signal. Returns an unsubscribe function. */
export function onBuddyPageReady(handler: () => void): () => void {
  window.addEventListener(BUDDY_PAGE_READY_EVENT, handler);
  return () => window.removeEventListener(BUDDY_PAGE_READY_EVENT, handler);
}

const BUDDY_PATH_CHANGED_EVENT = "sprintstart:buddy-path-changed";

/**
 * Announced after the hire confirms a buddy action that changed their onboarding path.
 *
 * The buddy lives in a dock over whatever page the hire is on, and the path page is the page they
 * are most likely to be on while talking about their path. Without this, confirming "mark this step
 * as done" left a page behind the dock still showing it open — the hire's own click looking like it
 * had done nothing.
 *
 * A signal rather than shared state, for the same reason `openAiBuddy` is one: the dock would
 * otherwise have to know about the onboarding page's data layer, and every other surface that grows
 * an interest in the path would have to be wired through it too. Whoever is showing a path listens;
 * nobody has to.
 */
export function announceBuddyPathChanged(): void {
  window.dispatchEvent(new Event(BUDDY_PATH_CHANGED_EVENT));
}

/** Subscribes to path changes the buddy made. Returns an unsubscribe function. */
export function onBuddyPathChanged(handler: () => void): () => void {
  window.addEventListener(BUDDY_PATH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(BUDDY_PATH_CHANGED_EVENT, handler);
}
