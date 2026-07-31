import type { Transition } from "framer-motion";

/**
 * Centralized Framer Motion spring transition presets.
 *
 * Use these for ALL `motion` components so the whole app shares one
 * "velocity" — elements bounce and settle at the same speed/stiffness.
 * Documented in `docs/animation_tokens.md`; implemented here as the single
 * source of truth.
 *
 * Usage:
 * ```tsx
 * import { centralSpringToken } from "@/styles/tokens";
 * <motion.div transition={centralSpringToken} ... />
 * ```
 */

/**
 * Default spring for layout transitions, list enter/exit, and general motion.
 * Snappy but not stiff — settles quickly without overshooting violently.
 */
export const centralSpringToken: Transition = {
    type: "spring",
    stiffness: 300,
    damping: 25,
    mass: 0.8,
};

/**
 * Lighter spring for hover/tap micro-interactions — faster, slightly bouncier.
 */
export const hoverSpringToken: Transition = {
    type: "spring",
    stiffness: 400,
    damping: 15,
};

/**
 * Spring for the macOS-dock style magnification of sidebar items.
 * Almost critically damped so items grow and shrink without wobbling
 * while the pointer sweeps across the navigation.
 */
export const dockMagnifySpringToken: Transition = {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.6,
};

/**
 * Spring for the sliding active indicator (shared `layoutId` pill).
 * Slightly stiffer than the default so the pill tracks a navigation
 * change quickly, with just enough softness to read as "liquid".
 */
export const slidingIndicatorSpringToken: Transition = {
    type: "spring",
    stiffness: 420,
    damping: 36,
    mass: 0.9,
};

/**
 * How long a `SidePanel` takes to slide in or out, in milliseconds.
 *
 * Single source of truth: the panel animation, how long `PanelPresence` keeps
 * a closing panel mounted, and the admin drawers' own close delay all derive
 * from this. Keeping them independent is what previously cut the slide off
 * halfway.
 */
export const SIDE_PANEL_SLIDE_MS = 420;

/**
 * Transition for the `SidePanel` slide.
 *
 * A tween rather than a spring: the panel is unmounted a fixed time after it
 * starts closing, so the motion has to be guaranteed finished by then, which
 * a spring cannot promise. The curve is the iOS sheet easing -- fast off the
 * mark, long soft settle.
 */
export const sidePanelSlideToken: Transition = {
    duration: SIDE_PANEL_SLIDE_MS / 1000,
    ease: [0.32, 0.72, 0, 1],
};
