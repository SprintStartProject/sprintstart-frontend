import { useCallback, useRef } from "react";
import {
  isHolding,
  isStillResting,
  PILE_DWELL_MS,
  REORDER_DWELL_MS,
  restZone,
  type Resting,
} from "../layout/dragGeometry";
import type { usePileTarget } from "./usePileTarget";

type Point = { x: number; y: number };

type DragRestInput = {
  pile: ReturnType<typeof usePileTarget>;
  canPile: boolean;
  /** Trades the dragged card's place with the one it rests on. Says whether it did. */
  swapOnto: (cardId: string, candidateId: string) => boolean;
};

/** What the dragged card has begun to rest on, and the wait before that does anything. */
export function useDragRest({ pile, canPile, swapOnto }: DragRestInput) {
  const resting = useRef<Resting | null>(null);
  const { cancelTimer, clear, isLit, light, schedule } = pile;

  const forget = useCallback(() => {
    resting.current = null;
  }, []);

  const restOn = useCallback(
    (cardId: string, candidateId: string, element: HTMLElement, point: Point) => {
      const current = resting.current;
      const zone = restZone(element, point, isHolding(current, candidateId), canPile);
      // Still resting where it was: whatever is pending stays pending, whatever is lit stays lit.
      if (isStillResting(current, candidateId, zone, point)) return;

      // Anything else starts the wait over from here.
      const keepLit = zone === "middle" && isLit(candidateId);
      cancelTimer();
      if (!keepLit) clear();

      const spot: Resting = { id: candidateId, zone, x: point.x, y: point.y };
      resting.current = spot;
      if (keepLit) return;

      schedule(zone === "middle" ? PILE_DWELL_MS : REORDER_DWELL_MS, () => {
        if (resting.current !== spot) return;
        if (zone === "middle") light(cardId, candidateId);
        else if (swapOnto(cardId, candidateId)) resting.current = null;
      });
    },
    [canPile, cancelTimer, clear, isLit, light, schedule, swapOnto],
  );

  return { restOn, forget };
}
