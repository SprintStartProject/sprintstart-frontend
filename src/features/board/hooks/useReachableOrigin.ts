import { originOf, type CardOrigins } from "../layout/cardOrigins";
import { leadsOntoPath } from "../layout/pathStages";
import { useBoardPath } from "./boardPath";

/**
 * A card's way back, unless it leads into a part of the path that is not there.
 *
 * A step rebuilt away, or a path that is gone altogether, would turn "Back to …" into a trip to a
 * page that says the step is not there. Only decided once the path has been read: before that,
 * "no path" means "not known yet", and hiding every way back for a second would be the board
 * flickering.
 */
export function useReachableOrigin(cardOrigins: CardOrigins | undefined) {
  const { phases, settled } = useBoardPath();

  return (cardId: string) => {
    const origin = originOf(cardOrigins, cardId);
    if (!origin || !settled) return origin;

    return leadsOntoPath(origin.url, phases) ? origin : null;
  };
}
