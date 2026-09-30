// ============================================================
// features/dashboard/layout/storage.ts
// ============================================================
// Where a user's dashboard arrangement lives between visits.
// ============================================================

import { isDashboardWidgetSize } from "./sizes";
import type { DashboardLayout, DashboardWidgetId } from "./types";

/**
 * Bumped whenever a stored layout could no longer be read the way it was written.
 *
 * v2 cut the size vocabulary to three, so a v1 layout holding a `large` or a `full` would
 * lose those cards one by one — throwing the whole arrangement away and rebuilding the
 * default is the kinder failure.
 *
 * A mismatch throws the arrangement away and falls back to the default, which is the right
 * trade for a preference: rebuilding a dashboard costs a minute, and a half-migrated one
 * would be a puzzle.
 */
export const LAYOUT_VERSION = 2;

/**
 * Keyed per user, because two people share a browser more often than a dashboard.
 *
 * Local storage, and no longer only local storage: `useDashboardLayoutSync.ts` sends the layout to
 * `PUT /users/me/dashboard/layout` after every change and reads it back on arrival, so the
 * arrangement follows the user to another machine. This is still where the client writes first and
 * reads from, which keeps every gesture instant and a failed request free.
 */
function storageKey(userId: string): string {
  return `sprintstart:dashboard-layout:${userId}`;
}

type StoredLayout = {
  version: number;
  items: unknown;
};

/**
 * Reads the stored arrangement, or `null` when there is none to read.
 *
 * Every item is checked rather than trusted: this is user-writable storage, and a hand-edited
 * or half-written entry must not be able to take the dashboard down. `knownIds` is what the
 * catalog currently knows, so a widget that was removed from the app disappears from an old
 * layout instead of rendering as a blank card.
 */
export function readStoredLayout(
  userId: string,
  knownIds: readonly DashboardWidgetId[],
): DashboardLayout | null {
  if (!userId) return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed?.version !== LAYOUT_VERSION || !Array.isArray(parsed.items)) return null;

    const known = new Set<string>(knownIds);

    return parsed.items.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];

      const { id, size } = item as { id?: unknown; size?: unknown };
      if (typeof id !== "string" || !known.has(id) || !isDashboardWidgetSize(size)) return [];

      return [{ id: id as DashboardWidgetId, size }];
    });
  } catch {
    // Unreadable storage (private mode, quota, corrupt JSON) means no preference, not an error.
    return null;
  }
}

export function storeLayout(userId: string, layout: DashboardLayout): void {
  if (!userId) return;

  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ version: LAYOUT_VERSION, items: layout } satisfies StoredLayout),
    );
  } catch {
    // A dashboard arrangement is a convenience. Losing it beats interrupting the user.
  }
}

/** Forgets the arrangement, so the next read falls back to the default layout. */
export function clearStoredLayout(userId: string): void {
  if (!userId) return;

  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // See storeLayout.
  }
}

/**
 * Whether this browser has exchanged this user's layout with the server at least once.
 *
 * What lets the sync tell "never synced" from "reset somewhere else" when the server has nothing:
 * a local layout that was never synced is the one to migrate up, while one that was is a stale
 * copy of a layout the user has since reset on another device, and must not bring it back.
 *
 * Its own key rather than a field on the layout, because it outlives the layout: a reset on this
 * device clears the layout but not the fact that this browser knows the server.
 */
function syncedKey(userId: string): string {
  return `sprintstart:dashboard-layout-synced:${userId}`;
}

export function readLayoutSynced(userId: string): boolean {
  if (!userId) return false;

  try {
    return window.localStorage.getItem(syncedKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function markLayoutSynced(userId: string): void {
  if (!userId) return;

  try {
    window.localStorage.setItem(syncedKey(userId), "true");
  } catch {
    // See storeLayout.
  }
}
