/**
 * How a hire wants their own board to look, between visits.
 *
 * Local storage, the same bargain the folded cards, the pins and the areas make: there is no
 * endpoint for it, and a preference that follows the machine is closer to right than one that does
 * not exist. This one strains that bargain hardest, though, and the TODO below says why.
 *
 * TODO(backend): `POST /me/board/preferences`, or a `preferences` object on the board-structure
 * endpoint the stages and dependencies are waiting for. Structure being local is annoying;
 * *personalisation* being local is worse, because the whole point of it is that it is yours — a
 * hire who set their board up the way they like it and then opened it on a laptop would find none
 * of it, which reads as the app having forgotten them rather than as a storage limitation.
 *
 * Keyed by board, because a hire on two projects may want them different.
 */
const STORAGE_VERSION = 1;

/**
 * How much room the board gives each card.
 *
 * The answer to "can I make the cards smaller", which arrives as a per-card question and is a
 * board-wide one: a board of cards at four sizes is not denser, it is noisier, and the packing
 * balances columns from estimated heights that per-card sizing would quietly invalidate. One
 * setting moves the padding and the gaps together, which is the part that actually buys screen.
 */
export type BoardDensity = "cozy" | "compact";

export type BoardPreferences = {
  density: BoardDensity;
  /**
   * Whether the section bar and the "showing X of Y" line are hidden.
   *
   * For the visits where the board is something to read rather than something to work: the tools
   * are how you *change* what is shown, and a hire who is not changing anything is looking past
   * them. Hidden, not removed — the control that hides them says so and brings them back.
   */
  toolsHidden: boolean;
};

export const DEFAULT_PREFERENCES: BoardPreferences = { density: "cozy", toolsHidden: false };

function storageKey(boardId: string): string {
  return `sprintstart:board-preferences:${boardId}`;
}

type Stored = { version: number; preferences: unknown };

/**
 * This board's preferences, or the defaults.
 *
 * Every field is checked rather than trusted: this is user-writable storage, and a hand-edited or
 * half-written entry must not be able to take the board down. Storage itself can throw — a private
 * window, or a browser set to block site data — and a board that renders at its defaults is a fine
 * answer to that, so nothing here is allowed to escape.
 */
export function readBoardPreferences(boardId: string): BoardPreferences {
  if (!boardId) return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.preferences !== "object") {
      return DEFAULT_PREFERENCES;
    }

    const stored = parsed.preferences as Partial<BoardPreferences>;

    return {
      density: stored.density === "compact" ? "compact" : "cozy",
      toolsHidden: stored.toolsHidden === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Stores the preferences. A storage that refuses is not a reason to lose them on screen. */
export function writeBoardPreferences(boardId: string, preferences: BoardPreferences): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, preferences } satisfies Stored),
    );
  } catch {
    // Nothing to do and nothing to say: the choice still holds for this visit.
  }
}
