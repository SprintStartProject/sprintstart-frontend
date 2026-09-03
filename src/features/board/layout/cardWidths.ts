import type { BoardCard } from "../types";

/**
 * Cards a column is too narrow for: the picture needs the width more than the layout does.
 *
 * The one width the hire does not get to choose. Everything else about a card's size is theirs —
 * see `cardSizes.ts` — but half of a half-width diagram is not a diagram, so this one is decided
 * for them and cannot be pulled narrower.
 *
 * All that is left of this file. It used to hold a height estimate per card kind and a greedy
 * two-column packer; the grid measures what a card actually is instead, which is what let a card
 * be one column, two or four in the first place.
 */
export function spansFullWidth(card: BoardCard): boolean {
  return card.content.kind === "DIAGRAM";
}

/**
 * Deals items into columns, shortest column first, keeping the board's order within each.
 *
 * The greedy pass is what closes the gaps a row grid leaves: a one-line note does not have to wait
 * for the tall card beside it to finish. Reading runs down a column and then over to the next, the
 * way a newspaper does — and on a phone there is one column, so the order is exactly the hire's.
 *
 * Generic in what it deals, because a named area is packed alongside cards rather than laid out
 * around them: an area holding one short note should take a short box beside its neighbours, not a
 * full-width band with an empty half. All this needs from an item is a weight.
 */
export function packIntoColumns<T>(
  items: T[],
  columns: number,
  weightOf: (item: T) => number,
): T[][] {
  const packed: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);

  for (const card of items) {
    let shortest = 0;
    for (let index = 1; index < columns; index += 1) {
      if (heights[index] < heights[shortest]) shortest = index;
    }
    packed[shortest].push(card);
    heights[shortest] += weightOf(card);
  }

  return packed;
}
