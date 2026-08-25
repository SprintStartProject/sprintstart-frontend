import { createContext, useContext, type ReactNode } from "react";
import { cardAccent, type CardAccent } from "../layout/cardAccents";

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
   * The group picker for this card, shown in the header while the board is being arranged.
   *
   * Only offered in arrange mode: putting a card in a named area is a rearrangement, and a select
   * on every card the rest of the time is a control nobody asked for.
   */
  groupPicker?: ReactNode;
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
