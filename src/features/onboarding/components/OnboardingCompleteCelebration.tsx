// ============================================================
// OnboardingCompleteCelebration.tsx
// ============================================================
// Full-screen celebration shown once the user passes the final
// phase's knowledge check: falling confetti plus an "on board"
// card. Confetti is built with Framer Motion (already in the
// stack) so no extra dependency is needed.
// ============================================================

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PartyPopper } from "lucide-react";

interface OnboardingCompleteCelebrationProps {
  /** Dismisses the celebration overlay (button, backdrop or Escape). */
  onDismiss: () => void;
}

// Palette-only confetti colors so the celebration matches the app in light/dark.
const CONFETTI_COLORS = [
  "bg-app-brand",
  "bg-app-success-solid",
  "bg-app-warning-solid",
  "bg-app-danger-solid",
  "bg-app-progress-fill-end",
];

const CONFETTI_COUNT = 70;

/** One confetti piece's layout/animation values. */
interface ConfettiPiece {
  left: number; // start x, in %
  drift: number; // horizontal drift, in vw
  delay: number; // s
  duration: number; // s
  rotate: number; // total spin, in deg
  color: string;
  square: boolean; // square vs. rounded piece for a bit of variety
}

/**
 * Deterministic pseudo-random in [0, 1) from a seed. Kept pure (no `Math.random`)
 * so the confetti can be built during render without breaking React's purity rule;
 * the spread still looks organic across the 70 pieces.
 */
function seeded(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Celebration overlay for finishing the whole onboarding path.
 *
 * Respects `prefers-reduced-motion`: the confetti animation is skipped for users
 * who opted out, leaving just the static "on board" card.
 */
export function OnboardingCompleteCelebration({
  onDismiss,
}: OnboardingCompleteCelebrationProps) {
  const reduceMotion = useReducedMotion();

  const pieces = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        left: seeded(i) * 100,
        drift: (seeded(i + 100) - 0.5) * 30,
        delay: seeded(i + 200) * 0.6,
        duration: 2.6 + seeded(i + 300) * 1.8,
        rotate: (seeded(i + 400) - 0.5) * 720,
        color: CONFETTI_COLORS[Math.floor(seeded(i + 500) * CONFETTI_COLORS.length)],
        square: seeded(i + 600) > 0.5,
      })),
    [],
  );

  // Dismiss on Escape, matching the shared Modal's behavior.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-6 backdrop-blur-md">
      {/* Backdrop dismiss button (keeps the overlay keyboard-accessible). */}
      <button
        type="button"
        aria-label="Dismiss celebration"
        onClick={onDismiss}
        className="absolute inset-0"
      />

      {/* Confetti layer (skipped when the user prefers reduced motion). */}
      {!reduceMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {pieces.map((piece, index) => (
            <motion.span
              key={index}
              className={`absolute top-0 h-2.5 w-2.5 ${piece.color} ${
                piece.square ? "rounded-[2px]" : "rounded-full"
              }`}
              style={{ left: `${piece.left}%` }}
              initial={{ y: "-10vh", opacity: 1, rotate: 0 }}
              animate={{
                y: "110vh",
                x: `${piece.drift}vw`,
                rotate: piece.rotate,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: "easeIn",
                times: [0, 0.85, 1],
              }}
            />
          ))}
        </div>
      )}

      {/* "On board" card */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding complete"
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative z-10 max-w-md rounded-3xl border border-app-brand-border bg-app-surface p-8 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-app-brand-soft">
          <PartyPopper className="h-8 w-8 text-app-brand" />
        </div>
        <h2 className="text-2xl font-bold text-app-text">You&apos;re on board! 🎉</h2>
        <p className="mt-2 text-sm text-app-text-muted">
          You passed the final knowledge check and completed every phase of your
          onboarding journey. Great work!
        </p>
        <button
          onClick={onDismiss}
          className="mt-6 px-6 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
        >
          Awesome
        </button>
      </motion.div>
    </div>
  );
}
