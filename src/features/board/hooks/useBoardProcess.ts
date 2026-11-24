import type { BoardMemory } from "./useBoardMemory";
import type { BoardStore } from "./useBoardStore";
import { useBoardPath } from "./useBoardPath";
import { useBoardStructure } from "./useBoardStructure";
import { useStageBands } from "./useStageBands";

/**
 * The board as a process, not a pile: each card's stage read off the onboarding path, what blocks
 * what, and which stage bands are open.
 *
 * Nothing here sets a stage. The path is the one plan, and the board files its cards against it.
 */
export function useBoardProcess(store: BoardStore, memory: BoardMemory) {
  const { board, boardId, projectId, storageRevision } = store;
  const { allCards } = memory;

  const path = useBoardPath(projectId, storageRevision);
  const structure = useBoardStructure(boardId, allCards, path.stageOf);
  const bands = useStageBands({
    board,
    boardId,
    allCards,
    states: structure.states,
    pathSettled: path.pathSettled,
  });

  return { ...path, ...structure, ...bands };
}

export type BoardProcess = ReturnType<typeof useBoardProcess>;
