import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { originOf, type CardOrigins } from "../layout/cardOrigins";
import { useBoardPath } from "../hooks/boardPath";
import { leadsOntoPath } from "../layout/pathStages";
import { BoardCardCell, type PileAreaMove } from "./BoardCardCell";
import { BoardGroupSection } from "./BoardGroupSection";
import { KEEPS_PILES_OPEN } from "./interactiveSelectors";
import { ExpandedStack } from "./ExpandedStack";
import { GridBlock } from "./GridBlock";
import { BoardStageBand } from "./BoardStageBand";
import type { AreaAccent } from "../layout/areaAccents";
import { groupOf, type BoardGroup } from "../layout/boardGroups";
import { moveTo } from "../layout/boardOrder";
import type { CardStack } from "../layout/cardStacks";
import { BOARD_STAGES, type BoardStage, type CardState } from "../layout/boardStructure";
import { GRID_COLUMNS, sizeOf, type CardSize, type CardSizes } from "../layout/cardSizes";
import {
  buildBands,
  buildBlocks,
  emptyGroups as findEmptyGroups,
  orderAfterBlockMove,
  spanningGroups as findSpanningGroups,
  spanOf as spanOfBlock,
  stagesOf,
  type Band,
  type Block,
  GRID_GAP,
  ROW_UNIT,
  type Item,
} from "../layout/gridBlocks";
import {
  centerOf,
  contains,
  inMiddle,
  MIDDLE_HOLD_REACH,
  MOVE_COOLDOWN_MS,
  PILE_DWELL_MS,
  REORDER_DWELL_MS,
  STILL_PX,
  toViewport,
} from "../layout/dragGeometry";
import type { AuthoredCardRequest, Board, BoardCard, BoardUndoNotice } from "../types";

/** Two columns from Tailwind's `lg` up; one below it. The only width this grid branches on. */
const TWO_COLUMN_QUERY = "(min-width: 1024px)";

