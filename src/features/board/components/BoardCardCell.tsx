import { useMemo } from "react";
import { motion, useDragControls } from "framer-motion";
import { centralSpringToken } from "../../../styles/tokens";
import type { CardState } from "../layout/boardStructure";
import type { CardOrigin } from "../layout/cardOrigins";
import type { CardSize } from "../layout/cardSizes";
import type { CardStack } from "../layout/cardStacks";
import { FAN_ROOM, sheetsBehind } from "../layout/stackSheets";
import type { PileAreaMove } from "../hooks/usePileTarget";
import type { AuthoredCardRequest, BoardCard, BoardUndoNotice } from "../types";
import { BoardCardContext, type BoardCardControls } from "./boardCardControls";
import { BoardCardView } from "./BoardCardView";
import { doubleClickHandler, stackClickHandler } from "./cardCellGestures";
import { useCardControls } from "./useCardControls";
import { StackSheets } from "./StackSheets";

/**
 * The tilt that says "this can be moved".
 *
 * Under a degree, and every card starts at a different point in the cycle, so the board shimmers
 * rather than pulsing in lockstep. It stops the moment the pointer is over a card: a moving target
 * is hard to aim a 36px button at, and the card is already saying it can be moved by the time you
 * have reached it. Lifted from the dashboard, down to the numbers.
 */
const WIGGLE = { rotate: [-0.55, 0.55, -0.55] };

type BoardCardCellProps = {
  card: BoardCard;
  index: number;
  total: number;
  isArranging: boolean;
  isDragging: boolean;
  /** A dragged card is resting on this one, and letting go would pile it here. */
  isPileTarget?: boolean;
  /** Whether piling onto this card moves the dragged one into this card's area, or out of its own. */
  pileAreaMove?: PileAreaMove;
  isWiggling: boolean;
  collapsed: boolean;
  pinned: boolean;
  onToggleCollapsed?: (cardId: string) => void;
  onTogglePinned?: (cardId: string) => void;
  /** Every card on the board, so this one can offer them as cards to lie under. */
  allCards: BoardCard[];
  state?: CardState;
  /** Whether other cards lie under this one, so the pile picker can say it is the top of a pile. */
  leadsPile?: boolean;
  onStackOnto?: (cardId: string, targetId: string | null) => void;
  /**
   * Set only on the top card of a *closed* pile — the one standing in for the others.
   *
   * Which is why nothing here asks whether the stack is open: an open one is drawn by
   * `ExpandedStack` and its cards are ordinary cards, so this being set *is* "the pile is closed".
   */
  stack?: CardStack;
  /** Where this card came from, passed through to the kinds that show it. */
  origin?: CardOrigin | null;
  /** Passed through to the kinds that can make a card — see `BoardGridProps.onCardAdded`. */
  onCardAdded?: () => void;
  onToggleStack?: (rootId: string) => void;
  /** Opens the pile and brings one member into view. Absent when the pile cannot be opened. */
  onRevealMember?: (cardId: string) => void;
  size: CardSize;
  /** Sets this card's size. Absent on a board that cannot be changed. */
  onResize?: (size: CardSize) => void;
  onDrop: (cardId: string, point: { x: number; y: number }) => void;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  onRestorePrevious?: (cardId: string, replacedAt: string) => void;
  /** True while this card's own undo is in flight. */
  restoring: boolean;
  /** True while this card is being written to — an edit, or a tick, still on its way. */
  saving: boolean;
  /** What just happened to this card's undo, when anything did. */
  undoNotice: BoardUndoNotice | null;
  registerElement: (id: string, element: HTMLDivElement | null) => void;
  onDragStart: () => void;
  /** Every frame of a drag, with where the pointer is (page coordinates). */
  onDrag: (point: { x: number; y: number }) => void;
  onDragEnd: () => void;
  onHoverChange: (hovered: boolean) => void;
};

/** Says what letting go will do, on the card it will do it to. */
function PileTargetBadge({ move }: { move: PileAreaMove }) {
  return (
    <span className="pointer-events-none absolute -top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-app-brand px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm">
      {move === "into"
        ? "Drop to pile here, in this area"
        : move === "out"
          ? "Drop to pile here, out of its area"
          : "Drop to pile here"}
    </span>
  );
}

/**
 * One card on the board, and everything the board wraps around it.
 *
 * A component of its own because the drag controls are a hook: each card needs its own, and a hook
 * cannot be called from inside a loop in the grid.
 *
 * **Only the grip drags.** `dragListener={false}` means a press anywhere else on the card is just a
 * press — a checkbox stays a checkbox and a link stays a link, with no mode to enter first. That is
 * the whole reason the grip exists rather than the card being draggable outright: these cards are
 * full of things to click.
 *
 * The grip is also how the board is arranged without a pointer. It is a real button, so Tab reaches
 * it, and the arrow keys move the card while it has focus — no pick-up gesture to discover, and the
 * label says so. A board you can only arrange with a mouse is a board some people cannot arrange at
 * all.
 */
