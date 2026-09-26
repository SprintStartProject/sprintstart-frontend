import { useCallback, useEffect, useRef } from "react";

/** Time budget per required click when no explicit window is given (ms). */
const MS_PER_CLICK = 1000;

/**
 * Returns a click handler that fires `onReached` once every
 * `requiredClicks` consecutive calls, resetting the count in between.
 *
 * The whole gesture has to fit in `windowMs`, measured from its *first*
 * click: once that much time has passed since the click that started the
 * count, the next click starts a new one. (Measuring the gap between two
 * neighbouring clicks instead would let a slow drip of clicks, each within
 * the window of the last, add up forever.) Without the window, the
 * counter is an accumulator that never resets, and stray clicks on the
 * dashboard's header icon spread over a working day would open the 2048
 * modal out of nowhere.
 *
 * The default allows one second per required click (3s for a triple click,
 * 5s for the logo's five) on purpose: this is a deliberate gesture, and a
 * window tight enough to demand double-click tempo would read as broken to
 * somebody counting their clicks. Platform precedents for hidden gesture
 * unlocks (Android's 7x build number) have no timer at all; the guard here
 * only has to rule out accumulation across a session.
 *
 * Generalizes the Settings cogwheel's triple-click unlock so the next
 * hidden trigger reuses one counter instead of copying ref plumbing.
 * The count deliberately lives in a ref rather than state so the side
 * effect runs exactly once even when React double-invokes updaters in
 * StrictMode dev — mirroring the `useDinoEasterEgg` implementation this
 * was extracted from. `onReached` is read through a ref too, so callers
 * can pass an inline closure without re-arming the handler.
 */
export function useRepeatClicks(
  requiredClicks: number,
  onReached: () => void,
  windowMs: number = requiredClicks * MS_PER_CLICK,
): () => void {
  const countRef = useRef(0);
  const firstClickRef = useRef(0);
  const onReachedRef = useRef(onReached);

  useEffect(() => {
    onReachedRef.current = onReached;
  });

  return useCallback(() => {
    const now = Date.now();
    if (countRef.current === 0 || now - firstClickRef.current > windowMs) {
      countRef.current = 0;
      firstClickRef.current = now;
    }

    countRef.current += 1;
    if (countRef.current < requiredClicks) return;

    countRef.current = 0;
    onReachedRef.current();
  }, [requiredClicks, windowMs]);
}
