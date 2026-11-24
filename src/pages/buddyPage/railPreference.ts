/**
 * Names the rail — the hire's conversations — for assistive tech and labels the control that
 * reopens it.
 *
 * One constant, because those two have to say the same thing: `aria-controls` points the
 * second at the first, and a screen reader that announced two different names for one region
 * would be describing two things that do not exist.
 */
export const RAIL_LABEL = "Your conversations";

/** The rail region's id — the toggle's `aria-controls` points at it. */
export const RAIL_ID = "buddy-rail";

/**
 * Where the rail's collapsed state lives between visits. Per window rather than per user: it is a
 * statement about how much room this window has to spare, not about a conversation or a user.
 */
const RAIL_OPEN_KEY = "buddyRailOpen";

/** `null` when the hire has never said either way — the rail then starts closed. */
export function readRailOpen(): boolean | null {
  try {
    // Read through the pre-rename key `buddyPmRepliesOpen` once, so a rename does not throw away a
    // choice already made.
    const stored =
      localStorage.getItem(RAIL_OPEN_KEY) ?? localStorage.getItem("buddyPmRepliesOpen");

    return stored === null ? null : stored === "true";
  } catch {
    // Private modes can refuse storage outright. Not a reason to fail to render a rail.
    return null;
  }
}

export function writeRailOpen(open: boolean): void {
  try {
    localStorage.setItem(RAIL_OPEN_KEY, String(open));
  } catch {
    // Nothing to do: the rail still opens and closes, it just will not be remembered.
  }
}

/**
 * The answered replies the hire has already looked at, so the header's badge can say "new"
 * rather than "ever".
 *
 * `usePmReplies` has no read state of its own and the backend has none to give: an answer is
 * ANSWERED, and whether it has been seen is a fact about this browser. Ids, not a count — an
 * answer read yesterday must not make today's answer look seen.
 */
function seenRepliesKey(userId: string): string {
  return `buddyPmRepliesSeen:${userId}`;
}

export function readSeenReplyIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(seenRepliesKey(userId));

    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private modes can refuse storage outright. Erring towards showing the badge says
    // something rather than staying silent about an answer.
    return [];
  }
}

export function writeSeenReplyIds(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(seenRepliesKey(userId), JSON.stringify(ids));
  } catch {
    // Same as above: the badge stays up, nothing breaks.
  }
}
