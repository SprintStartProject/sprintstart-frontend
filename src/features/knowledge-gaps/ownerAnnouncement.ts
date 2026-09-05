// ============================================================
// features/knowledge-gaps/ownerAnnouncement.ts
// ============================================================
// What a user has acknowledged about the components they own,
// and which of them the dialog has already interrupted about.
// ============================================================

// Two records, because they answer different questions and one is far stickier than the
// other. The dialog interrupts about a component exactly once, ever -- being told twice that
// you have been given the same thing is noise, and after the first time the markers on the
// widget and in the sidebar are what carry it. Acknowledgement is what puts those markers
// down, and only a press does that.

/**
 * Keyed per user, because two people share a browser more often than an assignment.
 *
 * Local storage rather than the backend: there is no endpoint for "has this person seen this",
 * and a notice that reappears once on a second machine is a far smaller problem than one that
 * cannot be dismissed at all. Moving it server-side later means replacing these functions.
 */
function seenKey(userId: string): string {
  return `sprintstart:knowledge-gap-owner-seen:${userId}`;
}

function announcedKey(userId: string): string {
  return `sprintstart:knowledge-gap-owner-announced:${userId}`;
}

/**
 * The components this user has acknowledged owning.
 *
 * Acknowledged, not merely shown — closing the dialog is not enough, because the dialog can be
 * dismissed by accident and by Escape. Only pressing the marker on the widget puts a component
 * in here, which is what makes the sidebar flag mean "you have not looked at this yet".
 *
 * Everything is checked rather than trusted: this is user-writable storage, and a hand-edited
 * entry must not be able to take down the page it sits on.
 */
export function readSeenComponents(userId: string): Set<string> {
  if (!userId) return new Set();

  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    // Unreadable storage (private mode, quota, corrupt JSON) means nothing seen yet.
    return new Set();
  }
}

/**
 * Records the components the user has now acknowledged.
 *
 * Deliberately a replace and not a merge: what is written is what they own at that moment, so
 * a component they stop owning drops out and would count as new again if it ever came back —
 * which is the right answer, because being made an owner a second time is news again.
 */
export function storeSeenComponents(userId: string, components: readonly string[]): void {
  if (!userId) return;

  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify([...components]));
  } catch {
    // An acknowledged notice is a convenience. Losing it beats interrupting the user.
  }
}

/** The components the dialog has already interrupted this user about. */
export function readAnnouncedComponents(userId: string): Set<string> {
  if (!userId) return new Set();

  try {
    const raw = window.localStorage.getItem(announcedKey(userId));
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    // Unreadable storage: nothing announced yet, so the dialog gets its one chance.
    return new Set();
  }
}

/**
 * Adds to the record rather than replacing it, unlike {@link storeSeenComponents}.
 *
 * The two differ because they mean different things. Acknowledgement is about what you own
 * *now*, so it follows the set; having been told is about what has already happened, and that
 * does not stop being true when the component moves on. The cost is that losing and regaining
 * the same component gives no second dialog — the markers still appear, which is the part that
 * has to work.
 */
export function addAnnouncedComponents(userId: string, components: readonly string[]): void {
  if (!userId || components.length === 0) return;

  try {
    const merged = new Set([...readAnnouncedComponents(userId), ...components]);
    window.localStorage.setItem(announcedKey(userId), JSON.stringify([...merged]));
  } catch {
    // See `storeSeenComponents`.
  }
}
