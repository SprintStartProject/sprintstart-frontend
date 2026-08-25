import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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

/** Where a dragged card counts as being: its own middle, which is what the eye is following. */
function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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
  /** Arrange mode: cards can be dragged, and their content stops taking clicks. */
  isArranging?: boolean;
  collapsedIds?: Set<string>;
  onToggleCollapsed?: (cardId: string) => void;
};

type SharedProps = {
  card: BoardCard;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (cardId: string) => void;
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
}: BoardGridProps) {
  const twoColumns = useMediaQuery(TWO_COLUMN_QUERY);
  const elements = useRef(new Map<string, HTMLDivElement>());
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
  const rows = useMemo(() => {
    const columns = twoColumns ? 2 : 1;
    const weightOf = (card: BoardCard) => cardWeight(card, collapsedIds?.has(card.id) ?? false);

    const built: { key: string; columns: BoardCard[][] }[] = [];
    let run: BoardCard[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      built.push({ key: `run-${run[0].id}`, columns: packIntoColumns(run, columns, weightOf) });
      run = [];
    };

    for (const card of board.cards) {
      if (spansFullWidth(card)) {
        flushRun();
        built.push({ key: `full-${card.id}`, columns: [[card]] });
      } else {
        run.push(card);
      }
    }
    flushRun();

    return built;
  }, [board.cards, collapsedIds, twoColumns]);

  const renderCard = (card: BoardCard) => {
    const index = ids.indexOf(card.id);
    const isWiggling =
      isArranging && !reduceMotion && hoveredId !== card.id && draggingId !== card.id;

    return (
      <motion.div
        key={card.id}
        ref={(element) => registerElement(card.id, element)}
        layout="position"
        transition={centralSpringToken}
        drag={isArranging && onReorder !== undefined}
        dragSnapToOrigin
        // No elasticity: the card should sit under the pointer, not lag behind it on a spring.
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => {
          lastMoveAt.current = 0;
          setDraggingId(card.id);
        }}
        onDrag={() => handleDrag(card.id)}
        onDragEnd={() => setDraggingId(null)}
        onPointerEnter={() => setHoveredId(card.id)}
        onPointerLeave={() => setHoveredId((current) => (current === card.id ? null : current))}
        className={`relative ${draggingId === card.id ? "z-40 cursor-grabbing" : ""} ${
          isArranging ? "cursor-grab" : ""
        }`}
        style={isArranging ? { touchAction: "none" } : undefined}
      >
        {/* Two nested motion elements, deliberately — the same split the dashboard needs. The
            outer one does `layout` and `drag`, and Framer measures it; this inner one carries the
            wiggle's rotation, which changes an element's measured box and would poison a layout
            projection measured against it. */}
        <motion.div
          animate={isWiggling ? WIGGLE : { rotate: 0 }}
          transition={
            isWiggling
              ? { duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: (index % 5) * 0.08 }
              : centralSpringToken
          }
        >
          <BoardCardView
            card={card}
            onDismiss={onDismiss}
            dismissing={dismissingId === card.id}
            onEdit={onEdit}
            onMove={move}
            canMoveUp={index > 0}
            canMoveDown={index < ids.length - 1}
            collapsed={collapsedIds?.has(card.id) ?? false}
            onToggleCollapsed={onToggleCollapsed}
          />
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4" data-arranging={isArranging || undefined}>
      {rows.map((row) => (
        <div
          key={row.key}
          className={row.columns.length > 1 ? "grid gap-4 lg:grid-cols-2" : undefined}
        >
          {row.columns.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-4">
              {column.map(renderCard)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
