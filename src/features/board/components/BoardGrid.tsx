import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { ChevronsDownUp, ChevronsUpDown, GripVertical, X } from "lucide-react";
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
  onToggleGroup?: (groupId: string) => void;
  /** Takes the area away and leaves its cards on the board, where they already are. */
  onDissolveGroup?: (groupId: string) => void;
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
  onToggleGroup,
  onDissolveGroup,
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
   * The board as rows: a run of ordinary cards dealt into columns, or one full-width card.
   *
   * Built as runs rather than one packing pass so a full-width card is a real break — the cards
   * after it start fresh columns instead of flowing around it, which is what keeps its position in
   * the order visible on screen.
   */
  /**
   * The board as a list of blocks, in board order: a named group, a full-width card, or a run of
   * ordinary cards dealt into columns.
   *
   * A group takes the place of its first member, so grouping cards moves them together to where
   * the earliest of them already sat rather than to the end. Everything is built from `board.cards`
   * in order, which is what keeps the grouping a *display* decision — the order underneath is
   * untouched, and ungrouping puts every card back exactly where it was.
   */
  const rows = useMemo(() => {
    const columns = twoColumns ? 2 : 1;
    const weightOf = (card: BoardCard) => cardWeight(card, collapsedIds?.has(card.id) ?? false);

    type Row = { key: string; cards: BoardCard[] } & (
      | { kind: "run"; columns: BoardCard[][] }
      | { kind: "full"; card: BoardCard }
      | { kind: "group"; group: BoardGroup; columns: BoardCard[][] }
    );

    const built: Row[] = [];
    let run: BoardCard[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      built.push({
        kind: "run",
        key: `run-${run[0].id}`,
        cards: run,
        columns: packIntoColumns(run, columns, weightOf),
      });
      run = [];
    };

    const placed = new Set<string>();

    for (const card of board.cards) {
      if (placed.has(card.id)) continue;

      const group = groupOf(groups, card.id);
      if (group) {
        flushRun();
        // Members in the board's own order, whatever order they were added to the group in.
        const members = board.cards.filter((c) => group.cardIds.includes(c.id));
        members.forEach((member) => placed.add(member.id));
        built.push({
          kind: "group",
          key: `group-${group.id}`,
          group,
          cards: members,
          columns: group.collapsed ? [] : packIntoColumns(members, columns, weightOf),
        });
        continue;
      }

      if (spansFullWidth(card)) {
        flushRun();
        built.push({ kind: "full", key: `full-${card.id}`, cards: [card], card });
      } else {
        run.push(card);
      }
    }
    flushRun();

    return built;
  }, [board.cards, collapsedIds, groups, twoColumns]);

  /**
   * Moves a whole block — a named area, or the diagram that owns its row — past its neighbour.
   *
   * An area has no position of its own: it sits where its earliest member sits. So moving one is
   * moving all of its cards at once, which is what this does — swap two blocks and send the order
   * that falls out. Nothing about the grouping changes, only where its cards are in the board.
   */
  /** Puts a block where another block currently is, and sends the order that falls out. */
  const moveRowTo = useCallback(
    (from: number, to: number) => {
      if (!onReorder || from === to || to < 0 || to >= rows.length) return;

      const next = [...rows];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next.flatMap((row) => row.cards.map((card) => card.id)));
    },
    [onReorder, rows],
  );

  /** A dragged area lands on whatever block its middle is over, the way a dragged card does. */
  const handleGroupDrag = useCallback(
    (rowIndex: number, element: HTMLElement) => {
      const now = performance.now();
      if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

      const { x, y } = centerOf(element);
      for (const [cardId, candidate] of elements.current) {
        if (!contains(candidate, x, y)) continue;

        const target = rows.findIndex((row) => row.cards.some((card) => card.id === cardId));
        if (target === -1 || target === rowIndex) return;

        moveRowTo(rowIndex, target);
        lastMoveAt.current = now;

        return;
      }
    },
    [moveRowTo, rows],
  );

  const moveRow = (rowIndex: number, direction: "up" | "down") => {
    const target = direction === "up" ? rowIndex - 1 : rowIndex + 1;
    if (!onReorder || target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[rowIndex], next[target]] = [next[target], next[rowIndex]];
    onReorder(next.flatMap((row) => row.cards.map((card) => card.id)));
  };

  const renderCard = (card: BoardCard) => (
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
      onAssignGroup={isArranging ? onAssignGroup : undefined}
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
    />
  );

  return (
    <div className="space-y-4" data-arranging={isArranging || undefined}>
      {rows.map((row, rowIndex) => {
        if (row.kind === "full") return <div key={row.key}>{renderCard(row.card)}</div>;

        const packed = (
          <div className={row.columns.length > 1 ? "grid gap-4 lg:grid-cols-2" : undefined}>
            {row.columns.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-4">
                {column.map(renderCard)}
              </div>
            ))}
          </div>
        );

        if (row.kind === "run") return <div key={row.key}>{packed}</div>;

        return (
          <BoardGroupSection
            key={row.key}
            group={row.group}
            isArranging={isArranging}
            canMove={onReorder !== undefined}
            onMoveStep={(direction) => moveRow(rowIndex, direction)}
            onDragMove={(element) => handleGroupDrag(rowIndex, element)}
            onRename={onRenameGroup}
            onToggle={onToggleGroup}
            onDissolve={onDissolveGroup}
            registerElement={registerGroupElement}
          >
            {packed}
          </BoardGroupSection>
        );
      })}
    </div>
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
          className="max-w-40"
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
      card.content.kind,
      card.id,
      collapsed,
      dragControls,
      groups,
      index,
      label,
      onAssignGroup,
      onMove,
      onToggleCollapsed,
      onTogglePinned,
      pinned,
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
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      className={`relative ${isDragging ? "z-40 cursor-grabbing" : ""}`}
      style={isArranging ? { touchAction: "none" } : undefined}
    >
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
  onToggle?: (groupId: string) => void;
  onDissolve?: (groupId: string) => void;
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
  onToggle,
  onDissolve,
  registerElement,
  children,
}: BoardGroupSectionProps) {
  const dragControls = useDragControls();
  const element = useRef<HTMLElement | null>(null);

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

          {onRename && isArranging ? (
            <Input
              size="sm"
              value={group.name}
              onChange={(event) => onRename(group.id, event.target.value)}
              aria-label={`Name of the ${group.name} area`}
              className="max-w-56"
            />
          ) : (
            <h2 className="truncate text-sm font-semibold text-app-brand-text">{group.name}</h2>
          )}

          <span className="shrink-0 text-xs text-app-text-subtle tabular-nums">
            {group.cardIds.length}
          </span>
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
