import { useState, type ComponentType } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  ChartColumn,
  Database,
  MessageSquare,
  Rocket,
  Terminal,
} from "lucide-react";

export type SidebarIconProps = {
  /** True while this entry is the current route. */
  isActive: boolean;
};

export type SidebarIcon = ComponentType<SidebarIconProps>;

/**
 * Returns a key that changes every time `isActive` flips to true.
 *
 * Used as a React `key` on the animated parts so they remount and replay their
 * `initial -> animate` exactly once per activation. Far less bookkeeping than
 * driving a one-shot animation through variants and controls.
 *
 * Starts at `0`, which the icons read as "never activated in this session" and
 * use to skip `initial` entirely. Without that every icon would play its
 * animation on mount, so the whole sidebar would perform at once on each page
 * load -- including for the entry the user simply landed on.
 */
function usePlayOnActivate(isActive: boolean): number {
  const [wasActive, setWasActive] = useState(isActive);
  const [playCount, setPlayCount] = useState(0);

  // Derived during render: React discards this pass and re-runs it, so the
  // new key is in place for the very render that shows the active state.
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) {
      setPlayCount((current) => current + 1);
    }
  }

  return playCount;
}

const ICON_CLASS = "h-[18px] w-[18px] shrink-0";

/** Lucide's own stroke setup, so the drawn icons match the imported ones. */
const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * Wraps every animated icon.
 *
 * Keyed on `playKey`, so one activation remounts the whole drawing and its
 * children replay from their `initial` without each needing to manage a key of
 * its own. Also carries the shared pulse: the icon swells briefly while its
 * animation runs, which is what makes a small 18px drawing readable at a
 * glance.
 */
function IconFrame({
  playKey,
  hasPlayed,
  children,
}: {
  playKey: number;
  hasPlayed: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.svg
      key={playKey}
      viewBox="0 0 24 24"
      className={ICON_CLASS}
      aria-hidden="true"
      {...STROKE_PROPS}
      initial={hasPlayed ? { scale: 0.92 } : false}
      animate={hasPlayed ? { scale: [0.92, 1.22, 1] } : { scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.4, 1] }}
    >
      {children}
    </motion.svg>
  );
}

const bounce: Transition = { type: "spring", stiffness: 500, damping: 18 };

/** Dashboard: the three columns grow up out of the axis. */
export function DashboardIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <ChartColumn className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      {[
        { d: "M8 17v-3", delay: 0 },
        { d: "M13 17V5", delay: 0.07 },
        { d: "M18 17V9", delay: 0.14 },
      ].map((bar) => (
        <motion.path
          key={bar.d}
          d={bar.d}
          // Scaled from the axis line so the bars rise from their feet
          // instead of stretching around their middle.
          style={{ transformOrigin: "12px 17px", transformBox: "view-box" }}
          initial={hasPlayed ? { scaleY: 0.1 } : false}
          animate={{ scaleY: 1 }}
          transition={{ ...bounce, delay: bar.delay }}
        />
      ))}
    </IconFrame>
  );
}

/** Chat: three dots type themselves into the bubble. */
export function ChatIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <MessageSquare className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
      {[8, 12, 16].map((cx, index) => (
        <motion.circle
          key={cx}
          cx={cx}
          cy={11}
          r={1.1}
          fill="currentColor"
          stroke="none"
          initial={hasPlayed ? { opacity: 0, y: 2 } : false}
          animate={hasPlayed ? { opacity: [0, 1, 1, 0], y: 0 } : { opacity: 0 }}
          transition={{ duration: 1.1, delay: index * 0.13, times: [0, 0.25, 0.75, 1] }}
        />
      ))}
    </IconFrame>
  );
}

