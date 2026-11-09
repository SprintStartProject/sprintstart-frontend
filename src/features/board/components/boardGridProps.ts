import type { AreaAccent } from "../layout/areaAccents";
import type { BoardGroup } from "../layout/boardGroups";
import type { BoardStage, CardState } from "../layout/boardStructure";
import type { CardOrigins } from "../layout/cardOrigins";
import type { CardSize, CardSizes } from "../layout/cardSizes";
import type { CardStack } from "../layout/cardStacks";
import type { AuthoredCardRequest, Board, BoardUndoNotice } from "../types";

export type BoardGridProps = {
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
const NO_GROUPS: BoardGroup[] = [];

/** The props with every default filled in, so nothing downstream has to ask whether one is there. */
export type ResolvedGridProps = BoardGridProps & {
  dismissingId: string | null;
  restoringIds: ReadonlySet<string>;
  savingIds: ReadonlySet<string>;
  undoNotices: ReadonlyMap<string, BoardUndoNotice>;
  isArranging: boolean;
  groups: BoardGroup[];
};

export function resolveGridProps(props: BoardGridProps): ResolvedGridProps {
  return {
    ...props,
    dismissingId: props.dismissingId ?? null,
    restoringIds: props.restoringIds ?? NO_IDS,
    savingIds: props.savingIds ?? NO_IDS,
    undoNotices: props.undoNotices ?? NO_NOTICES,
    isArranging: props.isArranging ?? false,
    groups: props.groups ?? NO_GROUPS,
  };
}
