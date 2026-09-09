import { createContext, useContext, type ReactNode } from "react";
import { cardAccent, type CardAccent } from "../layout/cardAccents";
import type { CardSize } from "../layout/cardSizes";
import type { CardState } from "../layout/boardStructure";

/**
 * What the board offers for one card, handed to its frame by the grid.
 *
 * A context rather than props threaded through every card kind: folding, pinning and the drag
 * handle are facts about the *board*, not about what a checklist or a diagram holds, and eleven
 * card components should not have to forward four props each to say so. Each cell provides its own
 * value, so the frame reads only ever its own card's controls.
 */
export type BoardCardControls = {
  collapsed: boolean;
  pinned: boolean;
  /** The card kind's colour accent, so the frame does not have to be told the kind twice. */
  accent: CardAccent;
  /** Absent on a board that cannot be changed — a read-only board shows no fold or pin. */
  onToggleCollapsed?: () => void;
  onTogglePinned?: () => void;
  /** The grip, already wired to this cell's drag. Absent when the board is not arrangeable. */
  dragHandle?: ReactNode;
  /**
   * The corner the card is pulled by to change its size. Absent while the board is being arranged,
   * where every drag already means something else.
   */
  resizeHandle?: ReactNode;
  /** The size this card was pulled to, so the card can show more of itself when there is room. */
  size?: CardSize;
  /**
   * Where this card sits in the process, and what that makes it.
   *
   * Absent on a board with no process layer — a card rendered on its own, or a board shown
   * read-only — so the frame says nothing about sequence rather than claiming everything is open.
   */
  state?: CardState;
  /**
   * Ticks a card off, for the kinds whose completion nothing can observe.
   *
   * Absent for a checklist or an arrival card: those report their own progress, and a hand-set
   * "done" beside a list with three items outstanding is the board contradicting itself.
   */
  onToggleDone?: () => void;
  /** The stage picker for this card, shown while the board is being arranged. */
  stagePicker?: ReactNode;
  /** The "waits on…" picker for this card, shown while the board is being arranged. */
  dependencyPicker?: ReactNode;
  /**
   * This card's place in a stack of cards that have to be worked in order.
   *
   * Set on exactly one card: the one standing in for the rest while the pile is *closed*. An open
   * pile is drawn by its own frame, which carries the way back — and repeating "3 of 5" on every
   * card of a spread-out run would be the board narrating itself.
   */
  stack?: {
    /** Which of the chain this is, and how many there are. Counted from one, for a person. */
    position: number;
    total: number;
    /** How many are still to do, this one included. */
    remaining: number;
    onToggle: () => void;
  };
};

const EMPTY: BoardCardControls = {
  collapsed: false,
  pinned: false,
  accent: cardAccent("NOTE"),
};

export const BoardCardContext = createContext<BoardCardControls>(EMPTY);

/**
 * This card's board controls.
 *
 * Falls back to "nothing offered" outside a grid, so a card rendered on its own — in a test, in
 * Storybook — is a plain card rather than a crash.
 */
export function useBoardCardControls(): BoardCardControls {
  return useContext(BoardCardContext);
}
