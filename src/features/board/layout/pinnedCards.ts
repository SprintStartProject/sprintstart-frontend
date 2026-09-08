import { notifyBoardStorageWritten } from "./boardStorage";

/**
 * Which of a board's cards the hire has pinned to the top, between visits.
 *
 * Local storage, the same bargain the folded cards and the dashboard's arrangement make: there is
 * no endpoint for it, and a preference that follows the machine is closer to right than one that
 * does not exist. Moving it server-side later means replacing these two functions.
 *
 * Keyed by board, because a hire on two projects pins different things on each.
 */
const STORAGE_VERSION = 1;

function storageKey(boardId: string): string {
  return `sprintstart:board-pinned:${boardId}`;
}

type StoredPins = {
  version: number;
  ids: unknown;
};

/**
 * The pinned card ids for this board, or an empty set.
 *
 * Every entry is checked rather than trusted: this is user-writable storage, and a hand-edited or
 * half-written entry must not be able to take the board down. Storage itself can throw — a private
 * window, or a browser set to block site data — and a board that renders unpinned is a fine answer
 * to that, so nothing here is allowed to escape.
 */
export function readPinnedCards(boardId: string): Set<string> {
  if (!boardId) return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as StoredPins;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.ids)) return new Set();

    return new Set(parsed.ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Stores the pinned card ids. A storage that refuses is not a reason to lose the pin on screen. */
export function writePinnedCards(boardId: string, ids: Set<string>): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, ids: [...ids] } satisfies StoredPins),
    );
  } catch {
    // Nothing to do and nothing to say: the pin still holds for this visit.
  }

  notifyBoardStorageWritten();
}