type BoardGridProps = {
  board: Board;
  onDismiss?: (cardId: string) => void;
  dismissingId?: string | null;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  /**
   * Puts a card back to what it said before its most recent edit.
   *
   * The record of that edit lives on the card itself, not in a toast — a change the hire never saw
   * is exactly what an undo exists to prevent, so the affordance cannot be something that expires
   * with a timeout.
   */
  onRestorePrevious?: (cardId: string, replacedAt: string) => void;
  /** The cards with an undo in flight, so their own strips can say they are working. */
  restoringIds?: ReadonlySet<string>;
  /** The cards being written to right now — an edit, or a tick, still on its way. */
  savingIds?: ReadonlySet<string>;
  /**
   * What just happened to an undo, keyed to the card it happened on: a stale press's refusal, or
   * the fact that a restore landed.
   */
  undoNotices?: ReadonlyMap<string, BoardUndoNotice>;
  /** Applies a whole new order. Absent when the board is not arrangeable. */
  onReorder?: (cardIds: string[]) => void;
  /**
   * The board's whole order, filtered cards included, as the caller holds it.
   *
   * A reorder replaces the order outright; expressed over only what is drawn, it would drop every
   * card the current view is hiding. Falls back to the drawn cards for a caller that never narrows
   * what it passes.
   */
  boardOrder?: string[];
  /** Arrange mode: every control is on show and the card content stops taking clicks. */
  isArranging?: boolean;
  collapsedIds?: Set<string>;
  onToggleCollapsed?: (cardId: string) => void;
  pinnedIds?: Set<string>;
  onTogglePinned?: (cardId: string) => void;
  groups?: BoardGroup[];
  onAssignGroup?: (cardId: string, groupId: string | null) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onToggleGroup?: (groupId: string) => void;
  /** Takes the area away and leaves its cards on the board, where they already are. */
  onDissolveGroup?: (groupId: string) => void;
  /** Paints an area. Absent on a board that cannot be changed. */
  onRecolourGroup?: (groupId: string, accent: AreaAccent) => void;
  /**
   * Every card's derived place in the process, keyed by id.
   *
   * Absent on a board with no process layer, which is why it is read through `states?.get(...)`
   * everywhere rather than defaulted: a board that has never been sequenced should say nothing
   * about sequence, not claim every card is open and due now.
   */
  states?: Map<string, CardState>;
  /** Puts a card directly under another one in a pile, or (with null) takes it out of its pile. */
  onStackOnto?: (cardId: string, targetId: string | null, carry?: readonly string[]) => void;
  /**
   * The stacks on this board, keyed by every member's id.
   *
   * The grid does not decide what is stacked or which member stands on top — it is handed a board
   * that already holds only the visible cards, and uses this to dress the ones that are standing in
   * for others. Keeping the decision out here is what lets the same rule drive the filtering.
   */
  stacks?: Map<string, CardStack>;
  /** Which stacks are open, by root id. A member of an open stack is dressed as an ordinary card. */
  expandedStackIds?: ReadonlySet<string>;
  /** Opens a closed pile, or closes an open one. */
  onToggleStack?: (rootId: string) => void;
  /**
   * The stages to draw as foldable bands, and which of them are open.
   *
   * Absent — and on a board being arranged, or one with no process layer — the grid is one flat
   * surface, exactly as it was: arranging is about the board's own order, and a fold that hid half
   * of it while somebody dragged a card through would be the surface arguing with the gesture.
   */
  openStages?: ReadonlySet<BoardStage>;
  /** Folds one band. Absent on a board whose bands cannot be folded. */
  onToggleStage?: (stage: BoardStage) => void;
  /**
   * The sizes the hire pulled their cards to, keyed by id.
   *
   * The layout reads them in exactly two places — how wide a card's block is, and how tall the
   * packing should assume it is — because those are the two things a size can honestly change on a
   * board that packs itself. See `cardSizes.ts` for why it is two widths and two heights and not a
   * pixel box.
   */
  cardSizes?: CardSizes;
  /** Sets one card's size. Absent on a board that cannot be changed. */
  onResizeCard?: (cardId: string, size: CardSize) => void;
  /**
   * Where each card was found, for the ones that were found somewhere.
   *
   * Kept beside the cards rather than on them because the card catalog has no field for it — see
   * `layout/cardOrigins.ts`, including the note about wanting this on the wire instead.
   */
  cardOrigins?: CardOrigins;
  /**
   * Told when a card made *from* a card on this board has landed — a checklist broken out of a
   * task, today the only case.
   *
   * Separate from `onEdit` and `onDismiss` because it is not a change to a card the grid is
   * holding: it is a new card appearing, which only a re-read can show. Without it the write goes
   * through, the toast says so, and the board keeps drawing what it read before the press.
   */
  onCardAdded?: () => void;
};

/** Stand-ins for a board rendered without undo state — one with no writes to report. */
const NO_IDS: ReadonlySet<string> = new Set();
const NO_NOTICES: ReadonlyMap<string, BoardUndoNotice> = new Map();

/**
 * The board's layout: cards in board order, packed into columns, rearrangeable by dragging.
 *
 * Columns rather than a row grid, because the cards are wildly uneven — a one-line note sits beside
 * a diagram — and a row grid makes every row as tall as its tallest card, so the note is either
 * stretched into an empty box or trailed by a hole the next row cannot use. The columns are dealt
 * here rather than by CSS multi-column flow: a browser's column flow cannot be measured cell by
 * cell, and measuring cells is exactly what dragging needs.
 *
 * A diagram spans the full width instead of taking a column. It is a picture, and half of a
 * half-width column is not enough of one to read. It breaks the flow at the point it sits in the
 * order, so its place in the order is still its place.
 *
 * **Dragging is gated behind arrange mode**, the way the dashboard's is, and for the same reason:
 * these cards are full of things to click — a checkbox, a link, an "I've done this" — and a card
 * that is both a control surface and a drag target gets one of the two wrong. In arrange mode the
 * content stops taking clicks and the whole card becomes the handle. Which card a drag lands on is
 * decided by what the dragged card's centre covers, not by the pointer, so the board rearranges
 * when the card looks like it has arrived rather than before.
 *
 * The move buttons stay, and stay outside arrange mode too. A drag is the nicer gesture, but it is
 * the *only* gesture in most implementations, and a board you can only arrange with a mouse is a
 * board some people cannot arrange at all. Both send the whole resulting order, because that is
 * what the board now looks like.
 */
