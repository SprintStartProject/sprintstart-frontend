import { useCallback, useMemo } from "react";
import type { BoardGroup } from "../layout/boardGroups";
import type { BoardStage, CardState } from "../layout/boardStructure";
import type { CardSizes } from "../layout/cardSizes";
import type { CardStack } from "../layout/cardStacks";
import {
  buildBands,
  buildBlocks,
  emptyGroups as findEmptyGroups,
  spanningGroups as findSpanningGroups,
  spanOf as spanOfBlock,
  stagesOf,
  type Band,
  type Block,
} from "../layout/gridBlocks";
import type { BoardCard } from "../types";

type BlockLayoutInput = {
  cards: BoardCard[];
  groups: BoardGroup[];
  stacks?: Map<string, CardStack>;
  expandedStackIds?: ReadonlySet<string>;
  states?: Map<string, CardState>;
  openStages?: ReadonlySet<BoardStage>;
  isArranging: boolean;
  cardSizes?: CardSizes;
};

/** The board as blocks, the areas that need special handling, and the stage bands they sit in. */
export function useBlockLayout(input: BlockLayoutInput) {
  const { cards, groups, stacks, expandedStackIds, states, openStages, isArranging, cardSizes } =
    input;

  const blocks = useMemo<Block[]>(
    () => buildBlocks(cards, groups, stacks, expandedStackIds),
    [cards, expandedStackIds, groups, stacks],
  );

  const spanOf = useCallback(
    (block: Block, columns: number): number => spanOfBlock(block, columns, cardSizes),
    [cardSizes],
  );

  const banding = states !== undefined && openStages !== undefined && !isArranging;

  const stagesIn = useCallback((list: BoardCard[]) => stagesOf(list, states), [states]);

  const emptyGroups = useMemo(() => findEmptyGroups(cards, groups), [cards, groups]);

  const spanningGroups = useMemo<Block[]>(
    () => (banding ? findSpanningGroups(blocks, states) : []),
    [banding, blocks, states],
  );

  const bands = useMemo<Band[]>(
    () => (states && banding ? buildBands(blocks, spanningGroups, states) : []),
    [banding, blocks, spanningGroups, states],
  );

  /** Where a block sits in the board's order, which is what its move controls act on. */
  const indexOfBlock = useCallback(
    (block: Block) => blocks.findIndex((candidate) => candidate === block),
    [blocks],
  );

  return { blocks, spanOf, stagesIn, emptyGroups, spanningGroups, bands, indexOfBlock };
}
