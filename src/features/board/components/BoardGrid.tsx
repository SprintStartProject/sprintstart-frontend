import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { ChevronsDownUp, ChevronsUpDown, GripVertical, Layers, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { centralSpringToken } from "../../../styles/tokens";
import { ChecklistCard } from "./ChecklistCard";
import { CompetencyProgressCard } from "./CompetencyProgressCard";
import { CurrentTaskCard } from "./CurrentTaskCard";
import { DiagramCard } from "./DiagramCard";
import { LinkCard } from "./LinkCard";
import { MemoryRecapCard } from "./MemoryRecapCard";
import { NoteCard } from "./NoteCard";
import { ArrivalStepsCard } from "./ArrivalStepsCard";
import { OpenPullRequestsCard } from "./OpenPullRequestsCard";
import { PathToFirstContributionCard } from "./PathToFirstContributionCard";
import { SuggestedTasksCard } from "./SuggestedTasksCard";
import { BoardCardContext } from "./boardCardControls";
import { cardAccent } from "../layout/cardAccents";
import { groupOf, type BoardGroup } from "../layout/boardGroups";
import { cardName } from "../layout/cardNames";
import type { CardStack } from "../layout/cardStacks";
import {
  BOARD_STAGES,
  isSelfReporting,
  STAGE_LABELS,
  type BoardStage,
  type CardState,
} from "../layout/boardStructure";
import { cardWeight, packIntoColumns, spansFullWidth } from "../layout/cardWeights";
import type { AuthoredCardRequest, Board, BoardCard } from "../types";

/** Two columns from Tailwind's `lg` up; one below it. The only width this grid branches on. */
const TWO_COLUMN_QUERY = "(min-width: 1024px)";

/**
 * How long the board ignores further reordering after a move.
 *
 * A drag reports on every frame, but the re-flow it triggers takes a moment to land — and measuring
 * the new positions before they exist makes the next frame move again. Roughly the length of the
 * layout animation, so the next decision is made against where things actually are. Taken from the
 * dashboard, which learned it the same way.
 */
const MOVE_COOLDOWN_MS = 160;

/**
 * The tilt that says "this can be moved".
 *
 * Under a degree, and every card starts at a different point in the cycle, so the board shimmers
 * rather than pulsing in lockstep. It stops the moment the pointer is over a card: a moving target
 * is hard to aim a 36px button at, and the card is already saying it can be moved by the time you
 * have reached it. Lifted from the dashboard, down to the numbers.
 */
const WIGGLE = { rotate: [-0.55, 0.55, -0.55] };

/**
 * The picker's "make a new one" option.
 *
 * A sentinel in the same select rather than a separate button, because creating an area and
 * putting the first card in it are the same intention — a button that made an empty area would
 * leave the hire with a named box and a second step to find.
 */
export const NEW_GROUP = "__new__";

/**
 * The rest of the pile, showing under the card that is standing in for it.
 *
 * Real card edges rather than a hint of one: the same surface, border and shadow an actual card
 * wears, inset and pushed down so what you see below the top card is unmistakably *another card*.
 * This is what says "there is more here" — a caption saying so underneath was the board explaining
 * a picture it should simply have drawn properly.
 *
 * Two edges at most, and they slide visibly further out when the pointer is over the card — that is
 * the moment somebody is deciding whether there is anything under it, and a pile that answers by
 * moving answers before they have read anything. The deepest stops at 28px, which is the room the
 * card's own bottom margin and the column's gap leave before it would lie on the next card. Past
 * two sheets the count on the chip says how deep it goes; a third only makes the card look like it
 * is sagging.
 *
 * They come first in the DOM and the card paints opaque over them, so only the offset shows.
 */
/**
 * Everything on a card that already does something when it is clicked.
 *
 * The top card of a closed stack opens the pile — but these cards are full of controls, and a card
 * that both ticks a checkbox and unfolds a stack gets one of the two wrong. So the card handles a
 * click only when it landed on nothing in particular: on the title, the body text, the padding.
 * Ticking an item, following a link or pressing a control does what it says, and never also opens
 * the pile.
 */
const INTERACTIVE_WITHIN_CARD =
  "a, button, input, select, textarea, label, [role='button'], [role='checkbox'], [role='link']";

const STACK_EDGES = [
  "inset-x-2 top-2 -bottom-2 motion-safe:group-hover/stack:-bottom-4",
  "inset-x-5 top-4 -bottom-4 motion-safe:group-hover/stack:-bottom-7",
];

/**
 * Roughly how much taller an area is than the cards inside it: its header, its padding, and the
 * gaps its own border adds. In the same 40px units `cardWeight` works in — an estimate, used only
 * to decide which column a block starts in.
 */
const GROUP_CHROME_WEIGHT = 2.4;

/**
 * One thing that sits in a column or inside an area: a card, or a sequence spread out.
 *
 * A spread-out stack stays one item rather than becoming its members. Letting the members loose
 * into the packing would deal them into different columns and interleave them with whatever else
 * was around — which is the opposite of what opening a pile is for. You open it to see the run, so
 * the run has to still look like a run.
 */
type Item =
  | { kind: "card"; key: string; card: BoardCard; cards: BoardCard[] }
  | { kind: "stack"; key: string; stack: CardStack; cards: BoardCard[] };

/** One thing the board lays out: an item, or a named area holding items. */
type Block =
  Item | { kind: "group"; key: string; group: BoardGroup; cards: BoardCard[]; items: Item[] };

/** One band of the board: blocks dealt into columns, or one block that needs the whole width. */
type Row =
  | { kind: "run"; key: string; columns: Block[][] }
  | { kind: "full"; key: string; block: Block; columns: number };

/** Where a dragged card counts as being: its own middle, which is what the eye is following. */
function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * A drag's release point in the same space as `getBoundingClientRect`.
 *
 * Framer reports where a pointer was let go in page coordinates, which only agree with an
 * element's box while the page is scrolled to the top — so on a board scrolled down far enough
 * to see the areas, hit-testing without this would always miss.
 */
function toViewport(point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x - window.scrollX, y: point.y - window.scrollY };
}

