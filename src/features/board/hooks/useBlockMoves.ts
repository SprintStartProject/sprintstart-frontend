import { useCallback } from "react";
import { centerOf } from "../layout/dragGeometry";
import { orderAfterBlockMove, type Block } from "../layout/gridBlocks";

type BlockMovesInput = {
  blocks: Block[];
  ids: string[];
  onReorder: ((cardIds: string[]) => void) | undefined;
  cardIdAt: (x: number, y: number) => string | null;
  cooledDown: (now: number) => boolean;
  markMoved: (now: number) => void;
};

/** Moving a whole area: by its arrow keys, or by dragging it over another block. */
export function useBlockMoves(input: BlockMovesInput) {
  const { blocks, ids, onReorder, cardIdAt, cooledDown, markMoved } = input;

  const moveBlockTo = useCallback(
    (from: number, to: number) => {
      if (!onReorder) return;

      const next = orderAfterBlockMove(blocks, ids, from, to);
      if (next) onReorder(next);
    },
    [blocks, ids, onReorder],
  );

  /** A dragged area lands on whatever block its middle is over, the way a dragged card does. */
  const handleGroupDrag = useCallback(
    (blockIndex: number, element: HTMLElement) => {
      const now = performance.now();
      if (!cooledDown(now)) return;

      const { x, y } = centerOf(element);
      const cardId = cardIdAt(x, y);
      if (cardId === null) return;

      const target = blocks.findIndex((block) => block.cards.some((card) => card.id === cardId));
      if (target === -1 || target === blockIndex) return;

      moveBlockTo(blockIndex, target);
      markMoved(now);
    },
    [blocks, cardIdAt, cooledDown, markMoved, moveBlockTo],
  );

  const moveBlock = (blockIndex: number, direction: "up" | "down") =>
    moveBlockTo(blockIndex, direction === "up" ? blockIndex - 1 : blockIndex + 1);

  return { moveBlock, handleGroupDrag };
}
