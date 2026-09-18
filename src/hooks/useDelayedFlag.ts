import { useEffect, useRef, useState } from "react";
import { SKELETON_APPEAR_DELAY_MS, SKELETON_MIN_VISIBLE_MS } from "../styles/tokens";

/**
 * Debounces a loading flag for display: `active` only reaches the returned
 * value after {@link SKELETON_APPEAR_DELAY_MS}, and once shown it stays true
 * for at least {@link SKELETON_MIN_VISIBLE_MS} regardless of how quickly
 * `active` drops again. Meant for gating a skeleton or spinner — a cache hit
 * or a fast local backend never clears the appear delay, so the indicator
 * never flashes on and off, and a fetch that just barely clears it doesn't
 * vanish again a frame later.
 */
export function useDelayedFlag(
  active: boolean,
  appearDelayMs: number = SKELETON_APPEAR_DELAY_MS,
  minVisibleMs: number = SKELETON_MIN_VISIBLE_MS,
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (visible) return;

      const timer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, appearDelayMs);

      return () => clearTimeout(timer);
    }

    if (!visible) return;

    const elapsed = shownAtRef.current === null ? minVisibleMs : Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    const timer = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);

    return () => clearTimeout(timer);
  }, [active, appearDelayMs, minVisibleMs, visible]);

  return visible;
}
