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
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { ChevronsDownUp, ChevronsUpDown, GripVertical, Layers, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Collapsible } from "../../../components/ui/Collapsible";
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
import { BoardStageBand } from "./BoardStageBand";
import { cardAccent } from "../layout/cardAccents";
import { AREA_ACCENTS, areaAccent, type AreaAccent } from "../layout/areaAccents";
import type { BoardDensity } from "../layout/boardPreferences";
import { groupOf, type BoardGroup } from "../layout/boardGroups";
import { cardIcon } from "../layout/cardIcons";
import { cardName } from "../layout/cardNames";
import type { CardStack } from "../layout/cardStacks";
import {
  BOARD_STAGES,
  isSelfReporting,
  STAGE_LABELS,
  type BoardStage,
  type CardState,
} from "../layout/boardStructure";
import { spansFullWidth } from "../layout/cardWidths";
import {
  GRID_COLUMNS,
  sizeFromDrag,
  sizeOf,
  WIDTH_SPAN,
  type CardSize,
  type CardSizes,
} from "../layout/cardSizes";
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

/**
 * The rest of the pile, showing under the card that is standing in for it.
 *
 * Real card edges rather than a hint of one: the same surface, border and shadow an actual card
 * wears, inset and pushed down so what you see below the top card is unmistakably *another card*.
 *
 * **Hovering fans them out and names them.** That is the moment somebody is deciding whether there
 * is anything under this card, and "there are two more" is a worse answer than "next is *Set up
 * your machine*, then *Read the runbook*". So the fan is not decoration: each sheet slides and
 * swings far enough to show a strip carrying that card's own glyph and title, and the strip is a
 * button that opens the pile at that card. A pile that only ever admitted to a count made you open
 * it to find out whether it was worth opening.
 *
 * They rotate about their top edge, so the swing happens at the bottom where it is visible and the
 * hidden top stays hidden behind the card — a hand of cards being fanned, which is the picture
 * everybody already has for "there are more of these".
 *
 * **Both turn the same way, each a little further than the one above it**, so the pile splays open
 * to the left and the deepest sheet is the one lying lowest. Opposite angles made the two sheets
 * lean away from each other, which is a splay rather than a fan: nothing about it says which of
 * them is further down the run. Turning them the same way makes the depth the thing the shape is
 * about — and it puts the low corner on the same side as the strips' own text, which starts at the
 * left. The angles stay small because those strips carry words: past about five degrees a fan stops
 * reading as a fan and starts reading as text that did not line up.
 *
 * **The tones step back with the sheets.** The nearest sheet takes the brand fill and the strong
 * border the card itself takes on hover; the one behind it takes a lighter wash of the same colour.
 * Depth is the thing being drawn, and two sheets highlighted identically read as one wide sheet.
 * Pointing at a particular strip promotes *that* one to the strong tone, so the fan answers the
 * pointer the way a list of rows does — whichever card you are about to open is the lit one.
 */
const STACK_SHEETS = [
  {
    /**
     * The next card: its strip sits directly under the top card, and it is the one the pile is
     * about, so it takes the same strong tone the card itself takes.
     *
     * `peer-hover/deep` is the other half of the trade. The deeper sheet is drawn first and is
     * therefore this one's *earlier* sibling, so it can say "somebody is pointing at me" — and
     * when they are, this one steps back to the light tone. Whichever strip is under the pointer
     * is the lit one, in both directions.
     */
    box: "inset-x-3 top-2 -bottom-2 motion-safe:group-hover/stack:-bottom-6 motion-safe:group-hover/stack:-rotate-[1.2deg]",
    tone: "group-hover/stack:border-app-brand-border-strong group-hover/stack:bg-app-brand-soft peer-hover/deep:border-app-brand-border peer-hover/deep:bg-app-brand-soft/50",
  },
  {
    /** The one after it: half a step further out, further down, and turned further the same way. */
    box: "peer/deep inset-x-6 top-4 -bottom-3 motion-safe:group-hover/stack:-bottom-12 motion-safe:group-hover/stack:-rotate-[2.5deg]",
    tone: "group-hover/stack:border-app-brand-border group-hover/stack:bg-app-brand-soft/50",
  },
];

