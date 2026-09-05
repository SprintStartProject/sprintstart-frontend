// ============================================================
// features/knowledge-gaps/ownerAnnouncement.ts
// ============================================================
// Which components a user has already been told they own.
// ============================================================

/**
 * Keyed per user, because two people share a browser more often than an assignment.
 *
 * Local storage rather than the backend: there is no endpoint for "has this person seen this",
 * and a notice that reappears once on a second machine is a far smaller problem than one that
 * cannot be dismissed at all. Moving it server-side later means replacing these two functions.
 */
function storageKey(userId: string): string {
  return `sprintstart:knowledge-gap-owner-seen:${userId}`;
}

/**
 * The components this user has already been shown as theirs.
 *
 * Everything is checked rather than trusted: this is user-writable storage, and a hand-edited
 * entry must not be able to take the announcement — and with it the page it sits on — down.
 */
export function readAnnouncedComponents(userId: string): Set<string> {
  if (!userId) return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    // Unreadable storage (private mode, quota, corrupt JSON) means nothing announced yet.
    return new Set();
  }
}

/**
 * Records the components the user has now been told about.
 *
 * Deliberately a replace and not a merge: what is written is the set the user was just shown,
 * so a component they stop owning drops out and would be announced again if it ever came back
 * — which is the right answer, because being made an owner a second time is news again.
 */
export function storeAnnouncedComponents(userId: string, components: readonly string[]): void {
  if (!userId) return;

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...components]));
  } catch {
    // A dismissed notice is a convenience. Losing it beats interrupting the user.
  }
}
