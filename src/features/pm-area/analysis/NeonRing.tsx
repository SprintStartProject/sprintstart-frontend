import { motion, useReducedMotion } from "framer-motion";
import { useId, type ReactNode } from "react";

type NeonRingProps = {
  /** 0–100: how much of the ring is lit. */
  value: number;
  size?: number;
  /** A comet of light circles the ring while something is running. */
  active?: boolean;
  /** CSS colour the lit arc ends in — a palette variable. The arc starts in the app's progress gradient. */
  accent?: string;
  children?: ReactNode;
};

/**
 * The analysis's centrepiece: a hollow ring of light, lit as far as its value reaches.
 *
 * A ring rather than a sphere — the reference's neon halo — so the middle stays free for the
 * figure it frames (the scan's progress, the project's health). Three layers: a faint track, the
 * lit arc in a brand-to-accent gradient, and the same arc blurred wide behind it for the glow.
 * While `active`, a short bright comet runs round the track. Stands still under reduced motion.
 */
export function NeonRing({
  value,
  size = 200,
  active = false,
  accent = "var(--brand-text)",
  children,
}: NeonRingProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const stroke = Math.max(5, size * 0.035);
  const radius = size / 2 - stroke * 3;
  const circumference = 2 * Math.PI * radius;
  const lit = Math.min(100, Math.max(0, value)) / 100;
  const center = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="absolute inset-0 -rotate-90 overflow-visible"
      >
        <defs>
          <linearGradient id={`${uid}-arc`} x1="0" y1="0" x2="1" y2="1">
            {/* The same blue-to-indigo the app's progress bars and brand badges use. */}
            <stop offset="0%" style={{ stopColor: "var(--progress-fill)" }} />
            <stop offset="55%" style={{ stopColor: "var(--progress-fill-end)" }} />
            <stop offset="100%" style={{ stopColor: accent }} />
          </linearGradient>
          <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stroke * 1.6} />
          </filter>
        </defs>

        {/* Inner haze, so the ring reads as light rather than a line drawing. */}
        <circle
          cx={center}
          cy={center}
          r={radius - stroke}
          style={{ fill: "var(--brand)" }}
          opacity={0.05}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "var(--border-muted)" }}
          opacity={0.45}
        />
        {/* The glow: the lit arc again, wide and blurred. */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke * 2.6}
          strokeLinecap="round"
          stroke={`url(#${uid}-arc)`}
          strokeDasharray={circumference}
          filter={`url(#${uid}-blur)`}
          opacity={0.5}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - lit) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${uid}-arc)`}
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - lit) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {active && !reduceMotion && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke * 0.9}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.06} ${circumference}`}
            style={{ stroke: "var(--brand-border-strong)", originX: "50%", originY: "50%" }}
            filter={`url(#${uid}-blur)`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