/** The order that results from putting `movedId` where `targetId` currently is. */
function moveTo(ids: string[], movedId: string, targetId: string): string[] {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return ids;

  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, movedId);

  return next;
}

type BoardGridProps = {
  board: Board;
  onDismiss?: (cardId: string) => void;
  dismissingId?: string | null;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  /** Applies a whole new order. Absent when the board is not arrangeable. */
  onReorder?: (cardIds: string[]) => void;
  /** Arrange mode: every control is on show and the card content stops taking clicks. */
  isArranging?: boolean;
  collapsedIds?: Set<string>;
  onToggleCollapsed?: (cardId: string) => void;
  pinnedIds?: Set<string>;
  onTogglePinned?: (cardId: string) => void;
  groups?: BoardGroup[];
  onAssignGroup?: (cardId: string, groupId: string | null) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  /** An area that was just created, whose name should open for editing straight away. */
  renamingGroupId?: string | null;
  onRenameGroupDone?: () => void;
  onToggleGroup?: (groupId: string) => void;
  /** Takes the area away and leaves its cards on the board, where they already are. */
  onDissolveGroup?: (groupId: string) => void;
  /**
   * Every card's derived place in the process, keyed by id.
   *
   * Absent on a board with no process layer, which is why it is read through `states?.get(...)`
   * everywhere rather than defaulted: a board that has never been sequenced should say nothing
   * about sequence, not claim every card is open and due now.
   */
  states?: Map<string, CardState>;
  onAssignStage?: (cardId: string, stage: BoardStage) => void;
  /** Puts every card of an area in one stage — sequencing twelve cards in one gesture. */
  onAssignGroupStage?: (groupId: string, cardIds: string[], stage: BoardStage) => void;
  onToggleDone?: (cardId: string, done: boolean) => void;
  /** Makes a card wait on one other card, or on nothing. */
  onSetPredecessor?: (cardId: string, blockerId: string | null) => void;
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
};

type SharedProps = {
  card: BoardCard;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
};

/**
 * Renders one card by its kind.
 *
 * The catalog is closed, so this switch is exhaustive by construction — but an unknown kind still
 * renders something visible rather than nothing: a card that silently disappears because the client
 * is a version behind is indistinguishable from the mentor never having placed it.
 */
