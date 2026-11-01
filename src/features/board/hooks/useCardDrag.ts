import { useCallback, useState } from "react";
import { toViewport } from "../layout/dragGeometry";
import type { BoardGroup } from "../layout/boardGroups";
import type { CardStack } from "../layout/cardStacks";
import { useCardDrop } from "./useCardDrop";
import { useCardRegistry } from "./useCardRegistry";
import { useDragRest } from "./useDragRest";
import { usePileTarget } from "./usePileTarget";
import { useReorderSwap } from "./useReorderSwap";

type CardDragInput = {
  groups: BoardGroup[];
  stacks: Map<string, CardStack> | undefined;
  expandedStackIds: ReadonlySet<string> | undefined;
  onStackOnto:
    ((cardId: string, targetId: string | null, carry?: readonly string[]) => void) | undefined;
  onAssignGroup: ((cardId: string, groupId: string | null) => void) | undefined;
  onReorder: ((cardIds: string[]) => void) | undefined;
  /** The order that falls out of putting one card where another is. */
  reorder: (cardId: string, targetId: string) => string[];
};

/**
 * Everything a dragged card does to the board: what it rests on, what that would do, and what
 * letting go there does.
 */
export function useCardDrag(input: CardDragInput) {
  const { groups, onStackOnto, onReorder, reorder } = input;
  const registry = useCardRegistry();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pile = usePileTarget(groups);

  const { swapOnto, cooledDown, markMoved, reset } = useReorderSwap(onReorder, reorder);
  const { restOn, forget } = useDragRest({ pile, canPile: onStackOnto !== undefined, swapOnto });
  const { clear, lit } = pile;

  const settle = useCallback(() => {
    clear();
    forget();
  }, [clear, forget]);

  const drop = useCardDrop({
    ...input,
    areaEntries: registry.areaEntries,
    litTarget: lit,
    settle,
  });

  const { cardUnder } = registry;

  /**
   * What a dragged card is over, every frame, and what letting go there would do.
   *
   * Two things a drag can mean, told apart by *where* on the other card it rests:
   *
   * - **Its edge** — the two trade places, as dragging always did, after a beat.
   * - **Its middle** — after a longer rest the card underneath lights up, and letting go puts the
   *   dragged card into a pile under it. Nothing moves aside while it is lit, so the target stays
   *   where the pointer is.
   *
   * In plan mode and outside it alike: tidying two cards into one pile is something a person
   * reading the board notices they want, and the grip is there in both.
   */
  const drag = useCallback(
    (cardId: string, point: { x: number; y: number }) => {
      // The pointer, not the dragged card's centre. The card is held by its grip in a corner, so
      // its centre sits half a card away from where the hire is looking — and how far depends on
      // the card's size, which is why aiming at a card's middle piled onto some cards and not
      // others. Letting go already goes by the pointer; this now agrees with it.
      const here = toViewport(point);
      const under = cardUnder(cardId, here.x, here.y);
      if (under) return restOn(cardId, under[0], under[1], here);

      // Over nothing: whatever was about to happen is off.
      settle();
    },
    [cardUnder, restOn, settle],
  );

  const startDrag = useCallback(
    (cardId: string) => {
      reset();
      forget();
      setDraggingId(cardId);
    },
    [forget, reset],
  );
  const endDrag = useCallback(() => setDraggingId(null), []);

  return {
    draggingId,
    pileTargetId: pile.targetId,
    pileAreaMove: pile.areaMove,
    registerElement: registry.registerElement,
    registerGroupElement: registry.registerGroupElement,
    elementOf: registry.elementOf,
    cardIdAt: registry.cardIdAt,
    cooledDown,
    markMoved,
    startDrag,
    drag,
    endDrag,
    drop,
  };
}
