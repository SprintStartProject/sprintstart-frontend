import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { flightFrame, type Viewport } from "./cameraMath";

type Flight = { frame: number; timeout: number; land: () => void };

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animated moves of the canvas view.
 *
 * `flyTo` resolves when the flight is over, however it ends. `cancelFlight` stops the one in
 * progress where it is; its promise still settles, because callers await a flight behind a
 * "diving" guard, and a flight cut short by a wheel, a second click or an unmount must not leave
 * that guard up for good.
 */
export function useViewportFlight(
  viewportRef: RefObject<Viewport>,
  setViewport: Dispatch<SetStateAction<Viewport>>,
) {
  const flightRef = useRef<Flight | null>(null);

  const cancelFlight = useCallback(() => {
    const flight = flightRef.current;
    if (!flight) return;
    flightRef.current = null;
    cancelAnimationFrame(flight.frame);
    window.clearTimeout(flight.timeout);
    flight.land();
  }, []);

  const flyTo = useCallback(
    (target: Viewport, durationMs: number) =>
      new Promise<void>((resolve) => {
        cancelFlight();
        if (
          prefersReducedMotion() ||
          durationMs <= 0 ||
          typeof requestAnimationFrame !== "function"
        ) {
          setViewport(target);
          resolve();
          return;
        }
        const origin = viewportRef.current;
        const startedAt = performance.now();
        const finish = () => {
          const flight = flightRef.current;
          flightRef.current = null;
          if (flight) {
            cancelAnimationFrame(flight.frame);
            window.clearTimeout(flight.timeout);
          }
          setViewport(target);
          resolve();
        };
        const step = (now: number) => {
          const t = Math.min(1, (now - startedAt) / durationMs);
          if (t >= 1) {
            finish();
            return;
          }
          setViewport(flightFrame(origin, target, t));
          if (flightRef.current) flightRef.current.frame = requestAnimationFrame(step);
        };
        // A hidden tab never runs animation frames; the timeout lands the flight regardless.
        flightRef.current = {
          frame: requestAnimationFrame(step),
          timeout: window.setTimeout(finish, durationMs + 120),
          land: resolve,
        };
      }),
    [cancelFlight, setViewport, viewportRef],
  );

  useEffect(() => cancelFlight, [cancelFlight]);

  return { flyTo, cancelFlight };
}
