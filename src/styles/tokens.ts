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
 * Spring for the sidebar's active pill, which travels much further than any
 * other indicator in the app.
 *
 * Split off from {@link slidingIndicatorSpringToken} because a spring settles
 * in the same time regardless of how far it has to go, which means the same
 * numbers do not feel the same over different distances. A segmented tab hops
 * about 100px; the sidebar pill runs the length of the nav, roughly 350px from
 * Dashboard to Access Management. On the shared token that journey peaks near
 * 7500px/s, and the pill reads as teleporting with a short blur rather than as
 * something that moved. Here it peaks around 5300px/s and settles in ~310ms
 * instead of ~200ms, which over that distance is the same *sensation* the
 * shared token gives a tab -- which is the point of a token, rather than the
 * same four numbers everywhere.
 *
 * Damped to zeta ~0.86, a little looser than the shared token's ~0.93. The
 * resulting overshoot is about half a percent: a couple of pixels on the long
 * journey, a fifth of a pixel between neighbouring rows. Not enough to see as
 * a bounce, just enough that the pill arrives with weight instead of stopping
 * dead on the mark.
 *
 * Do not reach for this on small indicators. Over a 100px hop it is simply
 * slow, and the shared token is right there.
 */
export const sidebarIndicatorSpringToken: Transition = {
  type: "spring",
  stiffness: 230,
  damping: 26,
  mass: 1,
};

/**
 * How long the sidebar's colours take to hand over while the pill above is in
 * flight, in milliseconds.
 *
 * One duration, used by the leaving row and the arriving row alike, and with
 * no delay on either. That symmetry is the whole specification, because it is
 * what makes the handover a crossfade instead of a cut: if both rows run the
 * same curve over the same window, the one fading out is at `1 - c(t)` exactly
 * when the one fading in is at `c(t)`, so the amount of "selected" on screen is
 * 1 at every instant. It holds for any easing, which is why the curve is left
 * to Tailwind's default and only the duration lives here.
 *
 * Two earlier versions each broke that sum in their own direction, and both
 * are worth knowing about before touching this again:
 *
 * - Originally there was no shared timing at all. The link text ran 200ms, the
 *   icon ran Tailwind's bare 150ms default, and the dot on the active row had
 *   no transition whatsoever and simply teleported between entries. Four
 *   elements, four timelines, one of them instant.
 *
 * - Then the two directions were split apart deliberately: the leaving row
 *   dropped its colour at once and the arriving row waited out a 110ms delay,
 *   on the theory that a row should not light up before the pill covers it.
 *   The theory was fine and the result was worse. The departure finished
 *   before the arrival began, so the total fell to 0.04 for about 60ms -- a
 *   window in which no entry in the sidebar was white, the dot had left one
 *   row without reaching the next, and the selection simply blinked from one
 *   place to the other. Sequencing two halves of one gesture reads as two
 *   events, not as a transition.
 *
 * 220ms sits comfortably inside the pill's ~310ms settle, so the colours are
 * resolved while the pill is still easing the last few pixels into place, and
 * the row is finished before the motion is.
 */
export const SIDEBAR_INDICATOR_COLOR_MS = 220;

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
 * Press feedback for buttons and other small controls.
 *
 * Spread onto a `motion.button` so every action in the app answers the pointer
 * the same way:
 *
 * ```tsx
 * <motion.button {...buttonHoverMotion} className="...">Save</motion.button>
 * ```
 *
 * **The scale never goes above 1, and that is the point.** This used to grow
 * the control to 1.03 on hover, with an underdamped spring that then sprang
 * past 1 again on release. A control sitting flush against the right end of a
 * toolbar has nothing to grow into: the extra sliver landed outside the
 * surrounding panel and was visibly sliced off — on the admin filters, and
 * again on the access view's add button. Hover feedback is carried by the
 * `hover:` colours every button variant already has, which no layout can clip.
 *
 * `dockMagnifySpringToken` rather than `hoverSpringToken` for the same reason:
 * it is damped to the point of not overshooting, so releasing a press returns
 * to the resting size from below instead of bouncing through it.
 *
 * Pass `disabled` controls `buttonHoverMotionDisabled` instead, so a dead
 * button also feels dead.
 */
export const buttonHoverMotion: {
  whileTap: TargetAndTransition;
  transition: Transition;
} = {
  whileTap: { scale: 0.97 },
  transition: dockMagnifySpringToken,
};

/** No-op counterpart to {@link buttonHoverMotion} for disabled controls. */
export const buttonHoverMotionDisabled = {
  whileTap: undefined,
  transition: dockMagnifySpringToken,
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

/**
 * Spring for celebration cards (knowledge check passed, phase unlocked,
 * onboarding finished). Deliberately under-damped compared to
 * `centralSpringToken`: the small overshoot is what makes the card feel like a
 * reward rather than another dialog. Reserve it for earned moments — using it
 * on routine UI cheapens both.
 */
export const celebrationSpringToken: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 18,
  mass: 0.9,
};

/** How long a rocket takes to cross the screen, in seconds. */
export const FLIGHT_DURATION_S = 1.15;

/**
 * Easing for things that fly alongside a rocket — exhaust trails, ignition
 * blooms. Starts hard and coasts out, so it reads as thrust rather than as a
 * panel sliding.
 *
 * The rocket itself does *not* use this. Its easing is baked into the keyframes
 * that `loopFlight` generates, because the shape of a loop and the speed along
 * it have to be decoupled; easing those keyframes a second time would ripple the
 * curve. Only `FLIGHT_DURATION_S` is shared, which is what keeps the trail and
 * the rocket in step.
 */
export const flightEaseToken: Transition = {
  duration: FLIGHT_DURATION_S,
  ease: [0.4, 0, 0.35, 1],
};

/**
 * Slow, endless breathing loop for idle decorative elements (the perched
 * rocket, ambient glows). Long enough that it never competes for attention.
 */
export const idleDriftToken: Transition = {
  duration: 3.4,
  repeat: Infinity,
  ease: "easeInOut",
};

/**
 * Spring for the rocket pet ducking behind the corner and leaning back out.
 *
 * Softer and heavier than `hoverSpringToken` on purpose. The pet is meant to be
 * caught out of the corner of the eye, and anything snappy enough to feel
 * responsive reads as a UI panel sliding — which is the one thing a creature
 * must not look like.
 */
export const petPeekSpringToken: Transition = {
  type: "spring",
  stiffness: 210,
  damping: 22,
  mass: 0.9,
};

/**
 * Shared enter transition for page-level elements (AuroraBackground, etc.).
 * A smooth tween ease — not a spring, so it pairs well with CSS-only layers.
 */
export const enterTransition: Transition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
};
