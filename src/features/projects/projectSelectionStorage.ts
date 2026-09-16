// ============================================================
// features/projects/projectSelectionStorage.ts
// ============================================================
// Which project each user had selected, remembered between
// page loads and kept apart from everyone else's.
// ============================================================

/*
  Keyed per user, because the selection outlives the session that made it. On a shared
  browser the unscoped key handed the next person the previous one's project, and the app
  asked the backend about a project that person has no membership in before it had loaded
  any projects to check the selection against.

  Local storage rather than the backend: this is a convenience preference with no endpoint
  behind it, and a selection that resets on a second machine is a smaller problem than one
  that cannot be made at all.
*/
const SELECTION_STORAGE_KEY = "sprintstart:selected-project-id";

/** The key one user's selection lives under. */
function selectionKey(userId: string): string {
  return `${SELECTION_STORAGE_KEY}:${userId}`;
}

/**
 * The project this user had selected last, or `""` when there is nothing to restore.
 *
 * Everything is checked rather than trusted, the same way the owner-announcement storage is:
 * this is user-writable storage, and a hand-edited entry must not be able to take down the
 * provider that reads it.
 */
export function readStoredProjectId(userId: string): string {
  if (!userId) return "";

  try {
    return window.localStorage.getItem(selectionKey(userId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Remembers this user's selected project, and forgets it when handed an empty ID.
 *
 * An empty ID is a real answer — "this user has no project to select" — so the entry is
 * removed rather than left pointing at a project that may since have gone away.
 */
export function storeProjectId(userId: string, projectId: string): void {
  if (!userId) return;

  try {
    if (projectId) {
      window.localStorage.setItem(selectionKey(userId), projectId);
      return;
    }

    window.localStorage.removeItem(selectionKey(userId));
  } catch {
    // Project selection is a convenience preference. Ignore storage failures.
  }
}

/**
 * Deletes the unscoped selection an earlier version of the app left behind.
 *
 * Never read: a value stored under the unscoped key cannot be attributed to the person now
 * signed in, and guessing is the leak this module exists to close. Callers run this once a
 * user is known, because until then there is no way to tell whose selection it was.
 */
export function dropLegacySelection(): void {
  try {
    window.localStorage.removeItem(SELECTION_STORAGE_KEY);
  } catch {
    // Nothing to do: whoever wrote the entry owns whatever happens to it.
  }
}
