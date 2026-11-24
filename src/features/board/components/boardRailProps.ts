import type { BoardModel } from "./BoardSurface";
import type { BoardToolRailProps } from "./BoardToolRail";

type Focus = { isFocused: boolean; setFocused: (focused: boolean) => void };

/** What the tool rail needs from the board, read off the four layers it is built in. */
export function toolRailProps(
  model: BoardModel,
  focus: Focus,
  vertical: boolean,
): BoardToolRailProps {
  const { store, memory, look } = model;
  return {
    isFocused: focus.isFocused,
    onToggle: () => focus.setFocused(!focus.isFocused),
    hasBoard: !!store.board,
    isArranging: memory.isArranging,
    planChanges: memory.planChanges,
    namingArea: memory.namingArea,
    onTogglePlanning: () => (memory.isArranging ? memory.finishArranging() : look.beginPlanning()),
    onCancelPlanning: memory.cancelArranging,
    onNameArea: () => memory.setNamingArea(true),
    isPathShown: memory.isPathShown,
    onShowPath: memory.showPathWindow,
    hasTaskPool: memory.hasTaskPool,
    isTaskPoolShown: memory.isTaskPoolShown,
    onShowTaskPool: memory.showTaskPool,
    offerFilters: memory.allCards.length > 2,
    filter: memory.filter,
    onFilter: memory.setFilter,
    markSections: look.markSections,
    shownSectionId: look.shownSectionId,
    onSelectSection: memory.setSectionId,
    vertical,
    addingKind: memory.addingKind,
    onPickKind: memory.setAddingKind,
  };
}
