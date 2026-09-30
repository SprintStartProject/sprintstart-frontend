import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RingGaugeProps = {
  /** 0–100. */
  value: number;
  size?: number;
  thickness?: number;
  /** A `text-app-*` utility for the filled arc. */
  colorClassName?: string;
  /** Replaces the percentage in the middle. */
  children?: ReactNode;
  ariaLabel: string;
};

/**
 * One share of a whole as a ring — the headline figure of a card, not a chart of categories.
 * The arc animates from empty on mount, and the number in the middle is the value itself.
 */
export function RingGauge({
  value,
  size = 96,
  thickness = 9,
  colorClassName = "text-app-brand",
  children,
  ariaLabel,
}: RingGaugeProps) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-app-progress-track"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={colorClassName}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        {children ?? (
          <span className="text-xl leading-none font-bold text-app-text">
            {Math.round(clamped)}%
          </span>
        )}
      </div>
    </div>
  );
}
