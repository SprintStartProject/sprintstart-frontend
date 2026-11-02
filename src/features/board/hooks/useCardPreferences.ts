import { useCallback } from "react";
import { readCollapsedCards, writeCollapsedCards } from "../layout/collapsedCards";
import { isDefault, readCardSizes, writeCardSizes, type CardSize } from "../layout/cardSizes";
import { readPinnedCards, writePinnedCards } from "../layout/pinnedCards";
import { useStoredFor } from "./useStoredFor";

/** The set with this id put in if it was out, and out if it was in. */
function toggled(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * What the hire has done to individual cards -- folded them, pinned them, pulled them wider or
 * narrower -- kept per board in local storage, read once the board arrives and written on every
 * change. These are preferences, not board state: a board that will not load has nothing to fold.
 */
export function useCardPreferences(boardId: string, storedFor: string) {
  const [collapsedIds, setCollapsedIds] = useStoredFor(
    storedFor,
    () => readCollapsedCards(boardId),
    new Set<string>(),
  );
  const [pinnedIds, setPinnedIds] = useStoredFor(
    storedFor,
    () => readPinnedCards(boardId),
    new Set<string>(),
  );
  const [cardSizes, setCardSizes] = useStoredFor(storedFor, () => readCardSizes(boardId), {});

  const toggleCollapsed = useCallback(
    (cardId: string) => {
      setCollapsedIds((current) => {
        const next = toggled(current, cardId);
        writeCollapsedCards(boardId, next);
        return next;
      });
    },
    [boardId, setCollapsedIds],
  );

  const togglePinned = useCallback(
    (cardId: string) => {
      setPinnedIds((current) => {
        const next = toggled(current, cardId);
        writePinnedCards(boardId, next);
        return next;
      });
    },
    [boardId, setPinnedIds],
  );

  /**
   * Sets one card's size, and forgets the entry entirely when it is pulled back to the default.
   *
   * Storage should hold the decisions somebody made. A row per card saying "unchanged" is not a
   * decision, and it is what would slowly turn a preference into a copy of the board.
   */
  function resizeCard(cardId: string, size: CardSize) {
    setCardSizes((current) => {
      const next = { ...current };
      if (isDefault(size)) delete next[cardId];
      else next[cardId] = size;

      writeCardSizes(boardId, next);

      return next;
    });
  }

  return { collapsedIds, toggleCollapsed, pinnedIds, togglePinned, cardSizes, resizeCard };
}
