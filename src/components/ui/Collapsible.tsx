import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";

/**
 * How a fold opens and closes.
 *
 * A tween rather than one of the app's springs, deliberately. Height is the one property a spring
 * flatters least: the overshoot at the end of a spring makes a panel bounce past its own last line
 * and settle back, which reads as the layout being unsure of itself. The curve is a strong ease-out
 * — quick to commit, slow to arrive — so the fold feels answered the instant it is asked for and
 * still lands softly.
 */
const FOLD: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

type CollapsibleProps = {
  open: boolean;
  children: ReactNode;
};

/**
 * Content that folds away to nothing and back, on the app's one fold curve.
 *
 * Everything on the board that folds — a card, an area, a stage band — used to do it by rendering
 * its contents or not, so a fold was a jump: the page reflowed in a single frame and everything
 * below it teleported. The information was right and the reading was gone; you could not tell
 * whether something had collapsed, moved, or disappeared.
 *
 * **The clip is only on while the height is moving.** `overflow-hidden` is what makes a height
 * animation look like a fold rather than a squash, and it is also what would cut the corner off
 * anything that deliberately leaves its box — a card's hover shadow, the fanned sheets under a
 * pile. So it goes on when the animation starts and comes off when it ends, which is exactly the
 * window where it is needed and no longer.
 */
export function Collapsible({ open, children }: CollapsibleProps) {
  const reduceMotion = useReducedMotion();
  const [clipping, setClipping] = useState(false);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : FOLD}
          onAnimationStart={() => setClipping(true)}
          onAnimationComplete={() => setClipping(false)}
          className={clipping ? "overflow-hidden" : undefined}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
