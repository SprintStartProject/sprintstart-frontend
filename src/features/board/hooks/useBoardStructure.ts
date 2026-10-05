import { useEffect, useMemo, useState } from "react";
import type { BoardCard } from "../types";
import { subscribeToBoardStorageReplaced } from "../layout/boardStorage";
import {
  deriveCardStates,
  EMPTY_STRUCTURE,
  pruneStructure,
  readBoardStructure,
  restack,
  writeBoardStructure,
  type BoardStage,
  type BoardStructure,
  type CardState,
} from "../layout/boardStructure";

export type UseBoardStructureResult = {
  structure: BoardStructure;
  /** Every card's derived status, keyed by id. Recomputed whenever the board or the structure moves. */
  states: Map<string, CardState>;
  /** Puts a card on another card's pile, or (with null) takes it off its own — see `restack`. */
  stackOnto: (cardId: string, targetId: string | null, carry?: readonly string[]) => void;
};

/**
 * The board's process layer: which stage each card is in, what it waits on, and what that makes it.
 *
 * Read once per board and written on every change, the way the folded and pinned sets are. It is no
 * longer only local: `sync/useBoardStructureSync.ts` carries it to the server and brings it back,
 * and the re-read below is how an arrangement that arrived that way reaches the screen.
 *
 * The read is derived during render rather than in an effect, matching `BoardPage`'s handling of
 * the other local layers: the structure has to be right on the render that first shows the board,
 * and reading a key back out of storage is an idempotent read with nothing to synchronise.
 *
 * Everything a caller renders from comes out of `states`, never out of `structure`. That is what
 * keeps "blocked" from going stale: it is a question about other cards, answered fresh on every
 * board, and never a flag anybody has to remember to clear.
 *
 * Which stage a card is in is not part of what is kept here any more: it comes from the onboarding
 * path, as `stageOf` (see `layout/pathStages.ts`), so there is nothing for the hire to set.
 */
export function useBoardStructure(
  boardId: string,
  cards: BoardCard[],
  stageOf?: (card: BoardCard) => BoardStage,
): UseBoardStructureResult {
  const [structure, setStructure] = useState<BoardStructure>(EMPTY_STRUCTURE);
  const [readFor, setReadFor] = useState<string | null>(null);

  if (boardId !== readFor) {
    setReadFor(boardId);
    setStructure(readBoardStructure(boardId));
  }

  // And again when the stored arrangement is replaced under us — the sync pulling this hire's
  // board down on arrival is the case that matters. Only *replaced*, never on an ordinary write:
  // re-reading after every write of our own would re-seat the state we just set.
  useEffect(
    () => subscribeToBoardStorageReplaced(() => setStructure(readBoardStructure(boardId))),
    [boardId],
  );

  const states = useMemo(
    () => deriveCardStates(cards, structure, stageOf),
    [cards, structure, stageOf],
  );

  /**
   * Stores a new structure, forgetting whatever it says about cards that are no longer here.
   *
   * Pruned on every write rather than on load: a card dismissed in this session should stop
   * blocking things immediately, and storage should not accumulate rows for cards long gone.
   *
   * Plain functions rather than `useCallback`: this project compiles with the React Compiler, which
   * memoizes them itself and rejects hand-written dependency lists it cannot verify.
   */
  function save(next: BoardStructure) {
    const known = new Set(cards.map((card) => card.id));
    const pruned = pruneStructure(next, known);
    setStructure(pruned);
    writeBoardStructure(boardId, pruned);
  }

  return {
    structure,
    states,
    stackOnto: (cardId, targetId, carry) =>
      save(
        restack(
          structure,
          cards.map((card) => card.id),
          cardId,
          targetId,
          carry,
        ),
      ),
  };
}
