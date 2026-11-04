import { useCallback, useMemo } from "react";
import { moveTo } from "../../../utils/moveTo";
import type { CardStack } from "../layout/cardStacks";
import type { BoardCard } from "../types";

type BoardOrderInput = {
  cards: BoardCard[];
  boardOrder: string[] | undefined;
  stacks: Map<string, CardStack> | undefined;
  expandedStackIds: ReadonlySet<string> | undefined;
  onReorder: ((cardIds: string[]) => void) | undefined;
};

/** The order the board is in, and the ways of changing it that a card's own controls offer. */
export function useBoardOrder({
  cards,
  boardOrder,
  stacks,
  expandedStackIds,
  onReorder,
}: BoardOrderInput) {
  /** The cards on screen, in the order they are drawn. */
  const shownIds = useMemo(() => cards.map((card) => card.id), [cards]);

  /**
   * The whole board's order, filtered cards included.
   *
   * A reorder replaces the board's order outright, so it has to be expressed over *all* of it:
   * built from what is on screen, a drag on a narrowed board would tell the server about a fraction
   * of it. Every move here is expressed as "put this card where that one is", and the card it names
   * is one the hire can see and point at. {@link moveTo} then does the insertion in the full order,
   * so twenty hidden cards between the two change nothing about where the moved one lands.
   */
  const ids = useMemo(() => boardOrder ?? shownIds, [boardOrder, shownIds]);

  /**
   * {@link moveTo}, but a closed pile travels whole.
   *
   * A closed pile is drawn as its top card, so moving that card is — to the hire — moving the pile.
   * Moving only the one card would scatter the others through the order behind it, and the pile
   * would open later with its cards strewn across the board.
   */
  const reorder = useCallback(
    (cardId: string, targetId: string): string[] => {
      const pile = stacks?.get(cardId);
      if (!pile || expandedStackIds?.has(pile.rootId)) return moveTo(ids, cardId, targetId);

      const members = new Set(pile.memberIds);
      if (members.has(targetId)) return ids;

      const moved = moveTo(ids, cardId, targetId).filter((id) => id === cardId || !members.has(id));
      const at = moved.indexOf(cardId);
      const block = pile.memberIds.filter((id) => ids.includes(id));

      return [...moved.slice(0, at), ...block, ...moved.slice(at + 1)];
    },
    [expandedStackIds, ids, stacks],
  );

  const move = onReorder
    ? (cardId: string, direction: "up" | "down") => {
        // Stepped through what is *shown*: the neighbour a hire means by "up" is the card above
        // this one on their screen, not whichever card the full order happens to have next.
        const from = shownIds.indexOf(cardId);
        const to = direction === "up" ? from - 1 : from + 1;
        if (from === -1 || to < 0 || to >= shownIds.length) return;

        // Anchored on that neighbour rather than swapped by index, so the step means the same
        // thing whether or not there are hidden cards between the two.
        onReorder(reorder(cardId, shownIds[to]));
      }
    : undefined;

  return { ids, reorder, move };
}
