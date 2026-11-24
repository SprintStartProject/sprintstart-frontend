import { useMarkableBoard } from "../marks/useCardMarks";
import type { BoardMemory } from "./useBoardMemory";
import type { BoardProcess } from "./useBoardProcess";
import type { BoardStore } from "./useBoardStore";
import { useBoardCuts } from "./useBoardCuts";
import { useBoardPiles } from "./useBoardPiles";
import { useBoardSections } from "./useBoardSections";

/**
 * What is on screen: the sections and piles, the cards left after every cut, and the line that names
 * the cuts in force.
 */
export function useBoardLook(store: BoardStore, memory: BoardMemory, process: BoardProcess) {
  const { board, reorder, editCard } = store;
  const { allCards, groups, pinnedIds, sectionId, setSectionId, isArranging } = memory;
  const { states, stackOnto } = process;

  // Lends these cards to the app shell, so the selection toolbar mounted above the router can offer
  // the marker pen on text that turns out to be on one of them. Taken back when this page leaves.
  useMarkableBoard({
    cards: allCards,
    onEditCard: (cardId, request) => void editCard(cardId, request),
  });

  const sections = useBoardSections({
    allCards,
    groups,
    states,
    pinnedIds,
    sectionId,
    setSectionId,
  });
  const { shownSectionId, cardMarks } = sections;
  const piles = useBoardPiles({
    allCards,
    groups,
    saveGroups: memory.saveGroups,
    states,
    pinnedIds,
    isArranging,
    shownSectionId,
    cardMarks,
    stackOnto,
  });

  const { shownCards, activeCuts } = useBoardCuts({ memory, process, sections, piles });

  /**
   * Undoes every cut at once: the step it was opened for, the filter, the section and the focus
   * view. One function because the line that offers it counts *all* the cards the board is holding
   * back, and an offer that cleared some of them would be a button that does not do what the
   * sentence above it says.
   */
  function showEverything() {
    process.openAllStages();
    setSectionId(null);
    memory.setFilter("all");
    piles.openAllPiles();
    if (process.pathPlace) process.clearPathPlace();
  }

  /** Planning opens every band: a dependency you cannot see is one you cannot set. */
  function beginPlanning() {
    process.openAllStages();
    memory.startArranging();
  }

  return {
    ...sections,
    ...piles,
    shownCards,
    griddedBoard: board ? { ...board, cards: shownCards } : null,
    hiddenCount: allCards.length - shownCards.length,
    activeCuts,
    showEverything,
    beginPlanning,
    handleReorder: (cardIds: string[]) => void reorder(cardIds),
  };
}

export type BoardLook = ReturnType<typeof useBoardLook>;
