import type { TargetAndTransition, Transition, Variants } from "framer-motion";

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

/**
 * Hover and press feedback for buttons and other small controls.
 *
 * Spread onto a `motion.button` so every action in the app answers the pointer
 * the same way:
 *
 * ```tsx
 * <motion.button {...buttonHoverMotion} className="...">Save</motion.button>
 * ```
 *
 * Deliberately gentler than the sidebar's dock magnification (1.03 rather than
 * 1.12): buttons sit inside dense toolbars and rows, where a large scale would
 * collide with neighbours or push a layout around.
 *
 * Pass `disabled` controls `buttonHoverMotionDisabled` instead, so a dead
 * button also feels dead.
 */
export const buttonHoverMotion: {
    whileHover: TargetAndTransition;
    whileTap: TargetAndTransition;
    transition: Transition;
} = {
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.97 },
    transition: hoverSpringToken,
};

/** No-op counterpart to {@link buttonHoverMotion} for disabled controls. */
export const buttonHoverMotionDisabled = {
    whileHover: undefined,
    whileTap: undefined,
    transition: hoverSpringToken,
};

/**
 * Backdrop fade shared by every dialog in the app.
 *
 * Leaves slightly faster than it arrives, so the page behind is uncovered
 * promptly once the user has decided to dismiss.
 */
export const modalBackdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, transition: { duration: 0.16, ease: "easeIn" } },
};

/**
 * Motion for a dialog surface, shared by `Modal` and by the dialogs that hand
 * roll their own markup (the game modals, the artifact upload). Use this rather
 * than inlining `initial`/`animate`/`exit` so every dialog in the app opens
 * with the same weight.
 *
 * Enter is a spring -- it should feel like the dialog has mass and settles.
 * Exit is a short tween: dismissing must never feel like waiting, and a spring
 * always spends time easing out that the user reads as lag.
 */
export function getModalDialogVariants(prefersReducedMotion: boolean): Variants {
    if (prefersReducedMotion) {
        return {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.15 } },
            exit: { opacity: 0, transition: { duration: 0.12 } },
        };
    }

    return {
        hidden: { opacity: 0, scale: 0.96, y: 12 },
        visible: { opacity: 1, scale: 1, y: 0, transition: centralSpringToken },
        exit: {
            opacity: 0,
            scale: 0.98,
            y: 6,
            transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
        },
    };
}
