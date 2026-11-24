import { useMemo, useState } from "react";
import type { AuthoredCardKind } from "../types";
import type { BoardFilter } from "../layout/boardFilters";
import type { BoardStore } from "./useBoardStore";
import { useBoardAreas } from "./useBoardAreas";
import { useBoardPlanning } from "./useBoardPlanning";
import { useCardPreferences } from "./useCardPreferences";
import { useCardRemovals } from "./useCardRemovals";
import { usePanelSwitches } from "./usePanelSwitches";

/**
 * What the hire has decided about this board and the page remembers: which cards are folded, pinned
 * or resized, which panels are on, the areas, what is being planned and what is on its way out --
 * together with the cuts they have chosen and the card form they have open.
 *
 * Also the cards the board is holding, whatever the current view. The process layer and the section
 * counts are both computed from these rather than from what is on screen: a rail that said "3 of 4
 * done" because the fourth card happened to be filtered out would be worse than no rail at all.
 */
export function useBoardMemory(store: BoardStore) {
  const { board, boardId, storedFor, projectId, dismiss, reorder } = store;
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [sectionId, setSectionId] = useState<string | null>(null);
  /** The kind of card being written, or null when nothing is being added. */
  const [addingKind, setAddingKind] = useState<AuthoredCardKind | null>(null);

  const cards = useCardPreferences(boardId, storedFor);
  const panels = usePanelSwitches(boardId, storedFor);
  const areas = useBoardAreas({ boardId, storedFor, sectionId, setSectionId });
  const planning = useBoardPlanning({ board, boardId, projectId, reorder });
  const removals = useCardRemovals({
    board,
    boardId,
    projectId,
    dismiss,
    removeTaskPool: panels.removeTaskPool,
  });

  // Whether the backend put a pool card on this board at all. The rail switch only exists for a
  // board that has one: a switch that toggles nothing visible reads as broken.
  const hasTaskPool = board?.cards.some((card) => card.content.kind === "TASK_POOL") ?? false;

  const { pendingRemovals } = removals;
  const { isTaskPoolShown } = panels;
  const allCards = useMemo(
    () =>
      board?.cards.filter(
        (card) =>
          !pendingRemovals.has(card.id) && (isTaskPoolShown || card.content.kind !== "TASK_POOL"),
      ) ?? [],
    [board, pendingRemovals, isTaskPoolShown],
  );

  return {
    filter,
    setFilter,
    sectionId,
    setSectionId,
    addingKind,
    setAddingKind,
    ...cards,
    ...panels,
    ...areas,
    ...planning,
    ...removals,
    hasTaskPool,
    allCards,
  };
}

export type BoardMemory = ReturnType<typeof useBoardMemory>;
