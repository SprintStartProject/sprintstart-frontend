/**
 * Which finished phases the hire has already been offered a recap for.
 *
 * The recap itself carries no bookkeeping: the board asks the buddy to open it with a `[[Phase]]`
 * link, and a kept note linking to a phase files under that phase like any other.
 *
 * Local storage, per board, and deliberately not part of the synced arrangement: it only decides
 * whether a one-line offer is shown, and seeing that offer once more on a second machine costs
 * nothing. Moving it server-side would mean replacing the two functions below.
 */
const STORAGE_VERSION = 1;

function storageKey(boardId: string): string {
  return `sprintstart:board-phase-recaps:${boardId}`;
}

type Stored = { version: number; ids: unknown };

/** The phases already offered — answered or waved away — for this board. Never throws. */
export function readOfferedRecaps(boardId: string): Set<string> {
  if (!boardId) return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.ids)) return new Set();

    return new Set(parsed.ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Remembers that a phase's recap was offered. A storage that refuses is ignored. */
export function writeOfferedRecaps(boardId: string, ids: ReadonlySet<string>): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, ids: [...ids] } satisfies Stored),
    );
  } catch {
    // The offer comes back next visit, which is the whole cost.
  }
}