function fanRoom(stack: CardStack | undefined, sheets: number): string {
  return stack ? `transition-[padding-bottom] duration-300 ease-out ${FAN_ROOM[sheets]}` : "";
}

function frameClass({ stack, isDragging, isPileTarget }: Partial<BoardCardCellProps>): string {
  const target = isPileTarget
    ? "rounded-2xl ring-2 ring-app-brand ring-offset-2 ring-offset-app-bg"
    : "";

  return `relative ${stack ? "cursor-pointer" : ""} ${isDragging ? "z-40 cursor-grabbing" : ""} ${target}`;
}

/**
 * Two nested motion elements, deliberately — the same split the dashboard needs. The outer one does
 * `layout` and `drag`, and Framer measures it; this inner one carries the wiggle's rotation, which
 * changes an element's measured box and would poison a layout projection measured against it.
 */
type CardBodyProps = BoardCardCellProps & { controls: BoardCardControls };

function CardBody({ controls, ...cell }: CardBodyProps) {
  const { isWiggling, index } = cell;

  return (
    <motion.div
      // Full height only when the card was pulled tall, so the frame inside can fill the floor
      // the cell keeps under it.
      animate={isWiggling ? WIGGLE : { rotate: 0 }}
      transition={
        isWiggling
          ? { duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: (index % 5) * 0.08 }
          : centralSpringToken
      }
    >
      <BoardCardContext.Provider value={controls}>
        <BoardCardView
          card={cell.card}
          onDismiss={cell.onDismiss}
          dismissing={cell.dismissing}
          onEdit={cell.onEdit}
          onRestorePrevious={cell.onRestorePrevious}
          restoring={cell.restoring}
          saving={cell.saving}
          undoNotice={cell.undoNotice}
          origin={cell.origin}
          onCardAdded={cell.onCardAdded}
        />
      </BoardCardContext.Provider>
    </motion.div>
  );
}

export function BoardCardCell(props: BoardCardCellProps) {
  const { card, isArranging, isPileTarget = false, pileAreaMove = null, stack } = props;
  const dragControls = useDragControls();

  const label =
    card.content.kind === "NOTE" ? "note" : card.content.kind.toLowerCase().replace(/_/g, " ");

  const behind = useMemo(() => sheetsBehind(stack, props.pinned), [props.pinned, stack]);
  const controls = useCardControls({
    ...props,
    label,
    dragControls,
    leadsPile: props.leadsPile ?? false,
  });

  // The room a fanned pile needs, and where it has to live: *inside* the box the grid measures.
  // `ResizeObserver` reports the border box, so a margin would be room the row count is never told
  // about, and the fan doubling its reach on hover would resize nothing. As padding on a wrapper
  // the room is part of the measured height, and the observer follows it as it eases open.
  //
  // `group/stack` is on every cell, stacked or not: the resize grip in the card's corner is drawn
  // by `group-hover/stack:opacity-100`, so a card without the group is a card whose grip never
  // appears — and, because it is still laid out, an invisible one sitting in the corner catching
  // presses. The hover that fans the sheets and the hover that buys them the room are one
  // element's, so pointing at a sheet keeps the pile open rather than closing it under the pointer.
  return (
    <div className={`group/stack ${fanRoom(stack, behind.length)}`}>
      <motion.div
        ref={(element) => props.registerElement(card.id, element)}
        layout="position"
        transition={centralSpringToken}
        drag={props.onMove !== undefined}
        // Outside arrange mode only the grip starts a drag, so every checkbox, link and button on a
        // card keeps working without a mode to leave first. Inside it, where the content is inert
        // anyway, the whole card is the handle — that is what the mode is for.
        // Never the whole card: the grip is the only thing that starts a drag, in either mode. A
        // card here is readable content — a checklist to tick, a link to follow — and a press
        // anywhere on it has to keep meaning what it means.
        dragListener={false}
        dragControls={dragControls}
        dragSnapToOrigin
        // No elasticity: the card should sit under the pointer, not lag behind it on a spring.
        dragElastic={0}
        dragMomentum={false}
        onDragStart={props.onDragStart}
        onDrag={(_event, info) => props.onDrag(info.point)}
        onDragEnd={(_event, info) => {
          props.onDrop(card.id, info.point);
          props.onDragEnd();
        }}
        onClick={stackClickHandler(stack, isArranging, props.onToggleStack)}
        onDoubleClick={doubleClickHandler(card.id, stack, isArranging, props.onToggleCollapsed)}
        onPointerEnter={() => props.onHoverChange(true)}
        onPointerLeave={() => props.onHoverChange(false)}
        className={frameClass(props)}
        // The floor for a tall card lives on the grid block that measures it, not here — see
        // `GridBlock`. Two floors would be one too many, and this one is inside the measurement.
        style={isArranging ? { touchAction: "none" } : undefined}
      >
        {isPileTarget && <PileTargetBadge move={pileAreaMove} />}
        <StackSheets behind={behind} onRevealMember={props.onRevealMember} />
        <CardBody {...props} controls={controls} />
      </motion.div>
    </div>
  );
}
