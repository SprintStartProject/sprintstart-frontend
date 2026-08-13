import { useCallback, useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";

/**
 * How much horizontal travel a gesture needs before it counts as a swipe.
 *
 * Low on purpose: a trackpad flick covers this within the first few events, so
 * the view changes while the fingers are still moving rather than after them.
 * The axis lock below is what keeps that from making vertical scrolling twitchy.
 */
const SWIPE_THRESHOLD_PX = 36;

/**
 * How long the wheel must be quiet before the gesture is considered over.
 *
 * Short, because it is no longer the only thing separating one flick from the
 * next -- see the re-acceleration check below. A long pause here is what made
 * two quick swipes in a row lose the second one.
 */
const GESTURE_END_MS = 120;

/**
 * How much a wheel event has to outgrow the one before it to count as a fresh
 * flick rather than the tail of the last one.
 *
 * Momentum only ever decays, so any real jump in magnitude means the fingers
 * moved again. The constant term keeps the very small deltas at the end of a
 * glide from looking like a jump.
 */
const REACCELERATION_FACTOR = 1.25;
const REACCELERATION_FLOOR_PX = 2;

type UseHorizontalWheelNavigationOptions = {
  onNext: () => void;
  onPrevious: () => void;
  /** Set false to leave the gesture alone, e.g. while a dialog is open. */
  enabled?: boolean;
};

/**
 * Reports whether the gesture started inside something that scrolls sideways
 * on its own -- a tab bar that overflows, a wide table. Those keep their own
 * gesture; stealing it would make them unreachable on a trackpad.
 */
function startedInHorizontalScroller(target: EventTarget | null, boundary: HTMLElement): boolean {
  let node = target instanceof HTMLElement ? target : null;

  while (node && node !== boundary) {
    // A few pixels of overflow is rounding, not a scroller. Treating it as
    // one would silently swallow gestures over ordinary content.
    if (node.scrollWidth - node.clientWidth > 4) {
      const { overflowX } = window.getComputedStyle(node);

      if (overflowX === "auto" || overflowX === "scroll") return true;
    }

    node = node.parentElement;
  }

  return false;
}

/**
 * Two-finger horizontal swipe to move between sibling views, for people who
 * would rather not aim at a tab bar.
 *
 * Listens for `wheel` rather than touch events because that is what a trackpad
 * produces, and non-passively so the gesture can be consumed -- browsers
 * otherwise read a left swipe as "go back".
 *
 * Returns a callback ref rather than a `useRef` object on purpose. Pages that
 * render a loading state first have no element on the render the effect would
 * run in, and a plain ref gives the effect no reason to run again once the real
 * markup appears -- the listener would simply never be attached.
 */
export function useHorizontalWheelNavigation<T extends HTMLElement>({
  onNext,
  onPrevious,
  enabled = true,
}: UseHorizontalWheelNavigationOptions): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);

  // Read through refs so the listener is attached once, instead of being torn
  // down and rebuilt on every render that changes a handler identity.
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);

  useEffect(() => {
    onNextRef.current = onNext;
    onPreviousRef.current = onPrevious;
  }, [onNext, onPrevious]);

  useEffect(() => {
    if (!element || !enabled) return;

    let travelled = 0;
    /** -1 previous, 1 next, 0 nothing yet -- for this gesture. */
    let lastFired = 0;
    let previousMagnitude = 0;
    let horizontalGesture = false;
    let endTimer = 0;

    function handleWheel(event: WheelEvent) {
      if (!element) return;

      // The axis is decided once, on the first event of the gesture, and
      // then held: a real swipe drifts vertically halfway through, and
      // re-deciding per event would keep dropping it back out of the
      // gesture and losing the travel accumulated so far.
      if (!horizontalGesture) {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        if (startedInHorizontalScroller(event.target, element)) return;

        horizontalGesture = true;
      }

      event.preventDefault();

      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        travelled = 0;
        lastFired = 0;
        previousMagnitude = 0;
        horizontalGesture = false;
      }, GESTURE_END_MS);

      // Swiping again before the last flick has finished coasting is the
      // normal way to move two tabs over, and waiting for the momentum to
      // die first is what made that feel stuck. A flick that speeds back
      // up is a new one, so the direction lock is dropped and the count
      // starts over.
      const magnitude = Math.abs(event.deltaX);

      if (
        lastFired !== 0 &&
        magnitude > previousMagnitude * REACCELERATION_FACTOR + REACCELERATION_FLOOR_PX
      ) {
        lastFired = 0;
        travelled = 0;
      }

      previousMagnitude = magnitude;
      travelled += event.deltaX;

      // Blocked per direction rather than per gesture. A flick keeps
      // coasting in the direction it was thrown, so repeating the same
      // direction has to be refused -- but swiping straight back the
      // other way is a new intent, and waiting out the momentum of the
      // first flick before accepting it is what felt unresponsive.
      if (travelled >= SWIPE_THRESHOLD_PX && lastFired !== 1) {
        lastFired = 1;
        travelled = 0;
        onNextRef.current();
      } else if (travelled <= -SWIPE_THRESHOLD_PX && lastFired !== -1) {
        lastFired = -1;
        travelled = 0;
        onPreviousRef.current();
      }
    }

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
      window.clearTimeout(endTimer);
    };
  }, [element, enabled]);

  return useCallback((node: T | null) => setElement(node), []);
}

type UseSwipeableTabsOptions<TTab extends string> = {
  /** Left-to-right order of the tabs, the same list the bar renders from. */
  order: readonly TTab[];
  value: TTab;
  onChange: (tab: TTab) => void;
  enabled?: boolean;
};

/**
 * `useHorizontalWheelNavigation` for the common case: a tab bar whose order is
 * already a constant somewhere.
 *
 * Clamped rather than wrapping. A swipe past the last tab landing back on the
 * first reads as the page having jumped somewhere rather than as having reached
 * the end.
 */
export function useSwipeableTabs<TTab extends string, T extends HTMLElement>({
  order,
  value,
  onChange,
  enabled,
}: UseSwipeableTabsOptions<TTab>): RefCallback<T> {
  function step(offset: number) {
    const next = order[order.indexOf(value) + offset];

    if (next !== undefined && next !== value) onChange(next);
  }

  return useHorizontalWheelNavigation<T>({
    onNext: () => step(1),
    onPrevious: () => step(-1),
    enabled,
  });
}