export function BoardGrid({
  board,
  onDismiss,
  dismissingId = null,
  onEdit,
  onRestorePrevious,
  restoringIds = NO_IDS,
  savingIds = NO_IDS,
  undoNotices = NO_NOTICES,
  onReorder,
  boardOrder,
  isArranging = false,
  collapsedIds,
  onToggleCollapsed,
  pinnedIds,
  onTogglePinned,
  groups = [],
  onAssignGroup,
  onRenameGroup,
  onToggleGroup,
  onDissolveGroup,
  onRecolourGroup,
  states,
  onStackOnto,
  stacks,
  expandedStackIds,
  onToggleStack,
  openStages,
  onToggleStage,
  cardSizes,
  cardOrigins,
  onResizeCard,
  onCardAdded,
}: BoardGridProps) {
  const wideEnough = useMediaQuery(TWO_COLUMN_QUERY);

  /**
   * How many columns the board has right now.
   *
   * Four or one, with nothing in between: the widths are spans on this number, and a board of two
   * columns would make "narrow" and "normal" the same thing while "wide" quietly became "normal".
   * One column below the breakpoint is what the board has always done, and it is what a phone
   * should do — the spans all clamp to it, so a hire's sizes are ignored rather than honoured into
   * something unreadable.
   */
  const columns = wideEnough ? GRID_COLUMNS : 1;

  /** The gap between blocks, which the row maths has to agree with — see {@link GridBlock}. */
  const gap = GRID_GAP;
  const elements = useRef(new Map<string, HTMLDivElement>());
  const groupElements = useRef(new Map<string, HTMLElement>());
  const lastMoveAt = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /**
   * A card's way back, unless it leads into the path somewhere the path no longer has.
   *
   * A step rebuilt away, or a path that is gone altogether, would turn "Back to …" into a trip to a
   * page that says the step is not there. Only decided once the path has been read: before that,
   * "no path" means "not known yet", and hiding every way back for a second would be the board
   * flickering.
   */
  const { phases: pathPhasesNow, settled: pathSettled } = useBoardPath();
  const reachableOrigin = (cardId: string) => {
    const origin = originOf(cardOrigins, cardId);
    if (!origin || !pathSettled) return origin;

    return leadsOntoPath(origin.url, pathPhasesNow) ? origin : null;
  };
  /** The card a dragged one would be piled under if let go now — see `handleDrag`. */
  const [pileTargetId, setPileTargetId] = useState<string | null>(null);
  const pileTargetRef = useRef<string | null>(null);
  /** Whether piling onto the lit card moves the dragged one into or out of an area — on the label. */
  const [pileAreaMove, setPileAreaMove] = useState<PileAreaMove>(null);
  /**
   * Lights the pile target once the dragged card has rested long enough, even when the pointer
   * holds perfectly still: drag events only arrive while it moves, so counting on them alone left a
   * hire who stopped and waited with nothing happening.
   */
  const pileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The card and the part of it the dragged card is resting on, and where the rest began. */
  const restingRef = useRef<{ id: string; zone: "middle" | "edge"; x: number; y: number } | null>(
    null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /**
   * A card the pile was opened *for*, to be brought into view once it is on the board.
   *
   * A ref rather than state: nothing renders from it, and setting state to schedule a scroll would
   * be a second render for something the DOM answers on its own.
   */
  const revealId = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  /** The cards on screen, in the order they are drawn. */
  const shownIds = useMemo(() => board.cards.map((card) => card.id), [board.cards]);

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

  const registerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  }, []);

  /**
   * Closes an open pile as soon as attention moves off it.
   *
   * Opening a stack is looking into something, not rearranging the board — so it should end the way
   * looking into something ends, by looking somewhere else. Without this, spreading out three
   * sequences to check them leaves three sequences spread out, and the hire has to go back and put
   * each one away by hand, which is exactly the tidying the stacks existed to save.
   *
   * Hit-tested against the card elements the grid already registers rather than against a wrapper,
   * because "outside the stack" includes *other cards*: clicking the next card along should put the
   * pile away and act on that card, not just the second of those.
   *
   * On `pointerdown` rather than `click`, so it lands before the card's own handler — a click on
   * another stack's top card closes this one and opens that one, in that order, rather than the two
   * fighting over the same event.
   *
   * Off entirely while the board is being arranged: arranging deliberately opens every stack, and a
   * press on the background to start a drag would otherwise fold them all away mid-gesture.
   */
  useEffect(() => {
    if (isArranging || !onToggleStack) return;
    if (!expandedStackIds || expandedStackIds.size === 0) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      // Floating controls acting on what is in the pile — the highlighter's toolbar, the colour
      // popover, a menu or dialog — are not looking elsewhere.
      if (target?.closest(KEEPS_PILES_OPEN)) return;
      const openedFrame = target?.closest("[data-stack-root]");
      const insideRoot = openedFrame?.getAttribute("data-stack-root") ?? null;

      for (const rootId of expandedStackIds ?? []) {
        if (rootId !== insideRoot) onToggleStack?.(rootId);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [expandedStackIds, isArranging, onToggleStack]);

  const registerGroupElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) groupElements.current.set(id, element);
    else groupElements.current.delete(id);
  }, []);

  /**
   * Where a card was let go decides which area it is in.
   *
   * Dropped inside an area's box, it joins that area; dropped anywhere else, it leaves the one it
   * was in. Decided on release rather than during the drag, so the board is not re-grouping under
   * a pointer that is still moving — and it is the pointer's own position that counts, not the
   * card's, because that is where the hire is looking when they let go.
   */
  const clearPileTarget = useCallback(() => {
    if (pileTimer.current) clearTimeout(pileTimer.current);
    pileTimer.current = null;
    if (pileTargetRef.current) {
      pileTargetRef.current = null;
      setPileTargetId(null);
    }
  }, []);

  const lightPileTarget = useCallback(
    (draggedId: string, candidateId: string) => {
      if (pileTargetRef.current === candidateId) return;
      pileTargetRef.current = candidateId;
      setPileTargetId(candidateId);
      const from = groupOf(groups, draggedId)?.id ?? null;
      const to = groupOf(groups, candidateId)?.id ?? null;
      setPileAreaMove(from === to ? null : to ? "into" : "out");
    },
    [groups],
  );

  useEffect(() => clearPileTarget, [clearPileTarget]);

  const handleCardDrop = useCallback(
    (cardId: string, point: { x: number; y: number }) => {
      const target = pileTargetRef.current;
      clearPileTarget();
      restingRef.current = null;

      // Let go over the middle of another card: the two become a pile. See `handleDrag`. A closed
      // pile is drawn as one card and moves as one: all of it goes onto the target. From an open
      // pile only the card that was picked up goes.
      if (target && target !== cardId && onStackOnto) {
        const pile = stacks?.get(cardId);
        if (pile && !expandedStackIds?.has(pile.rootId)) {
          onStackOnto(pile.memberIds[0], target, pile.memberIds);
        } else {
          onStackOnto(cardId, target);
        }
        return;
      }

      const { x, y } = toViewport(point);

      // Dragged out of an open pile and let go anywhere outside it: it leaves the pile.
      const pile = stacks?.get(cardId);
      if (pile && onStackOnto && expandedStackIds?.has(pile.rootId)) {
        const frame = document.querySelector(`[data-stack-root="${CSS.escape(pile.rootId)}"]`);
        if (frame instanceof HTMLElement && !contains(frame, x, y)) onStackOnto(cardId, null);
      }

      if (!onAssignGroup) return;

      for (const [groupId, element] of groupElements.current) {
        if (contains(element, x, y)) {
          if (groupOf(groups, cardId)?.id !== groupId) onAssignGroup(cardId, groupId);

          return;
        }
      }

      if (groupOf(groups, cardId)) onAssignGroup(cardId, null);
    },
    [clearPileTarget, expandedStackIds, groups, onAssignGroup, onStackOnto, stacks],
  );

  /**
   * What a dragged card is over, every frame, and what letting go there would do.
   *
   * Two things a drag can mean, told apart by *where* on the other card it rests:
   *
   * - **Its edge** — the two trade places, as dragging always did, after a beat
   *   ({@link REORDER_DWELL_MS}).
   * - **Its middle** — after a longer rest ({@link PILE_DWELL_MS}) the card underneath lights up,
   *   and letting go puts the dragged card into a pile under it. Nothing moves aside while it is
   *   lit, so the target stays where the pointer is.
   *
   * In plan mode and outside it alike: tidying two cards into one pile is something a person
   * reading the board notices they want, and the grip is there in both.
   */
  const handleDrag = useCallback(
    (id: string, point: { x: number; y: number }) => {
      // The pointer, not the dragged card's centre. The card is held by its grip in a corner, so
      // its centre sits half a card away from where the hire is looking — and how far depends on
      // the card's size, which is why aiming at a card's middle piled onto some cards and not
      // others. Letting go already goes by the pointer; this now agrees with it.
      const { x, y } = toViewport(point);

      for (const [candidateId, element] of elements.current) {
        if (candidateId === id || !contains(element, x, y)) continue;

        const resting = restingRef.current;
        const holding = resting?.id === candidateId && resting.zone === "middle";
        const zone =
          onStackOnto && inMiddle(element, x, y, holding ? MIDDLE_HOLD_REACH : undefined)
            ? "middle"
            : "edge";
        // The middle only has to be *stayed in*: it is small and deliberate, and asking a hand to
        // hold still inside it as well made piling feel broken. The edge has to be rested on, or
        // every drag towards a middle would shuffle the cards on its way in.
        const sameSpot =
          resting?.id === candidateId &&
          resting.zone === zone &&
          (zone === "middle" || Math.hypot(x - resting.x, y - resting.y) <= STILL_PX);
        // Still resting where it was: whatever is pending stays pending, whatever is lit stays lit.
        if (sameSpot) return;

        // Anything else starts the wait over from here.
        const keepLit = zone === "middle" && pileTargetRef.current === candidateId;
        if (pileTimer.current) clearTimeout(pileTimer.current);
        pileTimer.current = null;
        if (!keepLit) clearPileTarget();

        const spot = { id: candidateId, zone, x, y } as const;
        restingRef.current = spot;
        if (keepLit) return;

        pileTimer.current = setTimeout(
          () => {
            pileTimer.current = null;
            if (restingRef.current !== spot) return;

            if (zone === "middle") {
              lightPileTarget(id, candidateId);
              return;
            }
            if (!onReorder) return;
            const now = performance.now();
            if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

            onReorder(reorder(id, candidateId));
            lastMoveAt.current = now;
            restingRef.current = null;
          },
          zone === "middle" ? PILE_DWELL_MS : REORDER_DWELL_MS,
        );
        return;
      }

      // Over nothing: whatever was about to happen is off.
      restingRef.current = null;
      clearPileTarget();
    },
    [clearPileTarget, lightPileTarget, onReorder, onStackOnto, reorder],
  );

  const blocks = useMemo<Block[]>(
    () => buildBlocks(board.cards, groups, stacks, expandedStackIds),
    [board.cards, expandedStackIds, groups, stacks],
  );

  const spanOf = useCallback(
    (block: Block, columns: number): number => spanOfBlock(block, columns, cardSizes),
    [cardSizes],
  );

  const banding = states !== undefined && openStages !== undefined && !isArranging;

  const stagesIn = (cards: BoardCard[]) => stagesOf(cards, states);

  const emptyGroups = useMemo(() => findEmptyGroups(board.cards, groups), [board.cards, groups]);

  const spanningGroups = useMemo<Block[]>(
    () => (banding ? findSpanningGroups(blocks, states) : []),
    [banding, blocks, states],
  );

  const bands = useMemo<Band[]>(
    () => (states && banding ? buildBands(blocks, spanningGroups, states) : []),
    [banding, blocks, spanningGroups, states],
  );

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
      if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

      const { x, y } = centerOf(element);
      for (const [cardId, candidate] of elements.current) {
        if (!contains(candidate, x, y)) continue;

        const target = blocks.findIndex((block) => block.cards.some((card) => card.id === cardId));
        if (target === -1 || target === blockIndex) return;

        moveBlockTo(blockIndex, target);
        lastMoveAt.current = now;

        return;
      }
    },
    [blocks, moveBlockTo],
  );

  const moveBlock = (blockIndex: number, direction: "up" | "down") =>
    moveBlockTo(blockIndex, direction === "up" ? blockIndex - 1 : blockIndex + 1);

  /**
   * Opens a pile because somebody clicked one of the cards behind the top one, and takes them to
   * it.
   *
   * Opening alone would be technically right and quietly wrong: a run of five unfolds into five
   * cards, and the one they actually asked about is somewhere in the middle of them. The scroll is
   * what makes clicking a named strip feel like following a link rather than like pressing
   * "expand".
   *
   * The card is not on the board yet when this runs — the pile opens through the page's state, so
   * the members mount on the render this click causes. `revealId` carries the intention across to
   * the effect below, which runs after that render has attached its refs.
   */
  const revealMember = (rootId: string, cardId: string) => {
    onToggleStack?.(rootId);
    revealId.current = cardId;
  };

  // Keyed on the open piles: this runs on exactly the render that put the members on the board.
  useEffect(() => {
    const pending = revealId.current;
    revealId.current = null;
    if (pending === null) return;

    const element = elements.current.get(pending);
    if (!element) return;

    // After the paint, so the card is where it is going to be rather than where the layout
    // animation started it.
    const frame = requestAnimationFrame(() =>
      element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }),
    );

    return () => cancelAnimationFrame(frame);
  }, [expandedStackIds, reduceMotion]);

  const renderCard = (card: BoardCard) => {
    const stack = stacks?.get(card.id);
    const expanded = stack !== undefined && (expandedStackIds?.has(stack.rootId) ?? false);
    // The chip belongs to a *closed* pile: it is how the card standing in for the others says so,
    // and the way in. Once the pile is open its frame carries the way back, and a second control
    // saying the same thing on the first card would be one too many.
    const chipOwner = stack && !expanded && stack.topId === card.id ? stack : undefined;

    return (
      <BoardCardCell
        key={card.id}
        card={card}
        index={ids.indexOf(card.id)}
        total={ids.length}
        isArranging={isArranging}
        isDragging={draggingId === card.id}
        isPileTarget={pileTargetId === card.id}
        pileAreaMove={pileAreaMove}
        isWiggling={isArranging && !reduceMotion && hoveredId !== card.id && draggingId !== card.id}
        collapsed={collapsedIds?.has(card.id) ?? false}
        pinned={pinnedIds?.has(card.id) ?? false}
        onToggleCollapsed={onToggleCollapsed}
        onTogglePinned={onTogglePinned}
        allCards={board.cards}
        state={states?.get(card.id)}
        leadsPile={stack !== undefined && stack.rootId === card.id}
        // Piling is rearranging, so it is offered where the rest of rearranging is: in plan mode.
        onStackOnto={isArranging ? onStackOnto : undefined}
        onDrop={handleCardDrop}
        onMove={move}
        onDismiss={onDismiss}
        dismissing={dismissingId === card.id}
        onEdit={onEdit}
        onRestorePrevious={onRestorePrevious}
        restoring={restoringIds.has(card.id)}
        saving={savingIds.has(card.id)}
        undoNotice={undoNotices.get(card.id) ?? null}
        registerElement={registerElement}
        onDragStart={() => {
          lastMoveAt.current = 0;
          restingRef.current = null;
          setDraggingId(card.id);
        }}
        onDrag={(point) => handleDrag(card.id, point)}
        onDragEnd={() => setDraggingId(null)}
        onHoverChange={(hovered) =>
          setHoveredId((current) => (hovered ? card.id : current === card.id ? null : current))
        }
        stack={chipOwner}
        onToggleStack={onToggleStack}
        onRevealMember={
          stack && onToggleStack ? (memberId) => revealMember(stack.rootId, memberId) : undefined
        }
        size={sizeOf(cardSizes, card.id)}
        origin={reachableOrigin(card.id)}
        onCardAdded={onCardAdded}
        onResize={onResizeCard ? (next) => onResizeCard(card.id, next) : undefined}
      />
    );
  };

  /** One item inside a column or an area: a card, or a sequence somebody has spread out. */
  const renderItem = (item: Item) => {
    if (item.kind === "card") return renderCard(item.card);

    return (
      <ExpandedStack
        stack={item.stack}
        onCollapse={onToggleStack ? () => onToggleStack(item.stack.rootId) : undefined}
      >
        {item.cards.map(renderCard)}
      </ExpandedStack>
    );
  };

  /** An area's items, folded by stage — the same fold as the board's own, one level in. */
  const renderBandedItems = (items: Item[], span: number) => (
    <div className="space-y-3">
      {BOARD_STAGES.map((stage) => {
        const own = items.filter((item) => stagesIn(item.cards)[0] === stage);
        if (own.length === 0) return null;

        const cards = own.flatMap((item) => item.cards);

        return (
          <BoardStageBand
            key={stage}
            stage={stage}
            total={cards.length}
            remaining={cards.filter((card) => states?.get(card.id)?.status !== "DONE").length}
            open={openStages?.has(stage) ?? true}
            onToggle={onToggleStage ? () => onToggleStage(stage) : undefined}
          >
            {renderBlocks(own, span)}
          </BoardStageBand>
        );
      })}
    </div>
  );

  /**
   * One block: a card, or an area with its cards inside it.
   *
   * An area whose cards span several stages (see `spanningGroups`) is folded by stage inside
   * itself. Any other area lays its items out in a grid of its own, `span` columns wide, so cards
   * in an area can sit next to each other.
   */
  const renderBlock = (block: Block, blockIndex: number, span: number) => {
    if (block.kind !== "group") return renderItem(block);

    if (spanningGroups.includes(block)) {
      return (
        <BoardGroupSection
          group={block.group}
          canMove={onReorder !== undefined}
          onMoveStep={(direction) => moveBlock(blockIndex, direction)}
          onDragMove={(element) => handleGroupDrag(blockIndex, element)}
          onRename={onRenameGroup}
          onToggle={onToggleGroup}
          onDissolve={onDissolveGroup}
          onRecolour={onRecolourGroup}
          // No stage badge: the whole point of this area is that its cards do not share one, and
          // the bands inside say what each of them is.
          registerElement={registerGroupElement}
        >
          {renderBandedItems(block.items, span)}
        </BoardGroupSection>
      );
    }

    // The area's cards in the area's own grid. This is what "things inside an area can sit next to
    // each other" comes down to: an area two columns wide is two columns inside.
    const inner = renderBlocks(block.items, span);

    return (
      <BoardGroupSection
        group={block.group}
        canMove={onReorder !== undefined}
        onMoveStep={(direction) => moveBlock(blockIndex, direction)}
        onDragMove={(element) => handleGroupDrag(blockIndex, element)}
        onRename={onRenameGroup}
        onToggle={onToggleGroup}
        onDissolve={onDissolveGroup}
        onRecolour={onRecolourGroup}
        stage={states?.get(block.cards[0]?.id ?? "")?.stage}
        registerElement={registerGroupElement}
      >
        {inner}
      </BoardGroupSection>
    );
  };

  /** Where a block sits in the board's order, which is what its move controls act on. */
  const indexOfBlock = (block: Block) => blocks.findIndex((candidate) => candidate === block);

  /** One list of rows, dealt into columns. Drawn once flat, or once per band. */
  /**
   * A list of blocks as a grid: each one as wide as it asked for, each one as tall as it measures.
   *
   * This replaced a two-column packing that balanced blocks by an estimate of their height. The
   * packing was the reason a card could only ever be one column or the whole row, why an area laid
   * its cards out one under another, and why "taller" could do nothing but put a floor under a card
   * — none of which were decisions, they were what a flow of two columns can express.
   *
   * `columns` is passed rather than read from a breakpoint, because an area draws the same grid
   * inside itself at its own width: two columns wide means two columns inside, so a card in an area
   * is the same size as a narrow card outside one.
   */
  const renderBlocks = (input: Block[], columns: number) => (
    <div
      className="grid items-start"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_UNIT}px`,
        gap,
      }}
    >
      {/* A block that leaves fades out instead of being cut. Opening a pile swaps one block for
          another in the same slot, and without this the card was gone and the frame simply *there*
          — the crossfade is what makes it read as the same thing changing shape. `initial={false}`
          so a board arriving does not fade every card in behind the page's own entrance.

          `popLayout` takes a leaving block out of the flow the frame it starts fading, so the grid
          closes over it instead of holding its cell for the length of an exit. */}
      <AnimatePresence initial={false} mode="popLayout">
        {input.map((block) => {
          const span = spanOf(block, columns);

          return (
            <GridBlock key={block.key} span={span} gap={gap} reduceMotion={reduceMotion ?? false}>
              {renderBlock(block, indexOfBlock(block), span)}
            </GridBlock>
          );
        })}
      </AnimatePresence>
    </div>
  );

  return (
    // `space-y-12` between the bands, against `space-y-4` between the cards inside one. A heading
    // is only a heading if the gap above it is clearly wider than the gaps it presides over — at
    // the same 24px as everything else, "Later" read as one more thing in the list above rather
    // than as the start of the next one. It is also the room a fanned pile in the last row needs,
    // so the sheets of a card at the bottom of "Now" do not reach into the heading under it.
    <div className="space-y-12" data-arranging={isArranging || undefined}>
      {/* Only while arranging: an empty area is a destination, and a row of empty boxes over a
          board somebody is only reading would be the page advertising work to do. */}
      {isArranging && emptyGroups.length > 0 && onAssignGroup && (
        <section className="space-y-2" aria-label="Areas with nothing in them">
          <p className="px-1 text-xs text-app-text-muted">
            Drop a card into one of these to file it.
          </p>

          <div className="flex flex-wrap gap-3">
            {emptyGroups.map((group) => (
              <div
                key={group.id}
                ref={(element) => {
                  registerGroupElement(group.id, element);
                }}
                className="flex min-h-20 min-w-48 flex-1 flex-col justify-center rounded-2xl border border-dashed border-app-border bg-app-surface-muted/40 px-4 py-3"
              >
                <p className="truncate text-sm font-medium text-app-text" title={group.name}>
                  {group.name}
                </p>
                <p className="text-xs text-app-text-subtle">Empty</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {spanningGroups.map((block) => (
        <div key={block.key}>{renderBlock(block, indexOfBlock(block), columns)}</div>
      ))}

      {bands.length > 0
        ? bands.map((band) => (
            <BoardStageBand
              key={band.stage}
              stage={band.stage}
              total={band.total}
              remaining={band.remaining}
              open={openStages?.has(band.stage) ?? true}
              onToggle={onToggleStage ? () => onToggleStage(band.stage) : undefined}
            >
              {renderBlocks(band.blocks, columns)}
            </BoardStageBand>
          ))
        : renderBlocks(
            blocks.filter((block) => !spanningGroups.includes(block)),
            columns,
          )}
    </div>
  );
}
