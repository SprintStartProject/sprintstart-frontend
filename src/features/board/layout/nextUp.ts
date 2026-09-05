import { cardName } from "./cardNames";
import { stageOrder, type CardState } from "./boardStructure";
import type { BoardCard } from "../types";

/**
 * The one card to start with, and what finishing it would let through.
 *
 * The board already answers "what is there" four ways — stages, areas, sequences, a focus section.
 * All four are *subsets*, and a subset of forty is still a list to choose from. This is the answer
 * to the question underneath the original complaint, which was never "show me fewer cards" but
 * "tell me where to start".
 *
 * **Derived, never stored.** It is a question about the board as it is right now, and the moment it
 * were a flag somebody had to clear it would be wrong on the next tick.
 */
export type NextUp = {
  card: BoardCard;
  /** What it is called, so the caller does not have to know how a card gets its name. */
  name: string;
  /**
   * How many cards are waiting on this one and on nothing else.
   *
   * Only the ones this card alone is holding up. A card that would still be blocked by something
   * else afterwards has not been freed by finishing this, and counting it would make the line
   * promise more than doing the work delivers.
   */
  unblocks: number;
};

/**
 * What to do next, or null when the board should not be telling anybody.
 *
 * The choice is deliberately the dullest one that is defensible: **the first card in the hire's own
 * order that is open and not waiting on anything, earliest stage first.** No scoring, no urgency
 * model, nothing the board would have to justify. The hire arranged this board; the first thing in
 * their arrangement that they *can* do is the honest reading of "where do I start".
 *
 * Ranking by anything cleverer was the temptation and is the trap. A board that reorders somebody's
 * own arrangement by a rule it invented has to explain itself every time, and the explanation is
 * always worse than the arrangement it overrode.
 */
export function nextUp(
  cards: BoardCard[],
  states: Map<string, CardState>,
  options: { crowded: boolean },
): NextUp | null {
  // On a board somebody can read at a glance, "start here" is a line pointing at something they are
  // already looking at. The threshold is the same one that decides whether the board folds at all.
  if (!options.crowded) return null;

  const open = cards.filter((card) => states.get(card.id)?.status === "OPEN");
  // Nothing open is the only case with no answer. It is tempting to also stay quiet when exactly
  // one card is open — a line pointing at the only thing you can do looks like it is pointing at
  // itself — and that is wrong on the board this is for: twenty cards of which nineteen are waiting
  // on the twentieth is the single most useful moment to say which one it is.
  if (open.length === 0) return null;

  const first = [...open].sort(byStageThenOrder(cards, states))[0];

  return {
    card: first,
    name: cardName(first),
    unblocks: cards.filter((card) => {
      const blockers = states.get(card.id)?.blockedBy ?? [];

      return blockers.length === 1 && blockers[0].id === first.id;
    }).length,
  };
}

/**
 * Earliest stage first, then the hire's own order.
 *
 * The stage is the only reordering this does, and it is not the board's opinion: `LATER` is the hire
 * or their PM having said "not yet", so starting there would be pointing at something somebody
 * already put aside.
 */
function byStageThenOrder(cards: BoardCard[], states: Map<string, CardState>) {
  const order = new Map(cards.map((card, index) => [card.id, index]));

  return (a: BoardCard, b: BoardCard): number => {
    const stages =
      stageOrder(states.get(a.id)?.stage ?? "NOW") - stageOrder(states.get(b.id)?.stage ?? "NOW");

    return stages !== 0 ? stages : (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  };
}