/**
 * The room a fanned pile takes under it, by how many sheets it has.
 *
 * Real space rather than an overlap. The first cut let the deeper sheet lie over whatever was below
 * it on the theory that a hover is momentary — which was wrong twice over. It looked like the pile
 * was lying on the next card, and it could not even do that cleanly: every block in a column
 * carries its own opacity and transform for the entrance animation, so each is its own stacking
 * context and they paint in document order. A `z-index` on a sheet cannot lift it above the *next*
 * card however high it is set; the fan went *under* the card below and came out as torn edges.
 *
 * **But it is only taken while the fan is out.** Holding 56px of empty page under every pile for a
 * strip nobody is looking at is a tax on the whole board for a moment that lasts as long as a
 * pointer rests. So the margin grows on hover instead, on the same curve and over the same 300ms
 * as the sheets themselves: the cards below drift down a little, the fan opens into the space they
 * left, and both go back when the pointer leaves. The board answering the gesture *is* the effect
 * — a pile that pushes its neighbours aside to be read looks like something being lifted out of a
 * stack, which is what it is.
 *
 * At rest a little is still claimed. The column's own 16px gap technically *covers* the 8 and 12
 * pixels the resting sheets show, but covering is not the same as looking right: a pile whose
 * bottom edge stops four pixels short of the next card reads as two cards that have been pushed
 * into each other, not as one card with something behind it. So a resting pile keeps a few pixels
 * of its own — enough that the edges under it are edges rather than a collision. Only piles that
 * have that many sheets take the room, and an ordinary card takes none.
 *
 * **The numbers are the sheet's depth plus what turning it costs**, and the second part is bigger
 * than it looks. A sheet rotates about its top edge, so its low corner drops by half the card's
 * width times the sine of the angle — a few pixels on a card in a two-column layout, twice that on
 * the same card at full width on a phone. The deepest sheet sits 48px out and can be another 13
 * below that, and its shadow is drawn below *that* again. So the room is the depth rounded
 * generously up rather than the depth exactly: measured to the pixel it is right on the layout it
 * was measured on and a hair short everywhere else, which is what "it still overlaps a little"
 * looks like.
 *
 * It also has to *beat* the gaps around it rather than match them. This margin does not add to the
 * space below the card, it collapses with it — a 64px fan margin under a 40px band gap leaves 64px
 * in total, not 104. Set close to the fan's real reach, the two numbers cancel out to almost
 * nothing and the last pile in a band still touches the heading below it. So the room is set well
 * clear of anything it might collapse against.
 */
const FAN_ROOM = ["", "mb-4 motion-safe:hover:mb-12", "mb-6 motion-safe:hover:mb-20"];

/**
 * What pointing straight at a strip does, whichever depth it is drawn at.
 *
 * Marked important on purpose. This has to beat both the group's tone and the peer's step-back,
 * and which of three same-specificity variants wins would otherwise come down to the order Tailwind
 * happens to emit them in — a rule that is right today and silently inverts on an upgrade.
 */
const SHEET_HOVERED = "hover:border-app-brand-border-strong! hover:bg-app-brand-soft!";

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

/**
 * The board's grid, in pixels.
 *
 * `ROW_UNIT` is deliberately tiny: a card is given as many of these rows as it measures, so the
 * unit is the resolution of the layout rather than a row height anybody sees. Small enough that a
 * card is never rounded up by more than a few pixels, large enough that the browser is not laying
 * out a thousand tracks.
 */
const ROW_UNIT = 8;

/** The gap between cards, per density. In JS because the row maths has to use the same number. */
const GRID_GAP = { cozy: 16, compact: 10 } as const;

/** One stage of the board, with everything filed under it. */
type Band = { stage: BoardStage; blocks: Block[]; total: number; remaining: number };

type GridBlockProps = {
  /** How many of the grid's columns this block takes. */
  span: number;
  /** The grid's gap, which the row maths has to agree with. */
  gap: number;
  /** Whether the reader asked for less motion, which the arrival and exit honour. */
  reduceMotion: boolean;
  children: ReactNode;
};

/**
 * One block in the board's grid: as wide as it was told, and as tall as it turns out to be.
 *
 * **Measured, not estimated.** The board used to guess every card's height from its content and deal
 * the blocks into two balanced columns — good enough while the only question was which column a
 * card starts in, and useless the moment a card can be one column, two, or four: a grid places
 * things in rows, and a row is only as honest as the height it was given. So the block asks the
 * browser how tall it actually is and claims that many of the grid's small rows. A wrong answer
 * here is not a slightly uneven column any more, it is cards overlapping.
 *
 * The `ResizeObserver` is what keeps it right afterwards: a checklist that is ticked, a card that
 * is folded, a band that opens — all of them change a height without changing anything this
 * component is passed, and all of them would otherwise leave the grid holding the old number.
 */
