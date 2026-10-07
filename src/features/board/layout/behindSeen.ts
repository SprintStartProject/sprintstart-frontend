/**
 * The cards that were filed under "Behind you" when the hire last looked at this board.
 *
 * "Behind you" arrives folded, so a card that moved there while the hire was elsewhere — kept from a
 * step of a finished phase, say, or behind them since they finished a phase on the Onboarding page —
 * would be filed out of sight with nothing saying so. Comparing against what was there last time
 * lets the board unfold the band once for the newcomers.
 *
 * Local storage, per board, and not part of the synced arrangement: it is about what this person
 * has seen on this machine, which is exactly what a second machine does not know either.
 */
const STORAGE_VERSION = 1;

function storageKey(boardId: string): string {
  return `sprintstart:board-behind-seen:${boardId}`;
}

type Stored = { version: number; ids: unknown };

/** The ids seen behind last time, or null when this board has never been looked at here. */
export function readBehindSeen(boardId: string): Set<string> | null {
  if (!boardId) return null;

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.ids)) return null;

    return new Set(parsed.ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return null;
  }
}

/** Remembers what is behind now. A storage that refuses is ignored. */
export function writeBehindSeen(boardId: string, ids: readonly string[]): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, ids } satisfies Stored),
    );
  } catch {
    // The band just stays folded next time, which is how it always behaved.
  }
}

/** Whether any of the cards behind now were not behind before. Nothing known before means no. */
export function hasNewlyBehind(
  before: ReadonlySet<string> | null,
  now: readonly string[],
): boolean {
  return before !== null && now.some((id) => !before.has(id));
}
