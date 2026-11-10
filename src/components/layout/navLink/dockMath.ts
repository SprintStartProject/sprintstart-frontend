/**
 * Scale applied to the item directly under the pointer.
 *
 * Bound to the sidebar geometry: the item grows rightwards from a fixed left
 * edge, so this and the nav's inner padding decide together where it lands.
 * At 286px wide with 24px padding an item is 238px, and 1.06 leaves it about
 * 10px short of the border. Raising either number eats that gap -- 1.12 at the
 * same padding would put the item 5px past the sidebar edge.
 */
const DOCK_HOVER_SCALE = 1.06;

/**
 * How far from an item's centre the pointer still lifts it, in pixels.
 *
 * Roughly two rows at the 40px row height, so a sweep has two or three items
 * responding at once and the magnification travels as a wave rather than
 * jumping between neighbours.
 */
export const DOCK_INFLUENCE_RADIUS_PX = 96;

/**
 * Radius of the *tint* falloff: exactly one row pitch, 40px of row plus the
 * 5px gap the nav puts between them.
 *
 * Deliberately far tighter than the lift radius above, and the split is the
 * point. Movement and colour were answering two different questions on one
 * number: the lift says "the pointer is near", which is worth saying across
 * several rows, while the fill says "this is the row you would click", which
 * is only true of one. Run at 96px the fill lit five rows at once, and five
 * lit rows beside one brand-filled one is six things claiming to be the
 * highlight -- the ambiguity the feedback reported. The dock wave is untouched
 * here; only the colour was pulled in.
 *
 * One pitch specifically, because of the identity `cos²x + sin²x = 1`. A row
 * at distance `d` shows `cos²(d/P · π/2)`; its neighbour, being `P - d` away,
 * shows `sin²(d/P · π/2)`, and the two always sum to exactly 1. So within a
 * section the sidebar carries precisely one row's worth of tint, split between
 * at most two adjacent rows, and the highlight travels from one to the next
 * without the total ever dipping. Tightening it further overcorrects: at 30px
 * both rows sit at 0.15 midway between them, and the highlight visibly blinks
 * out in the gap.
 *
 * Between sections the partition does not hold, and should not. `SideBar` puts
 * 20px of padding plus a heading there, so the rows either side are far more
 * than one pitch apart and the tint drops to nothing in between. That is the
 * honest answer: the pointer is over a heading, and no row is the one you
 * would click. The lift still spans the gap on its wider radius, so the sweep
 * itself stays continuous -- it is only the claim about *which row* that goes
 * quiet, which is the one claim that has nothing to say there.
 */
export const NAV_ROW_PITCH_PX = 45;

/**
 * Squaring the cosine is what makes the handoff exact rather than approximate
 * -- see the identity in {@link NAV_ROW_PITCH_PX}. It is not a shoulder tweak,
 * and changing it breaks the constant-total property that keeps the tint from
 * dipping between rows.
 */
export const DOCK_TINT_FALLOFF_EXPONENT = 2;

/**
 * Spring for the magnification.
 *
 * Far stiffer and lighter than the app's usual hover spring. This one is not
 * decoration -- it sits between the pointer and the scale, so any softness in
 * it is felt as the item lagging behind the cursor. At this setting it settles
 * inside a couple of frames, which keeps a fast sweep tracking the pointer
 * while a leave still eases out rather than snapping.
 */
export const DOCK_TRACKING_SPRING = {
  stiffness: 1400,
  damping: 45,
  mass: 0.25,
};

/**
 * How far the item slides towards the content, at full influence.
 *
 * Kept small against the geometry above: an entry already grows ~14px
 * rightwards at 1.06, and this comes out of the same gap to the sidebar edge.
 */
const DOCK_NUDGE_PX = 4;

/**
 * How much of the row's hover tint is showing, at full influence.
 *
 * Full strength, because the curve above already guarantees the sidebar shows
 * one row's worth of tint in total, shared by the two adjacent rows it spans;
 * holding it back would only mean the highlight is never quite fully on.
 */
const DOCK_TINT_OPACITY = 1;

/**
 * How much faster the hover ring fades than the fill it sits in.
 *
 * The fill is deliberately spread across two rows so the highlight never dips
 * while travelling, but an *outline* smeared across two rows is a different
 * thing entirely -- it reads as two boxes rather than one moving one. Raising
 * the ring to a power collapses it towards whichever row the pointer has
 * actually settled on, so the edge only exists once there is a single row for
 * it to be an edge of.
 */
const DOCK_RING_SHARPNESS_EXPONENT = 2;

/**
 * How strongly this item is affected by the pointer, from 0 to 1.
 *
 * Cosine rather than a straight ramp: a linear falloff has a visible corner
 * where the influence starts, and the corner is what makes a slow pass feel
 * mechanical.
 *
 * Takes its radius and shoulder from the caller so the lift and the tint can
 * run the same curve at two different widths -- one number per effect, but the
 * same shape, so the tint stays centred on the row the lift peaks at and the
 * row still moves as one thing.
 */
export function getInfluence(pointerY: number, centerY: number, radiusPx: number, exponent = 1) {
  const distance = Math.abs(pointerY - centerY);

  if (!Number.isFinite(distance) || distance >= radiusPx) {
    return 0;
  }

  return Math.cos((distance / radiusPx) * (Math.PI / 2)) ** exponent;
}

/** The scale of the entry under a given lift influence (0 to 1). */
export function liftScale(influence: number): number {
  return 1 + (DOCK_HOVER_SCALE - 1) * influence;
}

/** How far the entry slides towards the content at a given lift influence. */
export function liftNudge(influence: number): number {
  return influence * DOCK_NUDGE_PX;
}

/** How much of the row's hover tint shows at a given tint value. */
export function tintOpacityOf(tint: number): number {
  return tint * DOCK_TINT_OPACITY;
}

/**
 * Nested inside the fill, so this multiplies with the fill's opacity rather than replacing it: the
 * ring effectively runs the tint cubed. Mid-handoff that puts it at an eighth while the fill sits at
 * a half, so crossing between rows is a single patch of light moving, not two outlined boxes fading
 * past each other. It arrives once the pointer has settled on a row, which is the only moment an
 * edge is worth drawing.
 */
export function ringOpacityOf(tint: number): number {
  return tint ** DOCK_RING_SHARPNESS_EXPONENT;
}
