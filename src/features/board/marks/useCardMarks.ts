import { useContext, useEffect } from "react";

import {
  CardMarksContext,
  type CardMarksContextType,
  type MarkableBoard,
} from "./CardMarksContext";

/** Nothing to mark, and nowhere to put a mark. What a surface outside the provider gets. */
const INERT: CardMarksContextType = {
  canMark: false,
  marksFor: () => [],
  colorAt: () => null,
  enclosingColorAt: () => null,
  mark: () => {},
  unmark: () => {},
  hasAnyMarks: false,
  marks: {},
  labels: {},
  nameColor: () => {},
  setBoard: () => {},
};

/**
 * Read and set the hire's highlights.
 *
 * Returns an inert context outside the provider rather than throwing, the way `useFocusMode` does:
 * the selection toolbar is mounted on every page and asks this on every selection, and a card
 * rendered alone in a test should draw its text, not crash on it.
 */
export function useCardMarks(): CardMarksContextType {
  return useContext(CardMarksContext) ?? INERT;
}

/**
 * Lends the app shell the cards this page is showing, so text on them can be highlighted.
 *
 * Two effects rather than one, and the split is the whole trick. The first has no dependency array
 * and runs after every render, which keeps the handed-over cards current without anybody having to
 * get a memo exactly right — the write is to a ref, so it costs nothing and re-renders nothing. The
 * second exists only for its cleanup, and takes the board back when the page leaves.
 *
 * Registering and unregistering in the *same* effect would do both on every render: the cleanup
 * would clear the board a moment before the next run restored it, and `canMark` would flicker with
 * it — which the toolbar reads while it is deciding what to offer.
 */
export function useMarkableBoard(board: MarkableBoard): void {
  const { setBoard } = useCardMarks();

  useEffect(() => {
    setBoard(board);
  });

  useEffect(() => () => setBoard(null), [setBoard]);
}
