import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { flybyGeometry } from "../flightGeometry.ts";
import { announceRocketFlight } from "../rocketWatch.ts";

interface RocketFlybyProps {
  onDone: () => void;
}

/** How long the pass takes, in seconds. */
const DURATION = 1.05;

/**
 * A rocket crossing the screen corner to corner — the beat that marks a step
 * being completed.
 *
 * Built as a transition rather than a decoration: it comes in small from the
 * bottom left, swells to most of the screen as it passes through the middle,
 * and shrinks away off the top right. For about a third of a second it is the
 * loudest thing on the page.
 *
 * What it still does not do is block. No backdrop, no dimming, `pointer-events:
 * none` throughout — the step flips to done underneath it at the same moment,
 * and that change has to remain visible while the rocket is over it.
 *
 * Two things are deliberately plain here, because a flyby that silently does
 * nothing is worse than no flyby at all:
 *
 * - **One motion element drives the flight.** Position, scale and fade all sit
 *   in a single `animate` on one node, sharing one `times` array. Splitting
 *   them across nested motion components means several independent animations
 *   that have to agree with each other, and any one of them failing to start
 *   leaves the rocket parked offscreen with nothing to show for it.
 * - **Rotation is a CSS transform on a plain div**, not a motion value. Mixing
 *   a static `style` transform with animated transforms on the same node makes
 *   Framer arbitrate between two sources for one property, which is a good way
 *   to end up with neither.
 */
export function RocketFlyby({ onDone }: RocketFlybyProps) {
  const [geometry] = useState(() => flybyGeometry(window.innerWidth, window.innerHeight));
  const rocketRef = useRef<HTMLDivElement>(null);

  // Teardown is on a timer rather than on `onAnimationComplete`. The callback
  // is the animation's own report card: if the animation never starts, it
  // never fires and the overlay stays mounted forever; if it fires early the
  // rocket vanishes before it is seen. A timer is answerable to neither.
  useEffect(() => {
    const timer = window.setTimeout(onDone, DURATION * 1000 + 200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  // Announces the pass, so anything with eyes on the page can turn and watch
  // it go by. Tied to mount rather than to the animation, for the same reason
  // the teardown is: the element existing is a fact, the animation running is
  // a hope.
  useEffect(() => {
    const rocket = rocketRef.current;
    if (!rocket) return;
    return announceRocketFlight(rocket);
  }, []);

  const { fromX, fromY, toX, toY, peakSize } = geometry;

  return createPortal(
    <div
      aria-hidden="true"
      data-testid="rocket-flyby"
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
    >
      {/* Light swell as the rocket passes through. Carries the "something
                just happened" without dimming the page the way a scrim would. */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: peakSize * 2,
          height: peakSize * 2,
          background: "radial-gradient(circle, var(--brand-glow) 0%, transparent 68%)",
        }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.6, 0.2], opacity: [0, 0.6, 0] }}
        transition={{ duration: DURATION, times: [0, 0.5, 1], ease: "easeInOut" }}
      />

      <motion.div
        ref={rocketRef}
        className="absolute"
        initial={{ x: fromX, y: fromY, scale: 0.25, opacity: 0 }}
        animate={{
          x: [fromX, fromX * 0.6, 0, toX * 0.6, toX],
          y: [fromY, fromY * 0.6, 0, toY * 0.6, toY],
          scale: [0.25, 0.6, 1, 0.6, 0.25],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: DURATION,
          times: [0, 0.2, 0.5, 0.8, 1],
          ease: "easeInOut",
        }}
      >
        {/* Plain CSS rotation: inside here "down" is straight back along
                    the flight path, which is where the trail belongs. */}
        <div
          className="relative flex items-center justify-center"
          style={{ transform: `rotate(${geometry.rotate}deg)` }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: Math.max(4, peakSize * 0.07),
              height: geometry.trailLength,
              top: peakSize * 0.42,
              background:
                "linear-gradient(180deg, var(--progress-fill-end), var(--brand) 35%, transparent)",
              filter: "blur(2px)",
            }}
          />

          <div
            className="relative text-app-brand"
            style={{ filter: "drop-shadow(0 0 28px var(--brand-glow))" }}
          >
            <RocketGlyph size={peakSize} flame />
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
