import { useCallback } from "react";
import { useMoveCooldown } from "./useMoveCooldown";

/**
 * Trading places with the card a dragged one rests on, no more often than the board can follow.
 *
 * Says whether the trade happened, so the caller knows whether to keep waiting.
 */
export function useReorderSwap(
  onReorder: ((cardIds: string[]) => void) | undefined,
  reorder: (cardId: string, targetId: string) => string[],
) {
  const cooldown = useMoveCooldown();
  const { cooledDown, markMoved } = cooldown;

  const swapOnto = useCallback(
    (cardId: string, candidateId: string): boolean => {
      const now = performance.now();
      if (!onReorder || !cooledDown(now)) return false;

      onReorder(reorder(cardId, candidateId));
      markMoved(now);

      return true;
    },
    [cooledDown, markMoved, onReorder, reorder],
  );

  return { swapOnto, ...cooldown };
}
