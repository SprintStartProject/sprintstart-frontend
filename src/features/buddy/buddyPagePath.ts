/** Where the full conversation lives. The dock grows into it rather than getting bigger. */
export const BUDDY_PAGE_PATH = "/buddy";

/**
 * Whether `pathname` is the buddy page — the bare `/buddy` or one conversation's `/buddy/:id`.
 *
 * Exact on the segment, so a sibling route that merely starts with the same letters is not
 * mistaken for the page.
 */
export function isBuddyPagePath(pathname: string): boolean {
  return pathname === BUDDY_PAGE_PATH || pathname.startsWith(`${BUDDY_PAGE_PATH}/`);
}

/** The conversation id a `/buddy/:id` address names, or `null` for any other path. */
export function buddySessionIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(`${BUDDY_PAGE_PATH}/`)) return null;

  const id = pathname.slice(BUDDY_PAGE_PATH.length + 1).split("/")[0];
  if (!id) return null;

  try {
    return decodeURIComponent(id);
  } catch {
    // A malformed escape names no conversation; the page's own fallback handles the address.
    return null;
  }
}
