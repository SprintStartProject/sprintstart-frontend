import { sizeOf } from "../layout/cardSizes";
import type { BoardCard } from "../types";
import { BoardCardCell } from "./BoardCardCell";
import type { GridView } from "../hooks/useGridView";

type GridCardProps = {
  card: BoardCard;
  view: GridView;
};

/** What the card does while it is being dragged, hovered or dropped. */
function dragProps(card: BoardCard, view: GridView) {
  const { drag, hover, reduceMotion } = view;
  const idle = hover.hoveredId !== card.id && drag.draggingId !== card.id;

  return {
    isDragging: drag.draggingId === card.id,
    isPileTarget: drag.pileTargetId === card.id,
    pileAreaMove: drag.pileAreaMove,
    isWiggling: view.props.isArranging && !reduceMotion && idle,
    onDrop: drag.drop,
    onMove: view.move,
    registerElement: drag.registerElement,
    onDragStart: () => drag.startDrag(card.id),
    onDrag: (point: { x: number; y: number }) => drag.drag(card.id, point),
    onDragEnd: drag.endDrag,
    onHoverChange: (hovered: boolean) =>
      hover.setHoveredId((current) => (hovered ? card.id : current === card.id ? null : current)),
  };
}

/** The pile a card belongs to, and whether it is the one standing in for the others. */
function pileOf(card: BoardCard, view: GridView) {
  const { stacks, expandedStackIds } = view.props;
  const stack = stacks?.get(card.id);
  const expanded = stack !== undefined && (expandedStackIds?.has(stack.rootId) ?? false);

  return {
    stack,
    // The chip belongs to a *closed* pile: it is how the card standing in for the others says so,
    // and the way in. Once the pile is open its frame carries the way back, and a second control
    // saying the same thing on the first card would be one too many.
    chipOwner: stack && !expanded && stack.topId === card.id ? stack : undefined,
    leadsPile: stack !== undefined && stack.rootId === card.id,
  };
}

/** What the card is in a pile, and what it can do about it. */
function pileProps(card: BoardCard, view: GridView) {
  const { isArranging, onStackOnto, onToggleStack } = view.props;
  const { stack, chipOwner, leadsPile } = pileOf(card, view);

  return {
    stack: chipOwner,
    leadsPile,
    // Piling is rearranging, so it is offered where the rest of rearranging is: in plan mode.
    onStackOnto: isArranging ? onStackOnto : undefined,
    onToggleStack,
    onRevealMember:
      stack && onToggleStack
        ? (memberId: string) => view.revealMember(stack.rootId, memberId)
        : undefined,
  };
}

/** What happens to the card's content: removing, editing, undoing, and what each is waiting on. */
function writeProps(card: BoardCard, view: GridView) {
  const grid = view.props;

  return {
    onDismiss: grid.onDismiss,
    dismissing: grid.dismissingId === card.id,
    onEdit: grid.onEdit,
    onRestorePrevious: grid.onRestorePrevious,
    restoring: grid.restoringIds.has(card.id),
    saving: grid.savingIds.has(card.id),
    undoNotice: grid.undoNotices.get(card.id) ?? null,
    onCardAdded: grid.onCardAdded,
  };
}

/** Where the card sits, how it is dressed, and the controls for folding, pinning and sizing. */
function displayProps(card: BoardCard, view: GridView) {
  const grid = view.props;
  const { onResizeCard } = grid;

  return {
    index: view.ids.indexOf(card.id),
    total: view.ids.length,
    isArranging: grid.isArranging,
    collapsed: grid.collapsedIds?.has(card.id) ?? false,
    pinned: grid.pinnedIds?.has(card.id) ?? false,
    onToggleCollapsed: grid.onToggleCollapsed,
    onTogglePinned: grid.onTogglePinned,
    allCards: grid.board.cards,
    state: grid.states?.get(card.id),
    size: sizeOf(grid.cardSizes, card.id),
    origin: view.reachableOrigin(card.id),
    onResize: onResizeCard
      ? (next: ReturnType<typeof sizeOf>) => onResizeCard(card.id, next)
      : undefined,
  };
}

/** One card on the board, wired to everything the board knows about it. */
export function GridCard({ card, view }: GridCardProps) {
  return (
    <BoardCardCell
      card={card}
      {...displayProps(card, view)}
      {...dragProps(card, view)}
      {...pileProps(card, view)}
      {...writeProps(card, view)}
    />
  );
}
