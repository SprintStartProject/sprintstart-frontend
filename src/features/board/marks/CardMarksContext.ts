import { createContext } from "react";

import type { AuthoredCardRequest, BoardCard } from "../types";
import type { CardMark } from "./cardMarks";
import type { HighlightColor } from "./highlightColors";
import type { MarkLabels } from "./markLabels";

/**
 * The board, as far as the highlighter is concerned: some cards, and a way to rewrite one.
 *
 * Handed over by whichever page is showing cards rather than fetched again here — a highlight on a
 * note is an edit to that note, and it should go through the board's own edit path so that it gets
 * the same request, the same optimistic update and the same failure as fixing a typo does.
 */
export type MarkableBoard = {
  cards: BoardCard[];
  onEditCard?: (cardId: string, request: AuthoredCardRequest) => void;
};

/**
 * Whether anything on screen can be highlighted, and how.
 *
 * A context because the two halves of the gesture are mounted a long way apart. The selection
 * toolbar lives in the app shell, above the router, so that a selection anywhere is noticed; the
 * cards belong to one page under it. Neither can reach the other except through here.
 *
 * The shape is the same bargain `FocusMode` makes and for the same reason: a page says what it has,
 * and the shell decides what that means.
 */
export type CardMarksContextType = {
  /** True only while a page is showing cards. The toolbar offers nothing when it is false. */
  canMark: boolean;
  /** The marks stored beside one card. On a note these carry colour only — see `cardMarks.ts`. */
  marksFor: (cardId: string) => CardMark[];
  /**
   * The colour these exact words are painted on this card, or null when they are not marked.
   *
   * What lets the toolbar show which swatch is already on and offer to take it off. Asked of the
   * *selection*, so it answers "is this thing I have selected marked" rather than "does this card
   * have marks" — which are different questions and only the first one is actionable.
   */
  colorAt: (cardId: string, selected: string) => HighlightColor | null;
  /**
   * The colour of the highlight these words sit *inside*, or null when they sit outside every one.
   *
   * Distinct from {@link CardMarksContextType.colorAt}, which asks whether they are exactly a
   * highlight. This one is what the eraser needs: half a marked sentence is still somewhere an
   * eraser has work to do, and offering it only on an exact match would be offering it almost never.
   */
  enclosingColorAt: (cardId: string, selected: string) => HighlightColor | null;
  /**
   * Paints the selected words.
   *
   * Repaints when they are already exactly a highlight, and splits when they are part of a larger
   * one — marking three words out of a marked paragraph in another colour leaves the paragraph
   * marked either side of them.
   */
  mark: (cardId: string, selected: string, color: HighlightColor) => void;
  /** Takes the highlight off the selected words, keeping whatever was marked around them. */
  unmark: (cardId: string, selected: string) => void;
  /** Whether anything on this board is highlighted — what decides if a legend is worth drawing. */
  hasAnyMarks: boolean;
  /** What this hire calls each colour. See `markLabels.ts`. */
  labels: MarkLabels;
  /** Names a colour, or clears the name when given nothing. */
  nameColor: (color: HighlightColor, name: string) => void;
  /** How a page showing cards hands them over. Null on the way out. See {@link MarkableBoard}. */
  setBoard: (board: MarkableBoard | null) => void;
};

export const CardMarksContext = createContext<CardMarksContextType | undefined>(undefined);
