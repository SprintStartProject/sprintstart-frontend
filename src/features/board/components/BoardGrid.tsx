import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { originOf, type CardOrigins } from "../layout/cardOrigins";
import { useBoardPath } from "../hooks/boardPath";
import { useCardDrag } from "../hooks/useCardDrag";
import { useOpenPileDismissal } from "../hooks/useOpenPileDismissal";
import { leadsOntoPath } from "../layout/pathStages";
import { BoardCardCell } from "./BoardCardCell";
import { BoardGroupSection } from "./BoardGroupSection";
import { ExpandedStack } from "./ExpandedStack";
import { GridBlock } from "./GridBlock";
import { BoardStageBand } from "./BoardStageBand";
import type { AreaAccent } from "../layout/areaAccents";
import type { BoardGroup } from "../layout/boardGroups";
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
import { centerOf } from "../layout/dragGeometry";
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

  const {
    draggingId,
    pileTargetId,
    pileAreaMove,
    registerElement,
    registerGroupElement,
    elementOf,
    cardIdAt,
    cooledDown,
    markMoved,
    startDrag,
    drag,
    endDrag,
    drop,
  } = useCardDrag({
    groups,
    stacks,
    expandedStackIds,
    onStackOnto,
    onAssignGroup,
    onReorder,
    reorder,
  });

  useOpenPileDismissal({ isArranging, expandedStackIds, onToggleStack });

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

    const element = elementOf(pending);
    if (!element) return;

    // After the paint, so the card is where it is going to be rather than where the layout
    // animation started it.
    const frame = requestAnimationFrame(() =>
      element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }),
    );

    return () => cancelAnimationFrame(frame);
  }, [elementOf, expandedStackIds, reduceMotion]);

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
        onDrop={drop}
        onMove={move}
        onDismiss={onDismiss}
        dismissing={dismissingId === card.id}
        onEdit={onEdit}
        onRestorePrevious={onRestorePrevious}
        restoring={restoringIds.has(card.id)}
        saving={savingIds.has(card.id)}
        undoNotice={undoNotices.get(card.id) ?? null}
        registerElement={registerElement}
        onDragStart={() => startDrag(card.id)}
        onDrag={(point) => drag(card.id, point)}
        onDragEnd={endDrag}
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
