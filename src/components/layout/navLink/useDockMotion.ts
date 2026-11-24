import { useSpring, useTransform, type MotionValue } from "framer-motion";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  DOCK_INFLUENCE_RADIUS_PX,
  DOCK_TINT_FALLOFF_EXPONENT,
  DOCK_TRACKING_SPRING,
  NAV_ROW_PITCH_PX,
  getInfluence,
  liftNudge,
  liftScale,
  ringOpacityOf,
  tintOpacityOf,
} from "./dockMath";

type DockMotion = {
  scale: MotionValue<number>;
  x: MotionValue<number>;
  tintOpacity: MotionValue<number>;
  ringOpacity: MotionValue<number>;
  /** Keyboard focus stands in for the pointer and asks for the full lift outright. */
  setFocused: (focused: boolean) => void;
};

/**
 * Measures the row's centre once per render instead of on every pointer move. `getBoundingClientRect`
 * forces layout, and doing that for every entry on every move is exactly the work that makes a fast
 * sweep feel heavy. No dependency array, so a list that changes stays measured.
 */
function useRowCentre(elementRef: RefObject<HTMLDivElement | null>) {
  const centerYRef = useRef(0);

  useLayoutEffect(() => {
    let frame = 0;

    function measure() {
      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      centerYRef.current = rect.top + rect.height / 2;
    }

    // Scroll and resize both fire far faster than the layout they invalidate,
    // and every row runs its own handler — so coalesce into one measurement
    // per frame instead of one per event.
    function scheduleMeasure() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    }

    measure();
    window.addEventListener("resize", scheduleMeasure);
    // Bubble phase, so this only fires for the document scroller.
    window.addEventListener("scroll", scheduleMeasure, { passive: true });

    // The sidebar's own scroll container is the other thing that moves these
    // rows. Listening on `window` in the *capture* phase would catch it, but
    // would also re-measure every row on every scroll anywhere in the app —
    // main content, drawers, tables — which is exactly the per-entry
    // `getBoundingClientRect` cost `centerYRef` exists to avoid.
    const scroller = elementRef.current?.closest("[data-sidebar-scroll]");
    scroller?.addEventListener("scroll", scheduleMeasure, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure);
      scroller?.removeEventListener("scroll", scheduleMeasure);
    };
  });

  return centerYRef;
}

/**
 * The dock effect of one entry: how strongly the pointer lifts it and how much of the hover tint it
 * carries, both derived from the pointer's y rather than from `pointerenter` on the element. At
 * speed the pointer can skip a row entirely between two frames, and an entry that is never entered
 * never magnifies — which is what made a quick sweep look like it had missed half the list.
 *
 * The tint is its own value rather than scaled down from the lift, because the two answer different
 * questions: the lift says "the pointer is near", the tint says "this is the row you would click".
 * They therefore run different radii. Both are gated on reduced motion, because both render paths
 * hand the job to a plain CSS `group-hover` there.
 */
export function useDockMotion(
  pointerY: MotionValue<number>,
  elementRef: RefObject<HTMLDivElement | null>,
  prefersReducedMotion: boolean,
): DockMotion {
  const centerYRef = useRowCentre(elementRef);
  const [isFocused, setIsFocused] = useState(false);

  const targetInfluence = useTransform(pointerY, (y) => {
    if (prefersReducedMotion) return 0;
    if (isFocused) return 1;

    return getInfluence(y, centerYRef.current, DOCK_INFLUENCE_RADIUS_PX);
  });
  const targetTint = useTransform(pointerY, (y) => {
    if (prefersReducedMotion) return 0;
    if (isFocused) return 1;

    return getInfluence(y, centerYRef.current, NAV_ROW_PITCH_PX, DOCK_TINT_FALLOFF_EXPONENT);
  });

  const influence = useSpring(targetInfluence, DOCK_TRACKING_SPRING);
  const tint = useSpring(targetTint, DOCK_TRACKING_SPRING);

  return {
    scale: useTransform(influence, liftScale),
    x: useTransform(influence, liftNudge),
    tintOpacity: useTransform(tint, tintOpacityOf),
    ringOpacity: useTransform(tint, ringOpacityOf),
    setFocused: setIsFocused,
  };
}
