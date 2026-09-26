import { useEffect, useState } from "react";
import { clearEggEffect } from "../eggEffectBus.ts";

/** How long the reduced-motion chip stays before the effect clears (ms). */
export const REDUCED_MOTION_CHIP_MS = 1500;

/**
 * Delay before the live region receives its text (ms). Screen readers only
 * announce *changes* to a live region they already know about; a region that
 * is inserted together with its text is frequently skipped.
 */
const ANNOUNCE_DELAY_MS = 100;

type ReducedMotionEffectChipProps = {
  /** What the chip shows and what gets announced, e.g. "🎉 Party!". */
  text: string;
};

/**
 * The still stand-in for a whole-window effect whose motion *is* the effect
 * (confetti, matrix rain), shown to users who prefer reduced motion.
 *
 * Dropping the effect silently would make the typed phrase disappear into a
 * void; a short static chip acknowledges it without anything moving. It then
 * clears its bus effect on a timer, just as the animated versions end
 * themselves. The visible chip is `aria-hidden` and the announcement goes
 * through a separate status region that mounts empty and is filled a moment
 * later, so the text is actually read out rather than inserted unnoticed.
 */
export function ReducedMotionEffectChip({ text }: ReducedMotionEffectChipProps) {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    const announce = setTimeout(() => setAnnounced(text), ANNOUNCE_DELAY_MS);
    const clear = setTimeout(() => clearEggEffect(), REDUCED_MOTION_CHIP_MS);
    return () => {
      clearTimeout(announce);
      clearTimeout(clear);
    };
  }, [text]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-6 left-1/2 z-[9998] -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-5 py-2.5 text-lg font-semibold text-app-text"
      >
        {text}
      </div>
      <div role="status" className="sr-only">
        {announced}
      </div>
    </>
  );
}
