// ============================================================
// ConfettiBurst.tsx
// ============================================================
// One-shot confetti explosion from the middle of the screen,
// used to mark a passed knowledge check. Sits above the modal
// layer and removes itself once the animation is over, so it
// never traps clicks or lingers in the DOM.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

// Palette-only colors so the burst matches the app in light/dark.
const CONFETTI_COLORS = [
  "bg-app-brand",
  "bg-app-success-solid",
  "bg-app-warning-solid",
  "bg-app-progress-fill-end",
];

const CONFETTI_COUNT = 36;

/** Slightly longer than the slowest piece, so nothing is cut off mid-flight. */
const CLEANUP_DELAY_MS = 1800;

/** One piece's flight path, radiating out from the center. */
interface BurstPiece {
  dx: number; // horizontal travel, in px
  dy: number; // vertical travel, in px
  drop: number; // extra fall at the end, in px
  duration: number; // s
  delay: number; // s
  rotate: number; // total spin, in deg
  color: string;
}

/**
 * Deterministic pseudo-random in [0, 1) from a seed. Pure (no `Math.random`) so the
 * burst can be built during render without breaking React's purity rule.
 */
function seeded(seed: number): number {
  const value = Math.sin(seed * 63.7 + 19.3) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Center-screen confetti explosion.
 *
 * Renders nothing for users who prefer reduced motion, and nothing after the burst
 * has finished — mounting it is all that is needed to fire it once.
 */
export function ConfettiBurst() {
  const reduceMotion = useReducedMotion();
  const [finished, setFinished] = useState(false);

  const pieces = useMemo<BurstPiece[]>(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        // Spread the pieces evenly around the circle, then jitter so the ring
        // does not look mechanical.
        const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (seeded(i) - 0.5) * 0.4;
        const distance = 120 + seeded(i + 10) * 180;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          drop: 40 + seeded(i + 20) * 70,
          duration: 1.0 + seeded(i + 30) * 0.5,
          delay: seeded(i + 40) * 0.1,
          rotate: (seeded(i + 50) - 0.5) * 720,
          color: CONFETTI_COLORS[Math.floor(seeded(i + 60) * CONFETTI_COLORS.length)],
        };
      }),
    [],
  );

  useEffect(() => {
    if (reduceMotion) return;
    const timeout = window.setTimeout(() => setFinished(true), CLEANUP_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  if (reduceMotion || finished) return null;

  // Rendered into <body> so neither the modal's `overflow-hidden` nor the overlay's
  // backdrop-filter (which makes a containing block for fixed children) can clip the
  // burst. z-[60] keeps it above the modal layer at z-50.
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className={`absolute top-1/2 left-1/2 h-2 w-2 rounded-[2px] ${piece.color}`}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: [1, 1, 0],
            x: piece.dx,
            y: [0, piece.dy, piece.dy + piece.drop],
            scale: 0.7,
            rotate: piece.rotate,
          }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>,
    document.body,
  );
}
