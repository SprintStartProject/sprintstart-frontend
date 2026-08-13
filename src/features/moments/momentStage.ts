/**
 * Where the page-scoped moments play.
 *
 * The onboarding launch and landing used to take the whole screen; now they
 * cover only the app's content area, so the sidebar stays put and the takeover
 * reads as the *page* doing something rather than the app being replaced. The
 * area is found by attribute rather than handed down as props, because the
 * moments render from `MomentsProvider` — nowhere near the layout — and
 * threading a rect through every level in between would couple the whole tree
 * to two animations.
 */

/** Marks the element the page-scoped moments should cover. Set on `<main>`. */
export const MOMENT_STAGE_ATTRIBUTE = "data-moment-stage";

export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Below this, the measured stage is treated as broken and the moment falls
 * back to the viewport. A stage this small is not a layout choice — it is a
 * hidden or collapsed element, and pinning a launch to it would play the whole
 * thing inside a sliver.
 */
const MIN_STAGE_PX = 200;

/**
 * Resolves the visible slice of the stage element, in viewport coordinates.
 *
 * Clipped against the viewport on purpose: the stage lives in the scrolling
 * document, so with the page scrolled down its rect starts above the screen —
 * and a fixed overlay pinned to a negative `top` would hang off the visible
 * area by exactly that much.
 *
 * Falls back to the full viewport when no stage is marked (Storybook, tests)
 * or the marked one is degenerate. The fallback is the old full-screen
 * behaviour, which is always safe — the scoping is a refinement, never a
 * requirement.
 */
export function momentStageRect(): StageRect {
  const viewport: StageRect = {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const stage = document.querySelector(`[${MOMENT_STAGE_ATTRIBUTE}]`);
  if (!stage) return viewport;

  const rect = stage.getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const width = Math.min(rect.right, viewport.width) - left;
  const height = Math.min(rect.bottom, viewport.height) - top;

  if (width < MIN_STAGE_PX || height < MIN_STAGE_PX) return viewport;

  return { left, top, width, height };
}
