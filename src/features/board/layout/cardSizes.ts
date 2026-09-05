/**
 * The size a hire pulled a card to, between visits.
 *
 * The board decides where a card sits — an order the hire arranges, packed into columns by an
 * estimate of how tall each card is. What it never knew is that *this* card matters more than the
 * one beside it: a checklist somebody works from every morning gets the same column as a link they
 * saved once. This is the answer to that, and it is deliberately not free positioning.
 *
 * **Three widths, and they snap.** Not a pixel size: a board of cards at arbitrary
 * sizes is not personalised, it is ragged. The widths are spans on the board's own grid — one, two
 * or four of its four columns — which is what lets "narrower" exist at all. The first cut of this
 * had two widths, because the board packed cards into two columns by flow: a card was either one
 * column or the whole row, so narrow had nowhere to go. The grid is what makes it real.
 *
 * Local storage, per board, the way the folds, the pins and the areas are.
 *
 * TODO(backend): belongs with the rest of the personalisation on `POST /me/board/preferences`, and
 * local hurts more here than it does for the process layer — the whole point of a size somebody
 * chose is that it is theirs, and a hire who set their board up and then opened it on a laptop
 * would find none of it, which reads as the app having forgotten them.
 */
const STORAGE_VERSION = 1;

export type CardWidth = "narrow" | "normal" | "wide";

/**
 * A card's size is its width, and nothing else.
 *
 * **Height was tried and taken back out.** A card is as tall as what is on it: a checklist grows as
 * lines are added, a note as it is written, a card shrinks as it is ticked off. Setting a height by
 * hand meant either a floor with white space under the content — a bigger box, not a bigger card —
 * or a card that grew past the height it was given anyway. The gesture promised control over
 * something that is already answered, correctly, by the content. Width is the opposite: nothing
 * about a note says whether it should be a quarter of the board or half of it, so that one is
 * genuinely the hire's to decide.
 */
export type CardSize = { width: CardWidth };

/** What a card is unless the hire has said otherwise. */
export const DEFAULT_SIZE: CardSize = { width: "normal" };

/**
 * The board's grid at its widest, and how many of its columns each width takes.
 *
 * Four rather than three, because the two interesting widths are "half of normal" and "everything",
 * and both of those need normal to be an even number of columns. Narrower viewports drop to two
 * columns and then to one, and the spans are clamped to what is there — a narrow card on a phone is
 * the whole screen, because a quarter of a phone is not a card, it is a stamp.
 */
export const GRID_COLUMNS = 4;

export const WIDTH_SPAN: Record<CardWidth, number> = { narrow: 1, normal: 2, wide: 4 };

export type CardSizes = Record<string, CardSize>;

function storageKey(boardId: string): string {
  return `sprintstart:board-card-sizes:${boardId}`;
}

type Stored = { version: number; sizes: unknown };

function toSize(value: unknown): CardSize | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<CardSize>;

  // A height from the version that had one is dropped on the way in, which is all the migration
  // this needs: the entry then says only what it still can, and an entry that says nothing is
  // discarded by the reader below.
  return { width: raw.width === "wide" ? "wide" : raw.width === "narrow" ? "narrow" : "normal" };
}

/**
 * The sizes for this board, or none.
 *
 * Every entry is checked rather than trusted, and a card that was pulled to the default size is
 * dropped rather than stored: storage should hold the decisions somebody made, not a row per card
 * saying nothing happened.
 */
export function readCardSizes(boardId: string): CardSizes {
  if (!boardId) return {};

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || typeof parsed.sizes !== "object" || !parsed.sizes) {
      return {};
    }

    const sizes: CardSizes = {};
    for (const [cardId, value] of Object.entries(parsed.sizes as Record<string, unknown>)) {
      const size = toSize(value);
      if (size && !isDefault(size)) sizes[cardId] = size;
    }

    return sizes;
  } catch {
    return {};
  }
}

/** Stores the sizes. A storage that refuses is not a reason to lose them on screen. */
export function writeCardSizes(boardId: string, sizes: CardSizes): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, sizes } satisfies Stored),
    );
  } catch {
    // Nothing to do and nothing to say: the sizes still hold for this visit.
  }
}

export function isDefault(size: CardSize): boolean {
  return size.width === DEFAULT_SIZE.width;
}

/** One card's size, defaulted. */
export function sizeOf(sizes: CardSizes | undefined, cardId: string): CardSize {
  return sizes?.[cardId] ?? DEFAULT_SIZE;
}

/**
 * The size a card becomes when it is pulled sideways.
 *
 * A drag is read as a direction rather than as a distance: one width per threshold, in the
 * direction of travel. A distance would mean inventing a pixel-to-size mapping that is wrong at
 * the other column count, and would make the gesture something to aim rather than something to do.
 */
const WIDTHS: readonly CardWidth[] = ["narrow", "normal", "wide"];

export function sizeFromDrag(start: CardSize, dx: number, threshold = 48): CardSize {
  // One step per threshold, so a long drag to the right goes narrow → normal → wide rather than
  // jumping to the end: the widths are a ramp, and a gesture over a ramp has to be able to stop in
  // the middle of it.
  const at = WIDTHS.indexOf(start.width) + Math.trunc(dx / threshold);

  return { width: WIDTHS[Math.min(Math.max(at, 0), WIDTHS.length - 1)] };
}
