import { useCallback, useRef } from "react";
import { MOVE_COOLDOWN_MS } from "../layout/dragGeometry";

/**
 * How long the board ignores further reordering after a move, so the next decision is made
 * against where things actually are.
 */
export function useMoveCooldown() {
  const lastMoveAt = useRef(0);

  const cooledDown = useCallback((now: number) => now - lastMoveAt.current >= MOVE_COOLDOWN_MS, []);
  const markMoved = useCallback((now: number) => {
    lastMoveAt.current = now;
  }, []);
  const reset = useCallback(() => {
    lastMoveAt.current = 0;
  }, []);

  return { cooledDown, markMoved, reset };
}
