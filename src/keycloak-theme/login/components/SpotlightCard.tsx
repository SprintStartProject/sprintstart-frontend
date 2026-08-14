import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { HTMLMotionProps, Transition } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";

const TILT_STORAGE_KEY = "sprintstart:tilt-enabled";

/**
 * Mirrors `ThemeProvider`'s `getInitialTiltEnabled` (default off), without
 * needing the provider itself — see `AuroraBackground.tsx` in this same
 * folder for why reading the app's `localStorage` key directly is safe here.
 */
function readIsTiltEnabled(): boolean {
  try {
    return window.localStorage.getItem(TILT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export interface SpotlightCardProps extends HTMLMotionProps<"div"> {
  className?: string;
  /**
   * Corner radius utility, forwarded to the spotlight overlay so its rounding
   * matches the card's. Default `rounded-xl`, same as the app's version —
   * the login card passes `rounded-3xl` to match `.card-pf`'s 1.5rem radius.
   */
  roundedClassName?: string;
}

/**
 * Login-theme port of the app's `SpotlightCard`
 * (src/components/ui/SpotlightCard.tsx): same cursor-follow spotlight glow
 * and 3D perspective tilt, minus the `ThemeContext` dependency — there is no
 * `ThemeProvider` around the Keycloak login root, so `isTiltEnabled` is read
 * directly from the same `localStorage` key instead (default off, exactly
 * like the app).
 *
 * Meant to wrap the *existing* PatternFly card element (pass
 * `kcClsx("kcFormCardClass")` as `className`) rather than replace it — it
 * adds no border/background classes of its own, so `.card-pf` in login.css
 * keeps owning that, and the card doesn't end up with two nested borders.
 */
export function SpotlightCard({
  children,
  className = "",
  roundedClassName = "rounded-xl",
  onClick,
  style,
  ...props
}: SpotlightCardProps) {
  const [isTiltEnabled] = useState(() => readIsTiltEnabled());

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig: Transition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
  };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    mouseX.set(x);
    mouseY.set(y);

    if (!isTiltEnabled) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxTilt = 6;
    rotateX.set(((y - centerY) / centerY) * -maxTilt);
    rotateY.set(((x - centerX) / centerX) * maxTilt);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  const tiltStyle = isTiltEnabled
    ? { rotateX, rotateY, transformPerspective: 800 as const }
    : {};

  const spotlightBackground = useMotionTemplate`radial-gradient(
                500px circle at ${mouseX}px ${mouseY}px,
                var(--brand-glow),
                transparent 80%
            )`;

  const spotlightOverlay = isTiltEnabled ? (
    <motion.div
      className={`pointer-events-none absolute -inset-px ${roundedClassName} opacity-0 transition duration-300 group-hover:opacity-100 z-0`}
      style={{ background: spotlightBackground }}
    />
  ) : null;

  return (
    <motion.div
      className={`group relative overflow-hidden ${roundedClassName} ${className}`.trim()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ ...tiltStyle, ...style }}
      {...props}
    >
      {spotlightOverlay}

      <div className="relative z-10 h-full w-full">{children as ReactNode}</div>
    </motion.div>
  );
}
