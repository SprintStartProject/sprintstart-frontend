import { useEffect, useMemo, useState } from "react";
import type { BoardCard } from "../types";
import { subscribeToBoardStorageReplaced } from "../layout/boardStorage";
import {
  clearHireDependencies,
  deriveCardStates,
  EMPTY_STRUCTURE,
  pruneStructure,
  readBoardStructure,
  setCardStage,
  setDependency,
  setGroupStage,
  setMarkedDone,
  writeBoardStructure,
  type BoardStage,
  type BoardStructure,
  type CardState,
  type DependencySource,
} from "../layout/boardStructure";

export type UseBoardStructureResult = {
  structure: BoardStructure;
  /** Every card's derived status, keyed by id. Recomputed whenever the board or the structure moves. */
  states: Map<string, CardState>;
  assignStage: (cardId: string, stage: BoardStage) => void;
  assignGroupStage: (groupId: string, cardIds: string[], stage: BoardStage) => void;
  toggleDone: (cardId: string, done: boolean) => void;
  toggleDependency: (cardId: string, blockerId: string, depends: boolean) => void;
  /**
   * Makes a card wait on exactly one other card, or on nothing.
   *
   * The model holds a set, because a blueprint can reasonably say "after both of these". The
   * *control* offers one, because a hire sequencing their own board is describing a chain — this
   * before that before the other — and a multi-select in a card header to express something almost
   * nobody needs is chrome charged to everybody. Setting one predecessor replaces whatever set was
   * there, so the two never drift into disagreeing.
   */
  setPredecessor: (cardId: string, blockerId: string | null) => void;
  /**
   * Applies a whole generated plan at once: every card's stage, and every link in every chain.
   *
   * One write rather than a call per card, and not for tidiness. Every other function here derives
   * the next structure from the one it closed over, so calling them in a loop would have each
   * iteration overwrite the last and leave only the final card sequenced — the kind of bug that
   * looks like "the generator only did the last phase" and is nothing of the sort.
   */
  applyPlan: (
    stages: Record<string, BoardStage>,
    chain: Record<string, { id: string; source: DependencySource }>,
  ) => void;
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
 */
export function useBoardStructure(boardId: string, cards: BoardCard[]): UseBoardStructureResult {
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

  const states = useMemo(() => deriveCardStates(cards, structure), [cards, structure]);

  /**
   * Stores a new structure, forgetting whatever it says about cards that are no longer here.
   *
   * Pruned on every write rather than on load: a card dismissed in this session should stop
   * blocking things immediately, and storage should not accumulate rows for cards long gone.
   *
   * `alsoKnown` is what keeps that from eating a freshly generated plan. Cards created a moment ago
   * are not in `cards` until the board is re-read, so pruning against `cards` alone would drop
   * every stage and every chain the generator just wrote — the whole plan, silently, between the
   * write and the reload.
   *
   * Plain functions rather than `useCallback`: this project compiles with the React Compiler, which
   * memoizes them itself and rejects hand-written dependency lists it cannot verify.
   */
  function save(next: BoardStructure, alsoKnown: readonly string[] = []) {
    const known = new Set([...cards.map((card) => card.id), ...alsoKnown]);
    const pruned = pruneStructure(next, known);
    setStructure(pruned);
    writeBoardStructure(boardId, pruned);
  }

  return {
    structure,
    states,
    assignStage: (cardId, stage) => save(setCardStage(structure, cardId, stage)),
    assignGroupStage: (groupId, cardIds, stage) =>
      save(setGroupStage(structure, groupId, cardIds, stage)),
    toggleDone: (cardId, done) => save(setMarkedDone(structure, cardId, done)),
    toggleDependency: (cardId, blockerId, depends) =>
      save(setDependency(structure, cardId, blockerId, depends)),
    setPredecessor: (cardId, blockerId) => {
      // Only the hire's own edges go: the control offers one predecessor at a time, so choosing
      // a new one drops the last one *they* set and leaves a rule the team wrote where it is.
      const cleared = clearHireDependencies(structure, cardId);

      save(blockerId ? setDependency(cleared, cardId, blockerId, true, "HIRE") : cleared);
    },
    applyPlan: (stages, chain) => {
      let next = structure;
      for (const [cardId, stage] of Object.entries(stages)) {
        next = setCardStage(next, cardId, stage);
      }
      for (const [cardId, predecessor] of Object.entries(chain)) {
        next = setDependency(next, cardId, predecessor.id, true, predecessor.source);
      }
      save(next, Object.keys(stages));
    },
  };
}
