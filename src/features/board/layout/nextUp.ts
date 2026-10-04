import type { CardState } from "./boardStructure";
import type { BoardCard } from "../types";

/**
 * How many cards this one alone is holding up.
 *
 * Only the ones it alone is holding: a card that would still be blocked by something else
 * afterwards has not been freed by finishing this, and counting it would make the line promise more
 * than doing the work delivers.
 *
 * Said on any card somebody can actually start, while the board is being planned: it is what
 * begins because of finishing that one.
 */
export function unblockedByFinishing(
  cards: readonly BoardCard[],
  states: Map<string, CardState>,
  cardId: string,
): number {
  return cards.filter((card) => {
    const blockers = states.get(card.id)?.blockedBy ?? [];
    return blockers.length === 1 && blockers[0].id === cardId;
  }).length;
}
