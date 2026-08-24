import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { capturePoolFlightRect, type PoolFlightItem, type PoolFlightRect } from "./poolFlight";

type PoolTaskFlightProps = {
  flight: PoolFlightItem;
  onComplete: () => void;
};

/**
 * How many frames to keep looking for the pool before giving up. The launch switches to Overview
 * first, and `SlidingTabPanel` runs a ~180ms `mode="wait"` exit before the incoming panel (which
 * holds the pool) mounts. A short budget would expire mid-transition and drop the arc whenever it
 * was launched from another tab, so this covers the switch with room to spare while still bailing
 * quickly when the pool genuinely is not there.
 */
const MAX_TARGET_FRAMES = 40;

function findPoolTarget(): PoolFlightRect | null {
  const element =
    document.querySelector<HTMLElement>("[data-pool-flight-target]") ??
    document.querySelector<HTMLElement>('[data-testid="starter-work-pool"]');
  return element ? capturePoolFlightRect(element) : null;
}

/**
 * A fixed, portaled card ghost that morphs from the successful action into the visible pool.
 *
 * The source rectangle is captured at click time, while the destination is measured after React
 * has switched back to Overview. This lets drawer and tab actions use the same transition without
 * coupling the animation to either layout. It never intercepts input and is decorative to assistive
 * technology. Reduced-motion users skip the travel entirely.
 */
export function PoolTaskFlight({ flight, onComplete }: PoolTaskFlightProps) {
  const prefersReducedMotion = useReducedMotion();
  const [target, setTarget] = useState<PoolFlightRect | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      const timeout = window.setTimeout(onComplete, 0);
      return () => window.clearTimeout(timeout);
    }

    let frame = 0;
    let attempts = 0;
    const measure = () => {
      const nextTarget = findPoolTarget();
      if (nextTarget) {
        setTarget(nextTarget);
        return;
      }
      attempts += 1;
      if (attempts < MAX_TARGET_FRAMES) frame = window.requestAnimationFrame(measure);
      else onComplete();
    };
    frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [onComplete, prefersReducedMotion]);

  if (prefersReducedMotion || !target) return null;

  const endWidth = Math.min(260, Math.max(180, target.width * 0.34));
  const endHeight = 136;
  const endLeft = target.left + Math.max(16, (target.width - endWidth) / 2);
  const endTop = target.top + Math.max(16, Math.min(96, (target.height - endHeight) / 2));
  const middleLeft = (flight.origin.left + endLeft) / 2;
  const arcTop = (flight.origin.top + endTop) / 2 - 48;
  const turn = flight.origin.left < endLeft ? 1.5 : -1.5;
  const summary = flight.summary?.trim();

  return createPortal(
    <motion.div
      data-testid="pool-task-flight"
      aria-hidden="true"
      initial={{
        top: flight.origin.top,
        left: flight.origin.left,
        width: Math.max(flight.origin.width, 44),
        height: Math.max(flight.origin.height, 44),
        opacity: 0.72,
        scale: 0.98,
        rotate: 0,
      }}
      animate={{
        top: [flight.origin.top, arcTop, endTop],
        left: [flight.origin.left, middleLeft, endLeft],
        width: [Math.max(flight.origin.width, 44), endWidth * 0.82, endWidth],
        height: [Math.max(flight.origin.height, 44), endHeight * 0.72, endHeight],
        opacity: [0.72, 0.86, 0],
        scale: [0.98, 1.04, 0.86],
        rotate: [0, turn, 0],
      }}
      transition={{
        duration: 0.78,
        times: [0, 0.56, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={onComplete}
      className="pointer-events-none fixed z-[100] origin-center overflow-hidden rounded-2xl border border-app-brand-border-strong bg-app-surface/85 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="absolute inset-0 bg-app-brand-soft/55" />
      <div className="relative flex h-full min-w-0 flex-col gap-2 overflow-hidden">
        <p className="line-clamp-2 text-sm leading-snug font-semibold text-app-text">
          {flight.title}
        </p>
        {summary && <p className="truncate text-xs text-app-text-muted">{summary}</p>}
        <span className="mt-auto h-1.5 w-14 rounded-full bg-app-brand/55" />
      </div>
    </motion.div>,
    document.body,
  );
}