function BoardCardView({
  card,
  onEdit,
  ...shared
}: SharedProps & { onEdit?: (cardId: string, request: AuthoredCardRequest) => void }) {
  const props = { card, ...shared };
  switch (card.content.kind) {
    case "PATH_TO_FIRST_CONTRIBUTION":
      return <PathToFirstContributionCard content={card.content} {...props} />;
    case "ARRIVAL_STEPS":
      return <ArrivalStepsCard content={card.content} {...props} />;
    case "OPEN_PULL_REQUESTS":
      return <OpenPullRequestsCard content={card.content} {...props} />;
    case "CURRENT_TASK":
      return <CurrentTaskCard content={card.content} {...props} />;
    case "SUGGESTED_TASKS":
      return <SuggestedTasksCard content={card.content} {...props} />;
    case "COMPETENCY_PROGRESS":
      return <CompetencyProgressCard content={card.content} {...props} />;
    case "MEMORY_RECAP":
      return <MemoryRecapCard content={card.content} {...props} />;
    case "DIAGRAM":
      return <DiagramCard content={card.content} {...props} />;
    case "NOTE":
      return <NoteCard content={card.content} onEdit={onEdit} {...props} />;
    case "LINK":
      return <LinkCard content={card.content} {...props} />;
    case "CHECKLIST":
      return <ChecklistCard content={card.content} onEdit={onEdit} {...props} />;
    default:
      return (
        <section className="rounded-2xl border border-dashed border-app-border p-4">
          <p className="text-sm text-app-text-muted">
            This card needs a newer version of the app to show.
          </p>
        </section>
      );
  }
}

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
  onReorder,
  isArranging = false,
  collapsedIds,
  onToggleCollapsed,
  pinnedIds,
  onTogglePinned,
  groups = [],
  onAssignGroup,
  onRenameGroup,
  renamingGroupId,
  onRenameGroupDone,
  onToggleGroup,
  onDissolveGroup,
  states,
  onAssignStage,
  onAssignGroupStage,
  onToggleDone,
  onSetPredecessor,
  stacks,
  expandedStackIds,
  onToggleStack,
}: BoardGridProps) {
  const twoColumns = useMediaQuery(TWO_COLUMN_QUERY);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const groupElements = useRef(new Map<string, HTMLElement>());
  const lastMoveAt = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const ids = useMemo(() => board.cards.map((card) => card.id), [board.cards]);

  const move = onReorder
    ? (cardId: string, direction: "up" | "down") => {
        const from = ids.indexOf(cardId);
        const to = direction === "up" ? from - 1 : from + 1;
        if (from === -1 || to < 0 || to >= ids.length) return;
        const next = [...ids];
        [next[from], next[to]] = [next[to], next[from]];
        onReorder(next);
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
  const handleCardDrop = useCallback(
    (cardId: string, point: { x: number; y: number }) => {
      if (!onAssignGroup) return;

      const { x, y } = toViewport(point);

      for (const [groupId, element] of groupElements.current) {
        if (contains(element, x, y)) {
          if (groupOf(groups, cardId)?.id !== groupId) onAssignGroup(cardId, groupId);

          return;
        }
      }

      if (groupOf(groups, cardId)) onAssignGroup(cardId, null);
    },
    [groups, onAssignGroup],
  );

  const handleDrag = useCallback(
    (id: string) => {
      const dragged = elements.current.get(id);
      if (!dragged || !onReorder) return;

      const now = performance.now();
      if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

      const { x, y } = centerOf(dragged);

      for (const [candidateId, element] of elements.current) {
        if (candidateId !== id && contains(element, x, y)) {
          onReorder(moveTo(ids, id, candidateId));
          lastMoveAt.current = now;
          return;
        }
      }
    },
    [ids, onReorder],
  );

  /**
   * The board as blocks, in board order: one card, or one named area with its cards inside it.
   *
   * An area takes the place of its first member, so grouping cards moves them together to where the
   * earliest of them already sat rather than to the end. Everything is built from `board.cards` in
   * order, which is what keeps the grouping a *display* decision — the order underneath is
   * untouched, and ungrouping puts every card back exactly where it was.
   */
  const blocks = useMemo<Block[]>(() => {
    /** A list of cards as items, with the members of any open stack folded back into one. */
    const toItems = (cards: BoardCard[]): Item[] => {
      const items: Item[] = [];
      const seen = new Set<string>();

      for (const card of cards) {
        if (seen.has(card.id)) continue;

        const stack = stacks?.get(card.id);
        if (stack && expandedStackIds?.has(stack.rootId)) {
          const members = cards.filter((member) => stack.memberIds.includes(member.id));
          members.forEach((member) => seen.add(member.id));
          items.push({ kind: "stack", key: `stack-${stack.rootId}`, stack, cards: members });
          continue;
        }

        items.push({ kind: "card", key: `card-${card.id}`, card, cards: [card] });
      }

      return items;
    };

    const built: Block[] = [];
    const placed = new Set<string>();

    for (const card of board.cards) {
      if (placed.has(card.id)) continue;

      const group = groupOf(groups, card.id);
      if (group) {
        // Members in the board's own order, whatever order they were added to the area in.
        const members = board.cards.filter((member) => group.cardIds.includes(member.id));
        members.forEach((member) => placed.add(member.id));
        built.push({
          kind: "group",
          key: `group-${group.id}`,
          group,
          cards: members,
          items: toItems(members),
        });
        continue;
      }

      const stack = stacks?.get(card.id);
      if (stack && expandedStackIds?.has(stack.rootId)) {
        const members = board.cards.filter((member) => stack.memberIds.includes(member.id));
        members.forEach((member) => placed.add(member.id));
        built.push({ kind: "stack", key: `stack-${stack.rootId}`, stack, cards: members });
        continue;
      }

      built.push({ kind: "card", key: `card-${card.id}`, card, cards: [card] });
    }

    return built;
  }, [board.cards, expandedStackIds, groups, stacks]);

  /**
   * The blocks dealt into columns, broken by anything that needs the full width.
   *
   * **Areas are packed like cards, not laid out around them.** An area used to be a full-width band
   * with its own two-column grid inside it, which meant an area holding one short note was a band
   * across the whole board with an empty half beside the note — a box claiming far more importance
   * than its contents. Packed, it is as wide as a column and as tall as what is in it, which is
   * what an area of one small card should look like.
   *
   * Runs rather than one packing pass, so a full-width block is a real break: what follows it
   * starts fresh columns instead of flowing around it, which keeps its position in the order
   * visible on screen. An area holding a diagram takes the full width too — half of a half-width
   * column is not enough of a picture to read, wherever the picture is filed.
   */
  const rows = useMemo(() => {
    const columns = twoColumns ? 2 : 1;
    const weightOf = (card: BoardCard) => cardWeight(card, collapsedIds?.has(card.id) ?? false);
    const blockWeight = (block: Block) =>
      block.cards.reduce((total, card) => total + weightOf(card), 0) +
      (block.kind === "card" ? 0 : GROUP_CHROME_WEIGHT);

    const built: Row[] = [];
    let run: Block[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      built.push({
        kind: "run",
        key: `run-${run[0].key}`,
        // Never more columns than there are blocks: two columns for one block is an empty column,
        // which is the same empty half the area bands used to have.
        columns: packIntoColumns(run, Math.min(columns, run.length), blockWeight),
      });
      run = [];
    };

    for (const block of blocks) {
      if (block.cards.some(spansFullWidth)) {
        flushRun();
        built.push({ kind: "full", key: block.key, block, columns: columns });
      } else {
        run.push(block);
      }
    }
    flushRun();

    return built;
  }, [blocks, collapsedIds, twoColumns]);

  /**
   * Moves a whole block — a named area, or the diagram that owns its row — past its neighbour.
   *
   * An area has no position of its own: it sits where its earliest member sits. So moving one is
   * moving all of its cards at once, which is what this does — put a block where another block is
   * and send the order that falls out. Nothing about the grouping changes, only where its cards are
   * in the board.
   */
  const moveBlockTo = useCallback(
    (from: number, to: number) => {
      if (!onReorder || from === to || to < 0 || to >= blocks.length) return;

      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next.flatMap((block) => block.cards.map((card) => card.id)));
    },
    [blocks, onReorder],
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
        isWiggling={isArranging && !reduceMotion && hoveredId !== card.id && draggingId !== card.id}
        collapsed={collapsedIds?.has(card.id) ?? false}
        pinned={pinnedIds?.has(card.id) ?? false}
        onToggleCollapsed={onToggleCollapsed}
        onTogglePinned={onTogglePinned}
        groups={groups}
        onAssignGroup={onAssignGroup}
        allCards={board.cards}
        state={states?.get(card.id)}
        onAssignStage={isArranging ? onAssignStage : undefined}
        onToggleDone={onToggleDone}
        onSetPredecessor={isArranging ? onSetPredecessor : undefined}
        onDrop={handleCardDrop}
        onMove={move}
        onDismiss={onDismiss}
        dismissing={dismissingId === card.id}
        onEdit={onEdit}
        registerElement={registerElement}
        onDragStart={() => {
          lastMoveAt.current = 0;
          setDraggingId(card.id);
        }}
        onDrag={() => handleDrag(card.id)}
        onDragEnd={() => setDraggingId(null)}
        onHoverChange={(hovered) =>
          setHoveredId((current) => (hovered ? card.id : current === card.id ? null : current))
        }
        stack={chipOwner}
        onToggleStack={onToggleStack}
      />
    );
  };

  /**
   * One block: a card, or an area with its cards stacked inside it.
   *
   * `wide` is only true for a block that broke the run — an area holding a diagram. It packs that
   * area's members into columns of their own, because the reason it took the full width was that
   * something in it needed the room, not that the area did.
   */
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

  const renderBlock = (block: Block, blockIndex: number, wide: boolean) => {
    if (block.kind !== "group") return renderItem(block);

    const inner =
      wide && twoColumns ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {packIntoColumns(block.items, Math.min(2, block.items.length), (item) =>
            item.cards.reduce(
              (total, card) => total + cardWeight(card, collapsedIds?.has(card.id) ?? false),
              0,
            ),
          ).map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-4">
              {column.map((item) => (
                <div key={item.key}>{renderItem(item)}</div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {block.items.map((item) => (
            <div key={item.key}>{renderItem(item)}</div>
          ))}
        </div>
      );

    return (
      <BoardGroupSection
        group={block.group}
        isArranging={isArranging}
        canMove={onReorder !== undefined}
        onMoveStep={(direction) => moveBlock(blockIndex, direction)}
        onDragMove={(element) => handleGroupDrag(blockIndex, element)}
        onRename={onRenameGroup}
        autoEditName={block.group.id === renamingGroupId}
        onNameEditDone={onRenameGroupDone}
        onToggle={onToggleGroup}
        onDissolve={onDissolveGroup}
        stage={states?.get(block.cards[0]?.id ?? "")?.stage}
        onAssignStage={
          onAssignGroupStage
            ? (stage) =>
                onAssignGroupStage(
                  block.group.id,
                  block.cards.map((card) => card.id),
                  stage,
                )
            : undefined
        }
        registerElement={registerGroupElement}
      >
        {inner}
      </BoardGroupSection>
    );
  };

  /** Where a block sits in the board's order, which is what its move controls act on. */
  const indexOfBlock = (block: Block) => blocks.findIndex((candidate) => candidate === block);

  return (
    <div className="space-y-4" data-arranging={isArranging || undefined}>
      {rows.map((row) => {
        if (row.kind === "full") {
          return <div key={row.key}>{renderBlock(row.block, indexOfBlock(row.block), true)}</div>;
        }

        return (
          <div
            key={row.key}
            // `items-start` so a short column stops at its last card instead of stretching to
            // match the tall one beside it — which is what would put an area's tinted box back to
            // twice the height of the one card in it.
            className={row.columns.length > 1 ? "grid items-start gap-4 lg:grid-cols-2" : undefined}
          >
            {row.columns.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-4">
                {column.map((block) => (
                  <div key={block.key}>{renderBlock(block, indexOfBlock(block), false)}</div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

type ExpandedStackProps = {
  stack: CardStack;
  /** Puts the pile back together. Absent on a board whose stacks cannot be opened. */
  onCollapse?: () => void;
  children: ReactNode;
};

/**
 * A sequence that has been spread out, held together so it still reads as one.
 *
 * The point of opening a pile is seeing the run — which the layout would take straight back if the
 * cards were released into the packing: two columns and a greedy pass would deal the third card
 * beside the first and put somebody else's note between them. So the run keeps one slot and lays
 * its cards out inside it, in the order they are meant to be worked, and stays inside whatever area
 * it was filed in.
 *
 * Numbered down the left, because that is the one thing a spread-out sequence stops saying for
 * itself: closed, the pile *was* the claim that these come in an order; open, the cards look like
 * any other cards under each other.
 *
 * Quieter than an area's frame on purpose — dashed, untinted. An area is somewhere the hire filed
 * things; this is a pile they happen to have open, and it closes again the moment they look
 * elsewhere.
 */
function ExpandedStack({ stack, onCollapse, children }: ExpandedStackProps) {
  return (
    <section
      aria-label={`Sequence of ${stack.memberIds.length} cards`}
      // Read by the click-away handler: a press on this frame's header, padding or numbers is a
      // press *on the open pile*, not away from it. Without it, "Put back" would be caught as a
      // click outside, close the pile, and then have its own handler open it straight back up.
      data-stack-root={stack.rootId}
      className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted/40 p-3"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-app-text-muted">
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {stack.memberIds.length} cards, in order · {stack.remaining} still to do
          </span>
        </span>

        {onCollapse && (
          <Button variant="ghost" size="sm" onClick={onCollapse}>
            Put back
          </Button>
        )}
      </header>

      {/* Numbered so the order survives being spread out. `tabular-nums` keeps a two-digit step
          from shifting its card a pixel left of the one above it. */}
      <ol className="space-y-4">
        {Children.map(children, (child, index) => (
          <li className="flex min-w-0 items-start gap-2">
            <span className="mt-4 w-4 shrink-0 text-right text-xs text-app-text-subtle tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{child}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type BoardCardCellProps = {
  card: BoardCard;
  index: number;
  total: number;
  isArranging: boolean;
  isDragging: boolean;
  isWiggling: boolean;
  collapsed: boolean;
  pinned: boolean;
  onToggleCollapsed?: (cardId: string) => void;
  onTogglePinned?: (cardId: string) => void;
  groups: BoardGroup[];
  onAssignGroup?: (cardId: string, groupId: string | null) => void;
  /** Every card on the board, so this one can offer them as things to wait on. */
  allCards: BoardCard[];
  state?: CardState;
  onAssignStage?: (cardId: string, stage: BoardStage) => void;
  onToggleDone?: (cardId: string, done: boolean) => void;
  onSetPredecessor?: (cardId: string, blockerId: string | null) => void;
  /**
   * Set only on the top card of a *closed* pile — the one standing in for the others.
   *
   * Which is why nothing here asks whether the stack is open: an open one is drawn by
   * `ExpandedStack` and its cards are ordinary cards, so this being set *is* "the pile is closed".
   */
  stack?: CardStack;
  onToggleStack?: (rootId: string) => void;
  onDrop: (cardId: string, point: { x: number; y: number }) => void;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  registerElement: (id: string, element: HTMLDivElement | null) => void;
  onDragStart: () => void;
  onDrag: () => void;
  onDragEnd: () => void;
  onHoverChange: (hovered: boolean) => void;
};

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
 * all, which is why the arrows that used to sit in every header were replaced *by this* rather than
 * simply removed.
 */
function BoardCardCell({
  card,
  index,
  total,
  isArranging,
  isDragging,
  isWiggling,
  collapsed,
  pinned,
  onToggleCollapsed,
  onTogglePinned,
  groups,
  onAssignGroup,
  allCards,
  state,
  onAssignStage,
  onToggleDone,
  onSetPredecessor,
  stack,
  onToggleStack,
  onDrop,
  onMove,
  onDismiss,
  dismissing,
  onEdit,
  registerElement,
  onDragStart,
  onDrag,
  onDragEnd,
  onHoverChange,
}: BoardCardCellProps) {
  const dragControls = useDragControls();

  const label = card.content.kind === "NOTE" ? "note" : card.content.kind.toLowerCase();

  /**
   * The card this one waits on, for the picker to show.
   *
   * `blockedBy` only lists predecessors that are *not yet done*, which is right for the badge and
   * wrong for the control: a hire who finished the predecessor should still see which card they
   * put in front of this one, or the picker would silently forget the sequence they arranged.
   */
  const predecessorId = state?.predecessorId ?? null;

  /**
   * Opens the pile when the card itself is clicked.
   *
   * The chip in the header is still the real control — it is what a keyboard reaches, what a screen
   * reader announces, and what carries `aria-expanded`. This is the pointer shortcut beside it:
   * the card *looks* like a pile, so clicking the pile should open it, and hunting for a chip to do
   * something the whole card is depicting is the kind of small friction nobody reports and
   * everybody feels.
   *
   * Three things it stays out of the way of: anything that already does something when clicked
   * (see {@link INTERACTIVE_WITHIN_CARD}), the click that ends a drag while the board is being
   * arranged, and the click that ends a text selection — releasing after selecting a line is not a
   * request to rearrange the page under it.
   */
  function handleStackClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!stack || isArranging || !onToggleStack) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;
    if ((window.getSelection()?.toString().length ?? 0) > 0) return;

    onToggleStack(stack.rootId);
  }

  const controls = useMemo(
    () => ({
      collapsed,
      pinned,
      accent: cardAccent(card.content.kind),
      groupPicker: onAssignGroup ? (
        <Select
          size="sm"
          value={groupOf(groups, card.id)?.id ?? ""}
          aria-label={`Area for the ${label} card`}
          // Narrow, because it now sits in every card's header rather than only in arrange mode,
          // and the control cluster does not shrink — every pixel it takes comes off the title.
          className="max-w-32"
          onChange={(event) => onAssignGroup(card.id, event.target.value || null)}
        >
          <option value="">No area</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
          <option value={NEW_GROUP}>New area…</option>
        </Select>
      ) : undefined,
      state,
      // Only for the kinds nothing can observe. A checklist reports its own progress, and a
      // hand-set "done" beside three outstanding items is the board contradicting itself.
      onToggleDone:
        onToggleDone && !isSelfReporting(card)
          ? () => onToggleDone(card.id, state?.status !== "DONE")
          : undefined,
      stagePicker: onAssignStage ? (
        <Select
          size="sm"
          value={state?.stage ?? "NOW"}
          aria-label={`When the ${label} card is due`}
          className="max-w-32"
          onChange={(event) => onAssignStage(card.id, event.target.value as BoardStage)}
        >
          {BOARD_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage].title}
            </option>
          ))}
        </Select>
      ) : undefined,
      dependencyPicker: onSetPredecessor ? (
        <Select
          size="sm"
          value={state?.blockedBy[0]?.id ?? predecessorId ?? ""}
          aria-label={`What the ${label} card waits on`}
          className="max-w-40"
          onChange={(event) => onSetPredecessor(card.id, event.target.value || null)}
        >
          <option value="">Waits on nothing</option>
          {allCards
            .filter((other) => other.id !== card.id)
            .map((other) => (
              <option key={other.id} value={other.id}>
                After: {cardName(other)}
              </option>
            ))}
        </Select>
      ) : undefined,
      stack:
        stack && onToggleStack
          ? {
              position: stack.memberIds.indexOf(card.id) + 1,
              total: stack.memberIds.length,
              remaining: stack.remaining,
              onToggle: () => onToggleStack(stack.rootId),
            }
          : undefined,
      onToggleCollapsed: onToggleCollapsed ? () => onToggleCollapsed(card.id) : undefined,
      onTogglePinned: onTogglePinned ? () => onTogglePinned(card.id) : undefined,
      dragHandle: onMove ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          title="Drag to move this card, or use the arrow keys"
          aria-label={`Move the ${label} card — drag, or use the arrow keys`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => dragControls.start(event)}
          onKeyDown={(event) => {
            const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
            const on = event.key === "ArrowDown" || event.key === "ArrowRight";
            if (!back && !on) return;
            event.preventDefault();
            if (back && index > 0) onMove(card.id, "up");
            if (on && index < total - 1) onMove(card.id, "down");
          }}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : undefined,
    }),
    [
      allCards,
      card,
      collapsed,
      dragControls,
      groups,
      index,
      label,
      onAssignGroup,
      onAssignStage,
      onMove,
      onSetPredecessor,
      onToggleStack,
      onToggleCollapsed,
      onToggleDone,
      onTogglePinned,
      pinned,
      predecessorId,
      stack,
      state,
      total,
    ],
  );

  return (
    <motion.div
      ref={(element) => registerElement(card.id, element)}
      layout="position"
      transition={centralSpringToken}
      drag={onMove !== undefined}
      // Outside arrange mode only the grip starts a drag, so every checkbox, link and button on a
      // card keeps working without a mode to leave first. Inside it, where the content is inert
      // anyway, the whole card is the handle — that is what the mode is for.
      dragListener={isArranging}
      dragControls={dragControls}
      dragSnapToOrigin
      // No elasticity: the card should sit under the pointer, not lag behind it on a spring.
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={(_event, info) => {
        onDrop(card.id, info.point);
        onDragEnd();
      }}
      onClick={handleStackClick}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      // The extra bottom margin is the room the pile needs: the deepest edge sits 24px below the
      // card, and the column's own 16px gap would otherwise have it lying on the next card.
      className={`group/stack relative ${stack ? "mb-4 cursor-pointer" : ""} ${
        isDragging ? "z-40 cursor-grabbing" : ""
      }`}
      style={isArranging ? { touchAction: "none" } : undefined}
    >
      {/* Counted from what is still to do, not from how long the run is: three of five ticked off
          leaves one card behind this one, and drawing two would be the board overstating what is
          left. */}
      {stack &&
        STACK_EDGES.slice(0, Math.max(stack.remaining - 1, 0)).map((edge, depth) => (
          <div
            key={depth}
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-2xl border border-app-border bg-app-surface shadow-sm transition-[bottom] duration-200 ${edge}`}
          />
        ))}

      {/* Two nested motion elements, deliberately — the same split the dashboard needs. The outer
          one does `layout` and `drag`, and Framer measures it; this inner one carries the wiggle's
          rotation, which changes an element's measured box and would poison a layout projection
          measured against it. */}
      <motion.div
        animate={isWiggling ? WIGGLE : { rotate: 0 }}
        transition={
          isWiggling
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: (index % 5) * 0.08 }
            : centralSpringToken
        }
      >
        <BoardCardContext.Provider value={controls}>
          <BoardCardView
            card={card}
            onDismiss={onDismiss}
            dismissing={dismissing}
            onEdit={onEdit}
          />
        </BoardCardContext.Provider>
      </motion.div>
    </motion.div>
  );
}

type BoardGroupSectionProps = {
  group: BoardGroup;
  isArranging: boolean;
  canMove: boolean;
  onMoveStep: (direction: "up" | "down") => void;
  onDragMove: (element: HTMLElement) => void;
  onRename?: (groupId: string, name: string) => void;
  /** Opens the name for editing straight away — set on an area that was just created. */
  autoEditName?: boolean;
  /** Told when the name editor closes, so the caller can stop asking for it. */
  onNameEditDone?: () => void;
  onToggle?: (groupId: string) => void;
  onDissolve?: (groupId: string) => void;
  /** The earliest stage among the area's cards, shown as the area's own. */
  stage?: BoardStage;
  /** Puts every card of this area in one stage. Absent when the board has no process layer. */
  onAssignStage?: (stage: BoardStage) => void;
  registerElement: (groupId: string, element: HTMLElement | null) => void;
  children: ReactNode;
};

/**
 * One named area: its header, and the cards packed inside it.
 *
 * A component of its own for the same reason a card cell is — the drag controls are a hook, and an
 * area needs its own.
 *
 * An area has no position of its own; it sits where its earliest card sits. Moving it therefore
 * moves every card in it at once, which is why the grip belongs to the header rather than to any
 * of the cards inside. Dragging works exactly as it does for a card: the area lands on whatever
 * block its middle is over. The arrow keys do the same in one step, so an area is movable without
 * a pointer.
 */
function BoardGroupSection({
  group,
  isArranging,
  canMove,
  onMoveStep,
  onDragMove,
  onRename,
  autoEditName = false,
  onNameEditDone,
  onToggle,
  onDissolve,
  stage,
  onAssignStage,
  registerElement,
  children,
}: BoardGroupSectionProps) {
  const dragControls = useDragControls();
  const element = useRef<HTMLElement | null>(null);

  // The name being typed, or null when it is not being edited. A draft rather than writing every
  // keystroke through: the areas are persisted on every change, and renaming an area character by
  // character would be a storage write per key.
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const nameInput = useRef<HTMLInputElement>(null);

  // Focused from an effect rather than through `autoFocus`, which `jsx-a11y` rejects — rightly, for
  // the case it is usually reached for, a field grabbing focus on page load. This is the other
  // case: the field appeared because the hire just made this area, and their next act is naming it.
  useEffect(() => {
    if (!editing) return;
    nameInput.current?.focus();
    nameInput.current?.select();
  }, [editing]);

  // Derived during render rather than in an effect, the way the board's other read-once state is:
  // a just-created area has to open its editor on the render that first shows it, or the focus
  // lands after the hire has already looked away.
  const [autoOpened, setAutoOpened] = useState(false);
  if (autoEditName && !autoOpened) {
    setAutoOpened(true);
    setDraft(group.name);
  }

  function closeName() {
    setDraft(null);
    onNameEditDone?.();
  }

  function commitName() {
    const next = (draft ?? "").trim();
    // An area with no name is an area nobody can talk about, so an emptied field keeps the old one.
    if (next && next !== group.name) onRename?.(group.id, next);
    closeName();
  }

  function cancelName() {
    closeName();
  }

  return (
    <motion.section
      ref={(node) => {
        element.current = node;
        registerElement(group.id, node);
      }}
      layout="position"
      transition={centralSpringToken}
      drag={canMove}
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDrag={() => element.current && onDragMove(element.current)}
      aria-label={group.name}
      // Tinted rather than outlined: an area is a tray the cards sit *in*, and a dashed rectangle
      // around white cards on a white page reads as a gap, not as a container. The brand tint is
      // kept low so a board of several areas is still a board and not a set of banners.
      className="rounded-2xl border border-app-brand-border bg-app-brand-soft p-3 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {canMove && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              title="Drag to move this area, or use the arrow keys"
              aria-label={`Move the ${group.name} area — drag, or use the arrow keys`}
              className="-ml-1 cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => dragControls.start(event)}
              onKeyDown={(event) => {
                const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
                const on = event.key === "ArrowDown" || event.key === "ArrowRight";
                if (!back && !on) return;
                event.preventDefault();
                onMoveStep(back ? "up" : "down");
              }}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {/* The name is the control. Renaming used to be an input that existed only in arrange
              mode, so naming the area you had just made meant leaving what you were doing, finding
              an unlabelled button and coming back. A heading you can click is where everybody
              already tries first. */}
          {editing && onRename ? (
            <Input
              size="sm"
              ref={nameInput}
              value={draft ?? ""}
              // Selected on focus so a freshly created area's placeholder name is replaced by
              // typing rather than edited around.
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitName();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelName();
                }
              }}
              aria-label={`Name of the ${group.name} area`}
              className="max-w-56"
            />
          ) : (
            <h2 className="min-w-0 truncate text-sm font-semibold text-app-brand-text">
              {onRename ? (
                <button
                  type="button"
                  onClick={() => setDraft(group.name)}
                  title="Rename this area"
                  className="max-w-full truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  {group.name}
                </button>
              ) : (
                group.name
              )}
            </h2>
          )}

          <span className="shrink-0 text-xs text-app-text-subtle tabular-nums">
            {group.cardIds.length}
          </span>

          {/* An area is where sequencing is worth doing: a PM who has grouped twelve setup cards
              wants them all due now, and setting that twelve times is how a good idea becomes a
              chore nobody repeats. Outside arrange mode the stage is a fact, so it reads as a
              badge rather than as a control offering to change something. */}
          {stage &&
            (onAssignStage && isArranging ? (
              <Select
                size="sm"
                value={stage}
                aria-label={`When the ${group.name} area is due`}
                className="max-w-32"
                onChange={(event) => onAssignStage(event.target.value as BoardStage)}
              >
                {BOARD_STAGES.map((option) => (
                  <option key={option} value={option}>
                    {STAGE_LABELS[option].title}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge variant={stage === "NOW" ? "brand" : "neutral"} size="sm">
                {STAGE_LABELS[stage].title}
              </Badge>
            ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onDissolve && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => onDissolve(group.id)}
              title="Take this area away — the cards stay on the board"
              aria-label={`Take the ${group.name} area away`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {onToggle && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => onToggle(group.id)}
              aria-expanded={!group.collapsed}
              aria-label={
                group.collapsed ? `Unfold the ${group.name} area` : `Fold the ${group.name} area`
              }
            >
              {group.collapsed ? (
                <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </header>

      {!group.collapsed && children}
    </motion.section>
  );
}
