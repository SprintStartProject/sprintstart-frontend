/** The id of the page's one `<main>`: the target of the skip link and of the focus move on navigation. */
export const MAIN_CONTENT_ID = "main-content";

/** Set on the `<main>` of a loading skeleton, which must not take a pending focus request. */
export const MAIN_PLACEHOLDER_ATTRIBUTE = "data-main-placeholder";

/** How long a focus request waits for the page to render its real `<main>` (a lazy route). */
const FOCUS_REQUEST_TTL_MS = 5000;

let pendingFocusRequestAt: number | null = null;

function focusMainContent(main: HTMLElement) {
  // A page that has already put focus somewhere inside itself (an autofocused field) keeps it.
  if (main.contains(document.activeElement)) return;
  main.focus({ preventScroll: true });
}

/**
 * Moves focus to the page's `<main>` after a route change (WCAG 2.4.3).
 *
 * Without it a keyboard user who activates a sidebar link stays on that link, and the next Tab goes
 * to the link after it instead of into the page they just opened. When the new route is still
 * loading (a lazy chunk behind a `Suspense` fallback) the request is kept and handed to the
 * first real `MainContent` that mounts, through {@link claimPendingMainContentFocus}.
 */
export function requestMainContentFocus() {
  const main = document.getElementById(MAIN_CONTENT_ID);

  if (main && !main.hasAttribute(MAIN_PLACEHOLDER_ATTRIBUTE)) {
    pendingFocusRequestAt = null;
    focusMainContent(main);
    return;
  }

  pendingFocusRequestAt = Date.now();
}

/** Called by a freshly mounted `MainContent`: takes the focus request that was waiting for it, if any. */
export function claimPendingMainContentFocus() {
  if (pendingFocusRequestAt === null) return;

  const isFresh = Date.now() - pendingFocusRequestAt < FOCUS_REQUEST_TTL_MS;
  pendingFocusRequestAt = null;
  if (!isFresh) return;

  const main = document.getElementById(MAIN_CONTENT_ID);
  if (main) focusMainContent(main);
}
