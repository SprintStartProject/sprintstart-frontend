/**
 * Where a card came from, and the way back to it.
 *
 * A note the hire made from a paragraph in the knowledge base, a reply they froze out of a
 * conversation, a link they picked up in an onboarding step — each of those was *found* somewhere,
 * and a week later "where did I get this" is the question the card cannot answer on its own. The
 * text can be re-read; the place it came from is gone the moment the card is written.
 *
 * Stored beside the card rather than inside it because the card catalog is closed and `NOTE` holds
 * one field: its text. Putting a URL in that text would make the note say something the hire did
 * not write, in a card kind whose whole promise is that its contents are theirs.
 *
 * Local storage, per project, the way the folds, the pins, the areas and the card sizes are.
 *
 * TODO(backend): this wants to be a real field — `sourceUrl` and `sourceLabel` on the authored-card
 * request, carried on `POST /me/board/cards` and returned with the card. It is the one piece of
 * personalisation here that is not a preference but a *fact about where something came from*: a
 * hire who opens their board on a different machine keeps every card and loses every trail back,
 * which is worse than never having offered the trail. Until then, this.
 *
 * Keyed by project rather than by board, because everything that writes an origin — the selection
 * toolbar, the chat, the buddy dock — knows which project it is in and none of them knows the
 * board's id. One hire has one board per project, so the two keys name the same thing.
 */
import { notifyBoardStorageReplaced, notifyBoardStorageWritten } from "./boardStorage";

const STORAGE_VERSION = 1;

/** Where one card came from. */
export type CardOrigin = {
  /**
   * An in-app path, usually with a `#:~:text=` fragment naming the words that were selected.
   *
   * Relative on purpose: an absolute URL stored on one machine names a host the next one does not
   * have. See `selection/textFragment.ts`.
   */
  url: string;
  /** What to call the place, in words a hire would recognise — a heading, or the page's title. */
  label: string;
};

export type CardOrigins = Record<string, CardOrigin>;

function storageKey(projectId: string): string {
  return `sprintstart:board-card-origins:${projectId}`;
}

type Stored = { version: number; origins: unknown };

/** One stored origin, checked rather than trusted. An entry missing either half says nothing. */
function toOrigin(value: unknown): CardOrigin | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.url !== "string" || raw.url.length === 0) return null;

  // A label is the only part a person reads, but an origin without one is still a way back — the
  // path stands in for it rather than dropping the entry.
  const label = typeof raw.label === "string" && raw.label.length > 0 ? raw.label : raw.url;

  return { url: raw.url, label };
}

/** The origins recorded for this project's board, or none. */
export function readCardOrigins(projectId: string): CardOrigins {
  if (!projectId) return {};

  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Stored;
    if (
      parsed?.version !== STORAGE_VERSION ||
      typeof parsed.origins !== "object" ||
      !parsed.origins
    ) {
      return {};
    }

    const origins: CardOrigins = {};
    for (const [cardId, value] of Object.entries(parsed.origins as Record<string, unknown>)) {
      const origin = toOrigin(value);
      if (origin) origins[cardId] = origin;
    }

    return origins;
  } catch {
    return {};
  }
}

/** Stores the origins. A storage that refuses is not a reason to lose the card that was just made. */
export function writeCardOrigins(projectId: string, origins: CardOrigins): void {
  if (!projectId) return;

  try {
    window.localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({ version: STORAGE_VERSION, origins } satisfies Stored),
    );
  } catch {
    // Nothing to do and nothing to say: the card is on the board either way, which is what the
    // hire actually asked for. The trail back is the part that was best-effort from the start.
  }

  // Announced even when the write threw: the origins held in memory by whoever is listening are
  // still the ones to draw, and a board showing a trail that will not survive a reload beats a
  // board showing none.
  //
  // Both announcements, and origins are the only layer that makes the second one: every surface
  // that records where a card came from — the selection toolbar, a chat, the buddy dock — is
  // mounted outside the board, so nothing else would tell it to look again. See `boardStorage.ts`.
  notifyBoardStorageWritten();
  notifyBoardStorageReplaced();
}

/**
 * Records where one card came from, without the caller having to hold the whole map.
 *
 * Read-modify-write, because the three places that create a card this way — the selection toolbar,
 * a chat message, a buddy reply — all live outside the board and none of them has the board's
 * state. The board reads the map fresh when it mounts.
 */
export function rememberOrigin(projectId: string, cardId: string, origin: CardOrigin): void {
  if (!projectId || !cardId) return;

  writeCardOrigins(projectId, { ...readCardOrigins(projectId), [cardId]: origin });
}

/** Forgets one card's origin — for when the card itself is gone. */
export function forgetOrigin(projectId: string, cardId: string): void {
  if (!projectId || !cardId) return;

  const origins = readCardOrigins(projectId);
  if (!(cardId in origins)) return;

  delete origins[cardId];
  writeCardOrigins(projectId, origins);
}

/** One card's origin, or null when nothing was recorded for it. */
export function originOf(origins: CardOrigins | undefined, cardId: string): CardOrigin | null {
  return origins?.[cardId] ?? null;
}
