import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { HTMLMotionProps, Transition } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useTheme } from "../../context/useTheme";

export interface SpotlightCardProps extends HTMLMotionProps<"div"> {
    className?: string;
    /**
     * Corner radius utility (default `rounded-xl`).
     * Overridable so cards on large surfaces (dashboard widgets at `rounded-3xl`)
     * keep their radius when wrapped for tilt/glow.
     */
    roundedClassName?: string;
}

/**
 * A card wrapper that applies a dynamic "flashlight" gradient effect
 * based on cursor proximity, plus a subtle 3D perspective tilt.
 *
 * **3D tilt**: Subtle `rotateX`/`rotateY` perspective tilt follows the
 * cursor, with spring recoil.
 *
 * **Spotlight glow**: A radial gradient uses `var(--brand-glow)` so the
 * glow color adapts to light/dark themes automatically.
 *
 * **Toggleable**: Reads `isTiltEnabled` from ThemeContext — when disabled,
 * the tilt and spotlight are skipped (card renders as a plain surface).
 *
 * @example
 * ```tsx
 * <SpotlightCard>
 *   <p>Your content</p>
 * </SpotlightCard>
 * ```
 */
export function SpotlightCard({
    children,
    className = "",
    roundedClassName = "rounded-xl",
    onClick,
    style,
    ...props
}: SpotlightCardProps) {
    const { isTiltEnabled } = useTheme();

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Spring config: stiff so there's no wobble, soft enough to feel organic
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

        // Calculate tilt from center (-6° to +6° range)
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

    const spotlightOverlay = isTiltEnabled ? (
        <motion.div
                    className={`pointer-events-none absolute -inset-px ${roundedClassName} opacity-0 transition duration-300 group-hover:opacity-100 z-0`}
            style={{
                background: useMotionTemplate`radial-gradient(
                    500px circle at ${mouseX}px ${mouseY}px,
                    var(--brand-glow),
                    transparent 80%
                )`,
            }}
        />
    ) : null;

    return (
        <motion.div
            className={`group relative overflow-hidden ${roundedClassName} border border-app-border bg-app-surface transition-colors hover:border-app-brand-border-strong ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            style={{ ...tiltStyle, ...style }}
            {...props}
        >
            {/* Spotlight Gradient Overlay */}
            {spotlightOverlay}

            {/* Content Wrapper (z-index keeps text above spotlight) */}
            <div className="relative z-10 h-full w-full">
                {children as ReactNode}
            </div>
        </motion.div>
    );
}