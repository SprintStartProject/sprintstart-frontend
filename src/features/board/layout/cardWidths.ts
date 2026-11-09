import type { BoardCard } from "../types";

/**
 * Cards a column is too narrow for: the picture needs the width more than the layout does.
 *
 * The one width the hire does not get to choose. Everything else about a card's size is theirs —
 * see `cardSizes.ts` — but half of a half-width diagram is not a diagram, so this one is decided
 * for them and cannot be pulled narrower.

 */
export function spansFullWidth(card: BoardCard): boolean {
  return card.content.kind === "DIAGRAM";
}
