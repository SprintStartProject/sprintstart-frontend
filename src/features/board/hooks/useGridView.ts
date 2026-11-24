import { useState, type Dispatch, type SetStateAction } from "react";
import { useReducedMotion } from "framer-motion";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import type { ResolvedGridProps } from "../components/boardGridProps";
import { GRID_COLUMNS } from "../layout/cardSizes";
import { GRID_GAP } from "../layout/gridBlocks";
import { useBlockLayout } from "./useBlockLayout";
import { useBlockMoves } from "./useBlockMoves";
import { useBoardOrder } from "./useBoardOrder";
import { useCardDrag } from "./useCardDrag";
import { useOpenPileDismissal } from "./useOpenPileDismissal";
import { useReachableOrigin } from "./useReachableOrigin";
import { useRevealMember } from "./useRevealMember";

/** Two columns from Tailwind's `lg` up; one below it. The only width this grid branches on. */
const TWO_COLUMN_QUERY = "(min-width: 1024px)";

/** Everything the board's render needs, so each part of it is handed one thing, not forty. */
export type GridView = {
  props: ResolvedGridProps;
  /** How many columns the board has right now: four, or one on a phone. */
  columns: number;
  /** The gap between blocks, which the row maths has to agree with — see `GridBlock`. */
  gap: number;
  reduceMotion: boolean | null;
  ids: string[];
  move: ReturnType<typeof useBoardOrder>["move"];
  drag: ReturnType<typeof useCardDrag>;
  hover: { hoveredId: string | null; setHoveredId: Dispatch<SetStateAction<string | null>> };
  revealMember: ReturnType<typeof useRevealMember>;
  reachableOrigin: ReturnType<typeof useReachableOrigin>;
  layout: ReturnType<typeof useBlockLayout>;
  blockMoves: ReturnType<typeof useBlockMoves>;
};

export function useGridView(props: ResolvedGridProps): GridView {
  const { board, groups, stacks, expandedStackIds, onReorder, onAssignGroup, onStackOnto } = props;
  const wideEnough = useMediaQuery(TWO_COLUMN_QUERY);
  const reduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { ids, reorder, move } = useBoardOrder({
    cards: board.cards,
    boardOrder: props.boardOrder,
    stacks,
    expandedStackIds,
    onReorder,
  });
  const drag = useCardDrag({
    groups,
    stacks,
    expandedStackIds,
    onStackOnto,
    onAssignGroup,
    onReorder,
    reorder,
  });
  useOpenPileDismissal({
    isArranging: props.isArranging,
    expandedStackIds,
    onToggleStack: props.onToggleStack,
  });

  const layout = useBlockLayout({ cards: board.cards, ...props });
  const blockMoves = useBlockMoves({ blocks: layout.blocks, ids, onReorder, ...drag });
  const revealMember = useRevealMember({
    onToggleStack: props.onToggleStack,
    elementOf: drag.elementOf,
    expandedStackIds,
    reduceMotion,
  });

  return {
    props,
    // One column below the breakpoint is what the board has always done, and it is what a phone
    // should do — the spans all clamp to it, so a hire's sizes are ignored rather than honoured
    // into something unreadable.
    columns: wideEnough ? GRID_COLUMNS : 1,
    gap: GRID_GAP,
    reduceMotion,
    ids,
    move,
    drag,
    hover: { hoveredId, setHoveredId },
    revealMember,
    reachableOrigin: useReachableOrigin(props.cardOrigins),
    layout,
    blockMoves,
  };
}
