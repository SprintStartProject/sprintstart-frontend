import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a click handler that fires `onReached` once every
 * `requiredClicks` consecutive calls, resetting the count in between.
 *
 * Generalizes the Settings cogwheel's triple-click unlock so the next
 * hidden trigger reuses one counter instead of copying ref plumbing.
 * The count deliberately lives in a ref rather than state so the side
 * effect runs exactly once even when React double-invokes updaters in
 * StrictMode dev — mirroring the `useDinoEasterEgg` implementation this
 * was extracted from. `onReached` is read through a ref too, so callers
 * can pass an inline closure without re-arming the handler.
 */
export function useRepeatClicks(requiredClicks: number, onReached: () => void): () => void {
  const countRef = useRef(0);
  const onReachedRef = useRef(onReached);

  useEffect(() => {
    onReachedRef.current = onReached;
  });

  return useCallback(() => {
    countRef.current += 1;
    if (countRef.current < requiredClicks) return;

    countRef.current = 0;
    onReachedRef.current();
  }, [requiredClicks]);
}
