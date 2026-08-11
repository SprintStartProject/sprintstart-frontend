// ============================================================
// CheckPassCelebration.tsx
// ============================================================
// Celebratory result banner shown when a knowledge check is
// passed: the banner springs in and a trophy pops. The confetti
// that goes with it is a separate center-screen ConfettiBurst,
// so the two do not compete for attention.
// ============================================================

import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { centralSpringToken, hoverSpringToken } from "../../../styles/tokens";

interface CheckPassCelebrationProps {
  correctCount: number;
  questionCount: number;
  /** Shown under the headline, e.g. that the next phase is now unlocked. */
  detail?: string;
}

/**
 * Success banner for a passed knowledge check.
 *
 * Respects `prefers-reduced-motion`: the spring entrance is skipped for users who
 * opted out, leaving the same banner as a static element.
 */
export function CheckPassCelebration({
  correctCount,
  questionCount,
  detail,
}: CheckPassCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const percentage = Math.round((correctCount / Math.max(questionCount, 1)) * 100);

  return (
    <motion.div
      className="mb-6 rounded-2xl border border-app-success-solid/30 bg-app-success-bg p-4 flex items-center gap-4"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={centralSpringToken}
    >
      <motion.div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-success-solid/15"
        initial={reduceMotion ? false : { scale: 0.4, rotate: -18 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...hoverSpringToken, delay: reduceMotion ? 0 : 0.12 }}
      >
        <Trophy className="h-6 w-6 text-app-success-solid" />
      </motion.div>
      <div className="min-w-0">
        <div className="font-semibold text-app-text text-sm">Check passed — nice work!</div>
        <div className="text-xs text-app-text-muted mt-0.5">
          {correctCount}/{questionCount} correct ({percentage}%).
          {detail ? ` ${detail}` : ""}
        </div>
      </div>
    </motion.div>
  );
}