function GridBlock({ span, gap, reduceMotion, children }: GridBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No first measurement of our own: `ResizeObserver` reports the initial size as soon as it
    // observes, so calling it here as well would be a second render for the same number.
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height;
      setRows(Math.max(1, Math.ceil((height + gap) / (ROW_UNIT + gap))));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [gap]);

  return (
    // The animation lives here rather than one level in, because `AnimatePresence` can only hold a
    // block back long enough to fade it if the block it is holding is a motion element.
    <motion.div
      style={{ gridColumn: `span ${span}`, gridRow: `span ${rows}` }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      // Quick and its own transition: a leaving block is out of the flow already, and a
      // spring-length exit would leave it fading over whatever moved into its place.
      exit={{
        opacity: 0,
        ...(reduceMotion ? {} : { scale: 0.97 }),
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={centralSpringToken}
    >
      {/* Deliberately not stretched to the grid row: a measurement that read back the height the
          grid gave it would be measuring its own answer. */}
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

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
  /** Paints an area. Absent on a board that cannot be changed. */
  onRecolourGroup?: (groupId: string, accent: AreaAccent) => void;
  /**
   * How much room the board gives each card.
   *
   * Applied as a `data-density` attribute on the grid's root rather than threaded through every
   * card: the cards that respond to it are ten components deep and belong to eleven different
   * files, and the two places it actually changes anything — a card's padding and the gaps between
   * them — are better read as two rules next to the values they override than as a prop that
   * arrives everywhere and is used twice. Same mechanism as `data-arranging`.
   */
  density?: BoardDensity;
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
  onRecolourGroup,
  density,
  states,
  onAssignStage,
  onAssignGroupStage,
  onToggleDone,
  onSetPredecessor,
  stacks,
  expandedStackIds,
  onToggleStack,
  openStages,
  onToggleStage,
  cardSizes,
  onResizeCard,
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
  const gap = GRID_GAP[density ?? "cozy"];
  const elements = useRef(new Map<string, HTMLDivElement>());
  const groupElements = useRef(new Map<string, HTMLElement>());
  const lastMoveAt = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /**
   * A card the pile was opened *for*, to be brought into view once it is on the board.
   *
   * A ref rather than state: nothing renders from it, and setting state to schedule a scroll would
   * be a second render for something the DOM answers on its own.
   */
  const revealId = useRef<string | null>(null);
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
   * How wide a block is, in columns of the board's grid.
   *
   * The card's own size, clamped to what the grid it sits in actually has: a card pulled wide
   * inside an area two columns across is two columns across, not four sticking out of its own
   * container. A diagram is wide whatever anybody chose, because half of a half-width picture is
   * not a picture.
   *
   * An area is as wide as the widest thing in it, and never narrower than two — an area of one
   * narrow note would otherwise be a tinted box the size of a stamp with a name in it.
   */
  const spanOf = useCallback(
    (block: Block, columns: number): number => {
      const widest = block.cards.reduce(
        (span, card) =>
          Math.max(
            span,
            spansFullWidth(card) ? GRID_COLUMNS : WIDTH_SPAN[sizeOf(cardSizes, card.id).width],
          ),
        1,
      );
      const wanted = block.kind === "group" ? Math.max(widest, 2) : widest;

      return Math.min(wanted, columns);
    },
    [cardSizes],
  );

  /**
   * The board's blocks filed under their stage, in stage order.
   *
   * **An area goes in the band of its earliest card**, whole, rather than being split across three.
   * Two grouping axes have to agree about which one owns a block, and an area is a thing somebody
   * named and expects to find in one piece — the same rule the section bar already uses for an
   * area's stage, so the two never disagree.
   *
   * Empty bands are not drawn. A board where nothing is due later should not carry a heading saying
   * so; the fold exists to hold cards, and a band with none holds a sentence nobody needs.
   */
  const banding = states !== undefined && openStages !== undefined && !isArranging;

  /** Which stages a set of cards covers, earliest first. */
  const stagesOf = useCallback(
    (cards: BoardCard[]): BoardStage[] =>
      BOARD_STAGES.filter((stage) =>
        cards.some((card) => (states?.get(card.id)?.stage ?? "NOW") === stage),
      ),
    [states],
  );

  /**
   * The areas that carry stages of their own: a named set of cards that is not all due at once.
   *
   * These are not filed into a band, they are banded *inside*. A team's blueprints are the case
   * this exists for — one set somebody wrote in one sitting, deliberately spread across the
   * stages. Filing it under "Now" because its earliest card is due now would put a heading saying
   * "Now" around cards marked Later, and splitting it across the bands would take a thing with a
   * name and scatter it. So it keeps its name, keeps its cards, and folds by stage within itself —
   * the same fold, one level in.
   *
   * They lead, above the bands. An area is a decision somebody made about what belongs together,
   * and the bands are the board's own answer to when; the named thing goes first.
   */
  const spanningGroups = useMemo<Block[]>(() => {
    if (!banding) return [];

    return blocks.filter((block) => block.kind === "group" && stagesOf(block.cards).length > 1);
  }, [banding, blocks, stagesOf]);

  const bands = useMemo<Band[]>(() => {
    if (!states || !banding) return [];

    const stageOf = (block: Block): BoardStage => stagesOf(block.cards)[0] ?? "NOW";
    const rest = blocks.filter((block) => !spanningGroups.includes(block));

    const filled = BOARD_STAGES.map((stage) => {
      const own = rest.filter((block) => stageOf(block) === stage);
      const cards = own.flatMap((block) => block.cards);

      return {
        stage,
        blocks: own,
        total: cards.length,
        remaining: cards.filter((card) => states.get(card.id)?.status !== "DONE").length,
      };
    }).filter((band) => band.total > 0);

    // One band is not a band, it is a heading over the whole board saying what everything on it
    // already says. A board where nothing has been sequenced yet is exactly that board, and it
    // should look the way it did before there were bands at all.
    return filled.length > 1 ? filled : [];
  }, [banding, blocks, spanningGroups, stagesOf, states]);

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

  /**
   * Opens a pile because somebody clicked one of the cards behind the top one, and takes them to it.
   *
   * Opening alone would be technically right and quietly wrong: a run of five unfolds into five
   * cards, and the one they actually asked about is somewhere in the middle of them. The scroll is
   * what makes clicking a named strip feel like following a link rather than like pressing "expand".
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
        onRevealMember={
          stack && onToggleStack ? (memberId) => revealMember(stack.rootId, memberId) : undefined
        }
        size={sizeOf(cardSizes, card.id)}
        onResize={onResizeCard ? (next) => onResizeCard(card.id, next) : undefined}
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

  /** An area's items, folded by stage — the same fold as the board's own, one level in. */
  const renderBandedItems = (items: Item[], span: number) => (
    <div className="space-y-3">
      {BOARD_STAGES.map((stage) => {
        const own = items.filter((item) => stagesOf(item.cards)[0] === stage);
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

  const renderBlock = (block: Block, blockIndex: number, span: number) => {
    if (block.kind !== "group") return renderItem(block);

    if (spanningGroups.includes(block)) {
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
    // each other" comes down to: an area two columns wide is two columns inside, so filing a card
    // into an area no longer means dropping it into a single-file queue.
    const inner = renderBlocks(block.items, span);

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
        onRecolour={onRecolourGroup}
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
    // `space-y-12` between the bands, against `space-y-4` between the cards inside one. A heading is
    // only a heading if the gap above it is clearly wider than the gaps it presides over — at the
    // same 24px as everything else, "Later" read as one more thing in the list above rather than as
    // the start of the next one. It is also the room a fanned pile in the last row needs, so the
    // sheets of a card at the bottom of "Now" do not reach into the heading under it.
    <div
      className="space-y-12"
      data-arranging={isArranging || undefined}
      data-density={density ?? undefined}
    >
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
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      // `layout` so the frame grows and shrinks with what is in it rather than jumping to its
      // final height. Safe here in a way it is not around a card: nothing inside this is a drag
      // target, so there is no hit-test being measured mid-animation.
      layout
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        ...(reduceMotion ? {} : { scale: 0.98 }),
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={centralSpringToken}
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
      {/* The cards arrive one after another rather than all at once. Four appearing on the same
          frame is a pop; the same four arriving down the list is a pile being dealt out, which is
          what just happened. 45ms apart — enough to read as a sequence, short enough that the last
          one is not still on its way when the eye gets there. */}
      <ol className="space-y-4">
        {Children.map(children, (child, index) => (
          <motion.li
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...centralSpringToken, delay: reduceMotion ? 0 : index * 0.045 }}
            className="flex min-w-0 items-start gap-2"
          >
            <span className="mt-4 w-4 shrink-0 text-right text-xs text-app-text-subtle tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{child}</div>
          </motion.li>
        ))}
      </ol>
    </motion.section>
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
  onRevealMember,
  size,
  onResize,
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
  /**
   * Folds a card, or opens a folded one, on a double click anywhere on it.
   *
   * The fold button is a four-pixel target that only appears on hover, at the far end of a cluster
   * of four — which is fine as the deliberate control and hopeless as the one you reach for while
   * skim-reading a board. A double click is the gesture people already try on anything folded, and
   * it costs nothing to answer: a single click on a card still does what it did.
   *
   * Same three exclusions as the pile below, and one more — a card standing in for a closed stack
   * is already answering clicks by opening the pile, and a card that both unfolds itself and opens
   * a sequence gets one of the two wrong.
   *
   * The selection a double click leaves behind is cleared: the gesture was aimed at the card, and
   * a highlighted word left over from it reads as the card having been mis-clicked.
   */
  function handleDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isArranging || stack || !onToggleCollapsed) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;

    window.getSelection()?.removeAllRanges();
    onToggleCollapsed(card.id);
  }

  /**
   * The cards behind this one, nearest first — the ones the fanned sheets name.
   *
   * Everything after the card standing on top, which is by construction what is still to do in the
   * run. Two at most, because there are two sheets: a third strip would be a card the eye has to
   * work to read on a pile that is already asking for a click.
   */
  /** Where a resize drag started, and from which size. Null when nothing is being dragged. */
  const resizeStart = useRef<{ x: number; y: number; size: CardSize } | null>(null);

  const behind = useMemo(() => {
    if (!stack) return [];

    const top = stack.memberIds.indexOf(stack.topId);

    // Named from the stack, not from the board: these cards are folded away, so they are not in
    // the list this grid was handed.
    return stack.memberIds
      .slice(top + 1)
      .slice(0, STACK_SHEETS.length)
      .map((memberId) => {
        const member = stack.members.get(memberId);

        return {
          id: memberId,
          name: member?.name ?? "The next card",
          Icon: cardIcon(member?.kind ?? "NOTE"),
        };
      });
  }, [stack]);

  function handleStackClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!stack || isArranging || !onToggleStack) return;
    // The second click of a double click, which would otherwise open the pile and shut it again.
    if (event.detail > 1) return;
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
      size,
      resizeHandle:
        onResize && !isArranging ? (
          <button
            type="button"
            // Pointer capture, so a drag that leaves the little handle — which it does immediately —
            // keeps being this handle's drag rather than the page's.
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              resizeStart.current = { x: event.clientX, y: event.clientY, size };
            }}
            onPointerMove={(event) => {
              const from = resizeStart.current;
              if (!from) return;

              const next = sizeFromDrag(from.size, event.clientX - from.x);
              if (next.width !== size.width) onResize(next);
            }}
            onPointerUp={() => (resizeStart.current = null)}
            onPointerCancel={() => (resizeStart.current = null)}
            // The keyboard steps the same ramp rather than simulating a drag: a gesture nobody can
            // perform is not an affordance, it is a picture of one.
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (step === 0) return;
              event.preventDefault();
              onResize(sizeFromDrag(size, step * 60));
            }}
            title="Drag sideways to make this card narrower or wider, or use the arrow keys"
            aria-label={`Resize the ${label} card — drag sideways, or use the arrow keys`}
            className="absolute right-1 bottom-1 z-20 hidden h-5 w-5 cursor-ew-resize items-center justify-center rounded text-app-text-subtle opacity-0 transition-opacity duration-150 group-hover/stack:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none lg:flex"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[2px] border-r-2 border-b-2 border-current"
            />
          </button>
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
      isArranging,
      onResize,
      onToggleCollapsed,
      onToggleDone,
      onTogglePinned,
      size,
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
      onDoubleClick={handleDoubleClick}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      className={`group/stack relative ${
        stack
          ? `cursor-pointer transition-[margin-bottom] duration-300 ease-out ${FAN_ROOM[behind.length]}`
          : ""
      } ${isDragging ? "z-40 cursor-grabbing" : ""}`}
      // The floor for a tall card lives on the grid block that measures it, not here — see
      // `GridBlock`. Two floors would be one too many, and this one is inside the measurement.
      style={isArranging ? { touchAction: "none" } : undefined}
    >
      {/* Deepest first, so the nearer sheet paints over it and the two strips stack rather than
          overlap. Only what is still to do is drawn: three of five ticked off leaves one card
          behind this one, and drawing two would be the board overstating what is left.

          Hidden from screen readers and out of the tab order on purpose. This is the pointer
          shortcut; the chip in the card's header is the control — it says "Step 2 of 5", carries
          `aria-expanded`, and opening the pile puts every one of these cards on the board in full,
          so nothing here is the only way to reach anything. */}
      {behind
        .map((member, depth) => ({ member, depth }))
        .reverse()
        .map(({ member, depth }) => (
          <button
            type="button"
            key={member.id}
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onRevealMember?.(member.id)}
            className={`pointer-events-none absolute flex origin-top items-end overflow-hidden rounded-2xl border border-app-border bg-app-surface pb-1 text-left shadow-sm transition-all duration-300 ease-out group-hover/stack:pointer-events-auto group-hover/stack:shadow-lg ${STACK_SHEETS[depth].tone} ${STACK_SHEETS[depth].box} ${SHEET_HOVERED}`}
          >
            {/* Faded in rather than always there: at rest the strip is a few pixels of card edge,
                and a title clipped to three of its letters is worse than no title. */}
            <span className="flex w-full min-w-0 items-center gap-1.5 px-4 text-xs font-medium text-app-text-muted opacity-0 transition-opacity duration-200 group-hover/stack:text-app-brand-text group-hover/stack:opacity-100">
              <member.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{member.name}</span>
            </span>
          </button>
        ))}

      {/* Two nested motion elements, deliberately — the same split the dashboard needs. The outer
          one does `layout` and `drag`, and Framer measures it; this inner one carries the wiggle's
          rotation, which changes an element's measured box and would poison a layout projection
          measured against it. */}
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
  /** Paints the area. Absent on a board that cannot be changed. */
  onRecolour?: (groupId: string, accent: AreaAccent) => void;
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
  onRecolour,
  stage,
  onAssignStage,
  registerElement,
  children,
}: BoardGroupSectionProps) {
  const accent = areaAccent(group.accent);
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
      // around white cards on a white page reads as a gap, not as a container. The tint is kept low
      // so a board of several areas is still a board and not a set of banners — which is also why
      // the hire picks from four quiet colours rather than from a colour wheel.
      className={`group/area rounded-2xl border p-3 shadow-sm ${accent.box}`}
    >
      <header
        className="mb-3 flex items-center justify-between gap-2"
        // The same gesture the cards answer to: double-click the bar and the area folds or opens.
        // Anything in the header that already does something on a click — the name, the grip, the
        // stage, the fold and dissolve buttons — keeps doing exactly that.
        onDoubleClick={(event) => {
          if (!onToggle) return;
          if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;

          window.getSelection()?.removeAllRanges();
          onToggle(group.id);
        }}
      >
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
            <h2 className={`min-w-0 truncate text-sm font-semibold ${accent.title}`}>
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
          {/* Four dots, revealed on approach like the controls on a card. Always-on swatches would
              put a paint set in the header of every area on the board, which is a lot of colour for
              a decision most people make once and never revisit. */}
          {onRecolour && (
            <span className="mr-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/area:opacity-100 group-hover/area:opacity-100 [[data-arranging]_&]:opacity-100">
              {AREA_ACCENTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRecolour(group.id, option)}
                  aria-pressed={(group.accent ?? "blue") === option}
                  title={`Paint the ${group.name} area ${areaAccent(option).label.toLowerCase()}`}
                  aria-label={`Paint the ${group.name} area ${areaAccent(option).label.toLowerCase()}`}
                  className={`h-3.5 w-3.5 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                    areaAccent(option).swatch
                  } ${
                    (group.accent ?? "blue") === option
                      ? "ring-2 ring-app-text/40 ring-offset-1 ring-offset-app-surface"
                      : "hover:scale-125"
                  }`}
                />
              ))}
            </span>
          )}

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

      <Collapsible open={!group.collapsed}>{children}</Collapsible>
    </motion.section>
  );
}
