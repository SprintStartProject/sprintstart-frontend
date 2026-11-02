import { useMemo } from "react";
import { describeCuts, selectShownCards } from "../layout/boardCuts";
import type { BoardMemory } from "./useBoardMemory";
import type { BoardProcess } from "./useBoardProcess";
import type { useBoardPiles } from "./useBoardPiles";
import type { useBoardSections } from "./useBoardSections";

type Params = {
  memory: BoardMemory;
  process: BoardProcess;
  sections: ReturnType<typeof useBoardSections>;
  piles: ReturnType<typeof useBoardPiles>;
};

/**
 * The cards left on screen after every cut -- piles, the phase the board was opened for, the owner
 * filter, the section, pins -- and the line that names the cuts in force.
 */
export function useBoardCuts({ memory, process, sections, piles }: Params) {
  const { allCards, groups, pinnedIds, filter } = memory;
  const { states, pathPlace, phases, cardOrigins, pathPlaceTitle } = process;
  const { shownSectionId, cardMarks } = sections;
  const { stacks, visibleStackIds } = piles;

  const cutBy = useMemo(
    () => ({
      allCards,
      stacks,
      visibleStackIds,
      pathPlace,
      phases,
      cardOrigins,
      filter,
      groups,
      shownSectionId,
      states,
      pinnedIds,
      cardMarks,
    }),
    [
      allCards,
      stacks,
      visibleStackIds,
      pathPlace,
      phases,
      cardOrigins,
      filter,
      groups,
      shownSectionId,
      states,
      pinnedIds,
      cardMarks,
    ],
  );
  const shownCards = useMemo(() => selectShownCards(cutBy), [cutBy]);
  const activeCuts = useMemo(
    () => describeCuts(cutBy, { pathPlaceTitle, shownSectionId, sections: sections.sections }),
    [cutBy, pathPlaceTitle, shownSectionId, sections.sections],
  );

  return { shownCards, activeCuts };
}
