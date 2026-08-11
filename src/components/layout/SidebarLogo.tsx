import { motion, useReducedMotion, type Variants } from "framer-motion";

const BADGE_SIZE = 44;
const MARK_SIZE = 28;

/**
 * Where the exhaust meets the body, in viewBox units. The flame scales from
 * here so the plume grows away from the engine instead of stretching from its
 * own middle.
 */
const NOZZLE_ORIGIN = { transformOrigin: "7px 17px", transformBox: "view-box" } as const;

/**
 * The app mark in the sidebar header.
 *
 * The rocket outline is Lucide's own path data, so it reads exactly as it did
 * before. What changed is the exhaust: Lucide draws it as one more stroke of
 * the icon, which leaves nothing to animate and no defined opening to animate
 * from. Here that same shape is a separate element with the flames layered on
 * it, all inside one viewBox -- so the plume sits at the nozzle by
 * construction, scales with the mark, and needs no pixel arithmetic pinning
 * outside elements to an SVG.
 *
 * At rest the exhaust is drawn in white, identical to the original icon. Hover
 * cross-fades it into a lit flame. Hover-only on purpose: a permanent flicker
 * in the corner of the eye stops reading as charm and starts reading as a
 * fault.
 */
export function SidebarLogo({ className = "" }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  const badgeVariants: Variants = prefersReducedMotion
    ? { rest: {}, lift: {} }
    : {
        rest: { scale: 1 },
        lift: {
          scale: 1.08,
          transition: { type: "spring", stiffness: 400, damping: 16 },
        },
      };

  const rocketVariants: Variants = prefersReducedMotion
    ? { rest: {}, lift: {} }
    : {
        rest: {
          x: [0, 0.6, 0],
          y: [0, -1.2, 0],
          transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
        },
        // Up and to the right, along the axis this rocket points.
        lift: {
          x: 1.5,
          y: -1.5,
          transition: { type: "spring", stiffness: 420, damping: 14 },
        },
      };

  const exhaustVariants: Variants = {
    rest: { opacity: 1 },
    lift: { opacity: 0, transition: { duration: 0.12 } },
  };

  /**
   * Per-value transitions, not one for the whole variant.
   *
   * A single `repeat: Infinity` applies to every value in the variant, so the
   * opacity 0 -> 1 looped along with the flicker and reset the flame to
   * invisible on every cycle. Only the scale should repeat; the fade in
   * happens once.
   */
  const makeFlameVariants = (delay: number): Variants =>
    prefersReducedMotion
      ? { rest: { opacity: 0 }, lift: { opacity: 1, scale: 1 } }
      : {
          rest: { opacity: 0, scale: 0.3 },
          lift: {
            opacity: 1,
            scale: [0.85, 1.15, 0.95, 1.1, 0.9],
            transition: {
              opacity: { duration: 0.12 },
              scale: {
                duration: 0.42,
                delay,
                repeat: Infinity,
                ease: "easeInOut",
              },
            },
          },
        };

  const outerFlameVariants = makeFlameVariants(0);
  const innerFlameVariants = makeFlameVariants(0.06);

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="lift"
      variants={badgeVariants}
      style={{ width: BADGE_SIZE, height: BADGE_SIZE }}
      className={`relative flex shrink-0 items-center justify-center rounded-[12px] bg-app-brand shadow-lg ${className}`}
    >
      <motion.svg
        variants={rocketVariants}
        width={MARK_SIZE}
        height={MARK_SIZE}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <motion.path
          variants={outerFlameVariants}
          style={{ ...NOZZLE_ORIGIN }}
          d="M3.2 15.8c-2.6 2.2-3.4 8-3.4 8s5.8-.8 8-3.4c1.2-1.4 1.1-3.5-.2-4.8a3.7 3.7 0 0 0-4.4.2z"
          className="fill-orange-500"
        />

        <motion.path
          variants={innerFlameVariants}
          style={{ ...NOZZLE_ORIGIN }}
          d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
          strokeWidth={1.4}
          strokeLinejoin="round"
          className="fill-amber-300 stroke-amber-300"
        />

        {/* Lucide's exhaust stroke, shown while idle so the mark is the
                    familiar icon until the thrusters light. */}
        <motion.path
          variants={exhaustVariants}
          d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white"
        />

        <g
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white"
        >
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </g>
      </motion.svg>
    </motion.div>
  );
}
