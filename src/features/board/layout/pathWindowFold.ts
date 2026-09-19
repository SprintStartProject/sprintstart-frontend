/**
 * Whether the hire has the strip showing where they stand folded shut, between visits.
 *
 * Local storage, like every other fold on this board: there is no endpoint for it, and a
 * preference that follows the machine is closer to right than one that does not exist. Keyed by
 * board, because a hire on two projects is standing somewhere different on each.
 *
 * Deliberately *not* part of the board document the other seven layers sync upstream, and so it
 * does not announce itself through `boardStorage`. Those seven describe the arrangement of the
 * cards, which is the thing worth carrying between machines; this is one strip, folded or not, and
 * sending a round trip for it would be the tail wagging the dog.
 */
const STORAGE_VERSION = 1;

function foldKey(boardId: string): string {
  return `sprintstart:board-path-window:${boardId}`;
}

/**
 * Whether the strip is on the board at all, kept apart from whether it is folded.
 *
 * Two keys rather than one record, because the two are owned by different places: the strip folds
 * itself, and the board decides whether the strip exists — the switch that brings it back has to
 * live somewhere the strip is not. One record would have them writing over each other's half.
 */
function shownKey(boardId: string): string {
  return `sprintstart:board-path-shown:${boardId}`;
}

type StoredFold = { version: number; open: unknown };
type StoredShown = { version: number; shown: unknown };

/**
 * Whether the strip is open, defaulting to open.
 *
 * Open is the default because the strip exists to answer a question nobody thought to ask — a hire
 * who has never seen it cannot have decided they would rather not. Anything unreadable in storage
 * means the same thing: this board has no answer yet, so show it. Storage itself can throw, in a
 * private window or with site data blocked, and a strip that renders open is a fine answer to that.
 */
export function readPathWindowOpen(boardId: string): boolean {
  if (!boardId) return true;

  try {
    const raw = window.localStorage.getItem(foldKey(boardId));
    if (!raw) return true;

    const parsed = JSON.parse(raw) as StoredFold;
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.open !== "boolean") return true;

    return parsed.open;
  } catch {
    return true;
  }
}

/** Stores the fold. A storage that refuses is not a reason to lose it for this visit. */
export function writePathWindowOpen(boardId: string, open: boolean): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      foldKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, open } satisfies StoredFold),
    );
  } catch {
    // Nothing to do and nothing to say: the fold still holds for this visit.
  }
}

/**
 * Whether the strip is on this board, defaulting to yes.
 *
 * Same reasoning as the fold: a hire who has never seen it cannot have decided against it, and
 * anything unreadable means this board has no answer yet.
 */
export function readPathWindowShown(boardId: string): boolean {
  if (!boardId) return true;

  try {
    const raw = window.localStorage.getItem(shownKey(boardId));
    if (!raw) return true;

    const parsed = JSON.parse(raw) as StoredShown;
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.shown !== "boolean") return true;

    return parsed.shown;
  } catch {
    return true;
  }
}

/** Stores whether the strip is on this board. */
export function writePathWindowShown(boardId: string, shown: boolean): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      shownKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, shown } satisfies StoredShown),
    );
  } catch {
    // Nothing to do and nothing to say: it still holds for this visit.
  }
}
