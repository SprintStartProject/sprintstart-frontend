/**
 * Whether the hire has the task pool card on their board.
 *
 * The pool card is a switch, not a dismissal. Dismissing a card is sticky on the server — the board
 * never brings back a card somebody said no to — and for most cards that is the point. The pool is
 * the one way to grab a task without the buddy, though, so losing it for good to one stray press
 * would quietly put the hire back to asking. So its X only hides it, and the switch in the board's
 * rail brings it back, the same way the path strip works (see `pathWindowFold.ts`).
 *
 * Local storage for the same reason as the path strip: a preference that follows the machine is
 * close enough, and it is not worth a round trip. The buddy does not see it.
 */
const STORAGE_VERSION = 1;

function shownKey(boardId: string): string {
  return `sprintstart:board-task-pool-shown:${boardId}`;
}

type StoredShown = { version: number; shown: unknown };

/** Whether the pool is on this board, defaulting to yes — and to yes for anything unreadable. */
export function readTaskPoolShown(boardId: string): boolean {
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

/** Stores whether the pool is on this board. A storage that refuses still holds for this visit. */
export function writeTaskPoolShown(boardId: string, shown: boolean): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      shownKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, shown } satisfies StoredShown),
    );
  } catch {
    // Nothing to do and nothing to say.
  }
}