/** Knowledge Base: a page sweeps across the spine and settles. */
export function KnowledgeBaseIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <BookOpen className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />

      {/* The turning leaf. Squashed horizontally around the spine, which
                is what a page standing upright mid-turn looks like in profile. */}
      <motion.path
        d="M12 5a5 5 0 0 1 4-2h4v14h-4a5 5 0 0 0-4 2z"
        // Filled rather than outlined: a stroked leaf on top of a
        // stroked book is nearly invisible at 18px.
        fill="currentColor"
        strokeWidth={1}
        style={{ transformOrigin: "12px 12px", transformBox: "view-box" }}
        initial={hasPlayed ? { scaleX: 1, opacity: 0.85 } : false}
        animate={
          hasPlayed
            ? {
                // Overshoots past flat and settles, so the landing
                // on the left reads as a page dropping onto the
                // stack rather than sliding to a stop.
                scaleX: [1, 0.05, -1.12, -0.94, -1],
                opacity: [0.85, 0.85, 0.85, 0.85, 0],
              }
            : { opacity: 0 }
        }
        // Separate transitions per value. Sharing one spread the fade
        // evenly across the whole flip, so the page dissolved while it
        // was still travelling and looked like it gave up at the spine.
        // The arrival now gets more than half the runtime and the fade
        // only starts once the page has come to rest.
        transition={{
          scaleX: {
            duration: 1.15,
            times: [0, 0.34, 0.62, 0.78, 0.88],
            ease: "easeInOut",
          },
          opacity: { duration: 1.15, times: [0, 0.34, 0.62, 0.88, 1] },
        }}
      />

      <path d="M12 5v16" />
    </IconFrame>
  );
}

/** Onboarding: the rocket lifts off, echoing the app mark in the header. */
export function OnboardingIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <Rocket className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <motion.g
        initial={hasPlayed ? { x: -1.5, y: 1.5 } : false}
        animate={{ x: [-1.5, 1.5, 0], y: [1.5, -1.5, 0] }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      >
        {/* The exhaust is its own element inside the moving group, so
                    it travels with the rocket while guttering on its own -- a
                    plume that stayed rigid while the body flew would read as a
                    solid tail rather than fire. Scaled from where it meets the
                    hull so it flares outward instead of around its middle. */}
        <motion.path
          d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
          style={{ transformOrigin: "7px 17px", transformBox: "view-box" }}
          initial={hasPlayed ? { scale: 0.4, rotate: 0 } : false}
          animate={
            hasPlayed
              ? {
                  scale: [0.4, 1.35, 0.85, 1.2, 0.95, 1],
                  rotate: [0, -8, 5, -4, 2, 0],
                }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </motion.g>
    </IconFrame>
  );
}

/** Data Ingestion: the platters drop onto the stack, top last. */
export function DataIngestionIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <Database className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <motion.path
        d="M3 5V19A9 3 0 0 0 21 19V5"
        initial={hasPlayed ? { y: -5, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...bounce, delay: 0 }}
      />
      <motion.path
        d="M3 12A9 3 0 0 0 21 12"
        initial={hasPlayed ? { y: -5, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...bounce, delay: 0.08 }}
      />
      <motion.ellipse
        cx={12}
        cy={5}
        rx={9}
        ry={3}
        initial={hasPlayed ? { y: -6, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...bounce, delay: 0.16 }}
      />
    </IconFrame>
  );
}

/** PM Dashboard: the case rocks on its base when the entry is opened. */
export function PmDashboardIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <Briefcase className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      <motion.g
        // Pivoted at the foot of the case rather than its centre, so it
        // tips like a bag set down on a desk instead of spinning.
        style={{ transformOrigin: "12px 20px", transformBox: "view-box" }}
        initial={hasPlayed ? { rotate: 0 } : false}
        animate={hasPlayed ? { rotate: [0, -9, 7, -4, 2, 0] } : { rotate: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
      </motion.g>
    </IconFrame>
  );
}

/** Access Management: the prompt blinks, then a command types itself out. */
export function AdminIcon({ isActive }: SidebarIconProps) {
  const playKey = usePlayOnActivate(isActive);
  const hasPlayed = playKey > 0;
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <Terminal className={ICON_CLASS} />;

  return (
    <IconFrame playKey={playKey} hasPlayed={hasPlayed}>
      {/* The prompt arrow: a couple of quick blinks, the way a cursor
                sits waiting before anything is entered. */}
      <motion.path
        d="m4 17 6-6-6-6"
        initial={hasPlayed ? { opacity: 1 } : false}
        animate={hasPlayed ? { opacity: [1, 0.25, 1, 0.25, 1] } : { opacity: 1 }}
        transition={{ duration: 0.55, ease: "linear" }}
      />

      {/* The command line, drawn left to right from the prompt so it
                reads as typing rather than as a bar growing from its middle. */}
      <motion.path
        d="M12 19h8"
        style={{ transformOrigin: "12px 19px", transformBox: "view-box" }}
        initial={hasPlayed ? { scaleX: 0 } : false}
        animate={hasPlayed ? { scaleX: 1 } : { scaleX: 1 }}
        transition={{ duration: 0.35, delay: 0.5, ease: "easeOut" }}
      />
    </IconFrame>
  );
}
