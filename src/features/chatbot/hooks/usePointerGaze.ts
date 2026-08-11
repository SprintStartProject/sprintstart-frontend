import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { getFlyingRocket, subscribeToRocketFlight } from "../../moments/rocketWatch.ts";

/**
 * How far the pupils may travel from centre, in viewBox units.
 *
 * The face plate is 12 units wide and the pupils sit 1.45 across, so there is
 * not much room before an eye touches the bezel. Small numbers here: the bot
 * glances, it does not roll its eyes around the socket.
 */
const MAX_X = 0.95;
const MAX_Y = 0.7;

/**
 * Distance, in px, over which the gaze reaches full deflection.
 *
 * Beyond this the eyes are simply at their limit. Without it the pupils would
 * be pinned to the edge for almost the whole screen and only move in the last
 * few centimetres, which reads as broken rather than as watching.
 */
const REACH = 420;

/**
 * How close the pointer has to stay for a lap to count, in px.
 *
 * Generous, because wide circles are as much a part of the gesture as tight
 * ones. The heavy lifting is done by the signed sum below rather than by this
 * limit: a sweep across a monitor turns through a fraction of a lap and then
 * back again, so it cancels itself out no matter how far it travels. All this
 * guard has to catch is motion so distant it plainly is not *about* the bot.
 */
const ORBIT_RADIUS = 560;

/** Laps required before it gets to the bot. */
const ORBIT_TURNS = 2.5;

/**
 * Idle gap that clears the tally, in ms.
 *
 * Circling is a continuous gesture. Without this, a few stray arcs spread over
 * a minute would eventually add up to a lap the user never made.
 */
const ORBIT_RESET_MS = 400;

export interface Gaze {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

export interface PointerGaze {
  gaze: Gaze;
  /**
   * True while the eyes are on a rocket instead of the pointer. This is the
   * caller's cue for the rest of the face — the gaze itself already follows.
   */
  isWatchingRocket: boolean;
}

/**
 * Makes a bot's eyes follow the pointer — and drop it for any rocket that
 * crosses the screen, because anything with eyes would.
 *
 * Driven by motion values rather than React state on purpose: `pointermove`
 * fires dozens of times a second, and re-rendering the whole glyph for each one
 * would spend a lot of React on two circles. Motion values write to the DOM
 * directly, so the component renders once and then holds still.
 *
 * The raw offset is fed through a spring, which is what separates "alive" from
 * "a cursor-tracking widget": eyes that snap exactly to the pointer look
 * mechanical, and a little lag reads as something noticing you.
 *
 * While a rocket is announced (see `rocketWatch`), a frame loop reads its
 * position off the DOM and aims the same motion values at it; pointer input is
 * ignored for the duration, since two masters for one pair of eyes is a bot
 * that looks broken in both directions. When the flight ends the eyes ease
 * back to centre rather than snapping to wherever the pointer happens to be —
 * the look of watching something leave.
 *
 * Returns zeroed values when disabled, so callers can wire it unconditionally
 * and let the flag decide.
 */
export function usePointerGaze(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onOrbit?: () => void,
): PointerGaze {
  const reduceMotion = useReducedMotion();
  const active = enabled && !reduceMotion;

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 260, damping: 26, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 260, damping: 26, mass: 0.5 });

  // The rocket currently in flight, if any. External-store rather than local
  // state, so every bot on the page agrees frame-for-frame on whether there
  // is something to gawp at.
  const flyingRocket = useSyncExternalStore(subscribeToRocketFlight, getFlyingRocket, () => null);
  const watchedRocket = active ? flyingRocket : null;

  // Mirror for the pointer handler below, which must not re-subscribe (and
  // drop a half-finished orbit) every time a rocket comes or goes.
  const watchedRocketRef = useRef(watchedRocket);
  useEffect(() => {
    watchedRocketRef.current = watchedRocket;
  }, [watchedRocket]);

  // Follows the flight. A frame loop rather than events, because the rocket
  // is mid-animation and its position changes every frame regardless — there
  // is nothing to be notified *of*. It only runs while a flight is up, so
  // the idle cost is nothing.
  useEffect(() => {
    if (!watchedRocket) return;

    let frame = 0;

    const follow = () => {
      const element = ref.current;

      if (element && watchedRocket.isConnected) {
        const box = element.getBoundingClientRect();
        const target = watchedRocket.getBoundingClientRect();

        if (box.width > 0 && target.width > 0) {
          const dx = target.left + target.width / 2 - (box.left + box.width / 2);
          const dy = target.top + target.height / 2 - (box.top + box.height / 2);

          rawX.set(clamp(dx / REACH) * MAX_X);
          rawY.set(clamp(dy / REACH) * MAX_Y);
        }
      }

      frame = requestAnimationFrame(follow);
    };

    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      // Ease back to centre once the show is over. Snapping to the
      // pointer would mean the eyes teleport the moment the rocket
      // fades, which undoes the "watched it go" beat.
      rawX.set(0);
      rawY.set(0);
    };
  }, [watchedRocket, ref, rawX, rawY]);

  // Held in a ref so a changing callback identity does not tear down the
  // listener and lose a half-finished lap with it.
  const onOrbitRef = useRef(onOrbit);
  useEffect(() => {
    onOrbitRef.current = onOrbit;
  }, [onOrbit]);

  useEffect(() => {
    if (!active) {
      rawX.set(0);
      rawY.set(0);
      return;
    }

    let frame = 0;
    let previousAngle: number | null = null;
    let turned = 0;
    let lastMoveAt = 0;

    function handlePointerMove(event: PointerEvent) {
      // The rocket owns the eyes for as long as it is up. The listener
      // stays subscribed — tearing it down would lose a half-finished
      // orbit — but its input goes nowhere.
      if (watchedRocketRef.current) return;

      // Coalesced into one read per frame: the listener can fire several
      // times between paints, and `getBoundingClientRect` forces layout.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = ref.current;
        if (!element) return;

        const box = element.getBoundingClientRect();
        if (box.width === 0) return;

        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);

        rawX.set(clamp(dx / REACH) * MAX_X);
        rawY.set(clamp(dy / REACH) * MAX_Y);

        trackOrbit(dx, dy);
      });
    }

    function trackOrbit(dx: number, dy: number) {
      const now = performance.now();
      const wasStill = now - lastMoveAt > ORBIT_RESET_MS;
      lastMoveAt = now;

      const angle = Math.atan2(dy, dx);
      const tooFar = Math.hypot(dx, dy) > ORBIT_RADIUS;

      if (wasStill || tooFar) {
        previousAngle = tooFar ? null : angle;
        turned = 0;
        return;
      }

      if (previousAngle === null) {
        previousAngle = angle;
        return;
      }

      // Signed and wrapped into (-PI, PI], so laps in one direction add up
      // while back-and-forth wiggling cancels itself out — which is the
      // difference between circling the bot and just moving near it.
      let delta = angle - previousAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;

      previousAngle = angle;
      turned += delta;

      if (Math.abs(turned) >= ORBIT_TURNS * 2 * Math.PI) {
        turned = 0;
        onOrbitRef.current?.();
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [active, ref, rawX, rawY]);

  return { gaze: { x, y }, isWatchingRocket: watchedRocket !== null };
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
