import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { SidebarIcon } from "./SidebarNavIcons";
import { slidingIndicatorSpringToken } from "../../styles/tokens";

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
const DOCK_INFLUENCE_RADIUS_PX = 96;

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
const NAV_ROW_PITCH_PX = 45;

/**
 * Squaring the cosine is what makes the handoff exact rather than approximate
 * -- see the identity in {@link NAV_ROW_PITCH_PX}. It is not a shoulder tweak,
 * and changing it breaks the constant-total property that keeps the tint from
 * dipping between rows.
 */
const DOCK_TINT_FALLOFF_EXPONENT = 2;

/**
 * Spring for the magnification.
 *
 * Far stiffer and lighter than the app's usual hover spring. This one is not
 * decoration -- it sits between the pointer and the scale, so any softness in
 * it is felt as the item lagging behind the cursor. At this setting it settles
 * inside a couple of frames, which keeps a fast sweep tracking the pointer
 * while a leave still eases out rather than snapping.
 */
const DOCK_TRACKING_SPRING = {
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
 * one row's worth of tint in total. It used to be held back to 0.9 so the row
 * under the pointer could stay brighter than the four others the wide radius
 * lit up; with the tint spanning two adjacent rows that share a single row's
 * worth between them, there is nothing left to out-rank, and holding it back
 * would only mean the highlight is never quite fully on.
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
function getInfluence(pointerY: number, centerY: number, radiusPx: number, exponent = 1) {
  const distance = Math.abs(pointerY - centerY);

  if (!Number.isFinite(distance) || distance >= radiusPx) {
    return 0;
  }

  return Math.cos((distance / radiusPx) * (Math.PI / 2)) ** exponent;
}

type SidebarNavLinkProps = {
  to: string;
  label: string;
  icon: SidebarIcon;
  /** Matches the route exactly (used for the `/` dashboard entry). */
  end?: boolean;
  /**
   * Shared `layoutId` of the active pill. Must be unique per rendered
   * sidebar instance so the desktop and mobile sidebars do not fight over
   * the same shared-layout element.
   */
  indicatorLayoutId: string;
  /** Highlights the entry even when the exact route does not match (section parents). */
  forceActive?: boolean;
  /**
   * Viewport y of the pointer over the sidebar, or `-Infinity` while it is
   * outside. Shared by every entry so each can work out its own distance.
   */
  pointerY: MotionValue<number>;
  /** Shows a marker that this section has something waiting. */
  hasAttentionMarker?: boolean;
  /** Announced to assistive tech in place of the purely visual marker. */
  attentionLabel?: string;
  /**
   * How many things are waiting behind this entry. Shown as a pill when above
   * zero; a count of nothing is not news, so zero renders nothing at all.
   *
   * A count above zero *is* an attention marker, and raises one on its own --
   * see {@link needsAttention}. Callers pass the number, not the marker.
   */
  count?: number;
  /**
   * What the number counts, announced instead of the bare figure -- "3" on its
   * own tells a screen reader nothing about what three of them there are.
   */
  countLabel?: (count: number) => string;
  onNavigate?: () => void;
};

const BASE_LINK_CLASS = [
  "group relative flex h-[40px] items-center rounded-[10px] px-[12px] text-[14px] font-medium leading-none",
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
].join(" ");

function getLinkStateClass(isHighlighted: boolean): string {
  return isHighlighted ? "text-white" : "text-app-text-muted hover:text-app-text";
}

/**
 * A single sidebar navigation entry.
 *
 * Adds two motion layers on top of a plain `NavLink`:
 * - dock magnification of the entry under the pointer
 * - a shared pill that slides between entries via `layoutId` instead of
 *   popping in and out on route changes
 *
 * Both layers collapse to a static rendering when the user prefers reduced motion.
 */
export function SidebarNavLink({
  to,
  label,
  icon: Icon,
  end,
  indicatorLayoutId,
  forceActive = false,
  pointerY,
  hasAttentionMarker = false,
  attentionLabel,
  count = 0,
  countLabel,
  onNavigate,
}: SidebarNavLinkProps) {
  const prefersReducedMotion = useReducedMotion();
  const indicatorTransition = prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken;

  /**
   * One marker language for the whole sidebar: an entry with work waiting
   * behind it has an amber icon that stirs every few seconds, whether what is
   * waiting is countable or not.
   *
   * Derived here rather than asked of the caller so the two cannot come apart.
   * A number in the trailing slot already means "there is something here" --
   * an entry that shows one and stays grey is the same entry disagreeing with
   * itself, and every caller passing a count would otherwise have to remember
   * to raise the flag as well.
   */
  const needsAttention = hasAttentionMarker || count > 0;

  const elementRef = useRef<HTMLDivElement>(null);
  // Keyboard users get no pointer, so focus stands in for it and asks for the
  // full lift outright.
  const [isFocused, setIsFocused] = useState(false);

  // The row's centre, measured once per render instead of on every pointer
  // move. `getBoundingClientRect` forces layout, and doing that for every
  // entry on every move is exactly the work that makes a fast sweep feel
  // heavy. No dependency array, so a list that changes stays measured.
  const centerYRef = useRef(0);

  useLayoutEffect(() => {
    let frame = 0;

    function measure() {
      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      centerYRef.current = rect.top + rect.height / 2;
    }

    // Scroll and resize both fire far faster than the layout they invalidate,
    // and every row runs its own handler — so coalesce into one measurement
    // per frame instead of one per event.
    function scheduleMeasure() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    }

    measure();
    window.addEventListener("resize", scheduleMeasure);
    // Bubble phase, so this only fires for the document scroller.
    window.addEventListener("scroll", scheduleMeasure, { passive: true });

    // The sidebar's own scroll container is the other thing that moves these
    // rows. Listening on `window` in the *capture* phase would catch it, but
    // would also re-measure every row on every scroll anywhere in the app —
    // main content, drawers, tables — which is exactly the per-entry
    // `getBoundingClientRect` cost `centerYRef` exists to avoid.
    const scroller = elementRef.current?.closest("[data-sidebar-scroll]");
    scroller?.addEventListener("scroll", scheduleMeasure, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure);
      scroller?.removeEventListener("scroll", scheduleMeasure);
    };
  });

  // Derived from the pointer rather than from `pointerenter` on this element.
  // At speed the pointer can skip a row entirely between two frames, and an
  // entry that is never entered never magnifies -- which is what made a quick
  // sweep look like it had missed half the list.
  const targetInfluence = useTransform(pointerY, (y) => {
    if (prefersReducedMotion) return 0;
    if (isFocused) return 1;

    return getInfluence(y, centerYRef.current, DOCK_INFLUENCE_RADIUS_PX);
  });

  // Kept as its own value rather than scaled down from the lift, because the
  // two answer different questions: the lift says "the pointer is near", the
  // tint says "this is the row you would click". They therefore run different
  // radii, which is the whole reason this is a second value and not a factor
  // applied to the first.
  //
  // Gated on reduced motion like the lift, because both render paths hand the
  // job to a plain CSS `group-hover` there -- the colour still happens, it is
  // just not driven by proximity to the pointer.
  const targetTint = useTransform(pointerY, (y) => {
    if (prefersReducedMotion) return 0;
    if (isFocused) return 1;

    return getInfluence(y, centerYRef.current, NAV_ROW_PITCH_PX, DOCK_TINT_FALLOFF_EXPONENT);
  });

  const influence = useSpring(targetInfluence, DOCK_TRACKING_SPRING);
  const tint = useSpring(targetTint, DOCK_TRACKING_SPRING);
  const scale = useTransform(influence, (value) => 1 + (DOCK_HOVER_SCALE - 1) * value);
  const x = useTransform(influence, (value) => value * DOCK_NUDGE_PX);
  const tintOpacity = useTransform(tint, (value) => value * DOCK_TINT_OPACITY);
  // Nested inside the fill, so this multiplies with the value above rather
  // than replacing it: the ring effectively runs the tint cubed. Mid-handoff
  // that puts it at an eighth while the fill sits at a half, so crossing
  // between rows is a single patch of light moving, not two outlined boxes
  // fading past each other. It arrives once the pointer has settled on a row,
  // which is the only moment an edge is worth drawing.
  const ringOpacity = useTransform(tint, (value) => value ** DOCK_RING_SHARPNESS_EXPONENT);

  return (
    <motion.div
      ref={elementRef}
      style={{
        scale: prefersReducedMotion ? 1 : scale,
        x: prefersReducedMotion ? 0 : x,
        transformOrigin: "left center",
        willChange: "transform",
      }}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
    >
      <NavLink
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `${BASE_LINK_CLASS} ${getLinkStateClass(isActive || forceActive)}`
        }
      >
        {({ isActive }) => {
          const isHighlighted = isActive || forceActive;

          return (
            <>
              {isHighlighted ? (
                // Flat, single-tone fill on purpose: gradients or
                // specular edges read as uneven next to the plain
                // brand colour used elsewhere in the app. The
                // depth comes from the soft glow alone.
                //
                // The `key` is what makes the pill slide. Both this
                // and the hover tint below are `motion.span` in the
                // same slot, so without distinct keys React reconciles
                // them as one element and merely swaps `layoutId` on a
                // node that never unmounts. Framer Motion pairs a
                // shared element by watching one mount as another
                // unmounts, so that swap gave it nothing to measure
                // against and the pill appeared at the new entry
                // outright. Separate keys restore the unmount/mount
                // pair and the pill travels between rows.
                <motion.span
                  key="active-pill"
                  aria-hidden="true"
                  layoutId={indicatorLayoutId}
                  transition={indicatorTransition}
                  className="absolute inset-0 rounded-[10px] bg-app-brand shadow-[0_6px_20px_-8px_var(--color-app-brand)]"
                >
                  {/* The selected row's share of the hover tint.
                                    It exists because this row was otherwise a hole in
                                    the falloff. Every other entry hands its tint to
                                    its neighbour so the two always sum to one row's
                                    worth, but this one rendered the pill *instead of*
                                    a tint: it contributed nothing and took its
                                    neighbour's half down with it. Sweeping past the
                                    current page therefore had the highlight dissolve
                                    on approach and reappear out of nothing on the far
                                    side.

                                    It runs `tintOpacity` -- the very same value every
                                    other row fades its fill in on -- so the partition
                                    is exact again; only the paint differs, because the
                                    muted surface colour the others use would just be
                                    mud over brand blue. `brand-border-strong` is the
                                    step the rest of the app already moves brand to on
                                    hover, so the pill lightens into a colour the
                                    palette has rather than an ad-hoc wash, and the
                                    entry stays unmistakably the selected one while
                                    still answering the pointer. No ring on this one:
                                    the pill is already a solid shape with its own
                                    edge, and outlining it would say "hovered" in the
                                    same breath as "selected".

                                    Falls back to the same binary `group-hover` its
                                    neighbours use under reduced motion, rather than
                                    riding the pointer spring. Without the fallback
                                    this row was the odd one out in exactly the
                                    setting that asks for less: every other entry lit
                                    only while actually hovered, while the selected
                                    one brightened and dimmed continuously as the
                                    pointer merely passed within a row of it. */}
                  {prefersReducedMotion ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[10px] bg-app-brand-border-strong opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                    />
                  ) : (
                    <motion.span
                      aria-hidden="true"
                      style={{ opacity: tintOpacity }}
                      className="absolute inset-0 rounded-[10px] bg-app-brand-border-strong"
                    />
                  )}
                </motion.span>
              ) : prefersReducedMotion ? (
                <span
                  key="hover-tint-static"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[10px] bg-app-surface-hover opacity-0 ring-1 ring-app-border-muted transition-opacity duration-300 ease-out ring-inset group-hover:opacity-100"
                />
              ) : (
                // Tied to the same influence as the lift rather
                // than to `:hover`. A binary hover tint snaps on
                // and off one row at a time, which is what made
                // the magnification look like it jumped between
                // neighbours instead of travelling through them.
                //
                // Runs the tint curve at one row pitch, not the
                // wide lift radius, so the sidebar carries a
                // single row's worth of fill in total and it
                // never competes with the brand pill for the
                // reading of "selected".
                //
                // The inset ring nested inside is the other half
                // of that: a soft fill shades off gradually at
                // its edges, and a hard 1px border is what turns
                // "roughly around here" into a stated target the
                // eye can land on.
                <motion.span
                  key="hover-tint"
                  aria-hidden="true"
                  style={{ opacity: tintOpacity }}
                  className="absolute inset-0 rounded-[10px] bg-app-surface-hover"
                >
                  <motion.span
                    style={{ opacity: ringOpacity }}
                    className="absolute inset-0 rounded-[10px] ring-1 ring-app-border-muted ring-inset"
                  />
                </motion.span>
              )}

              <span className="relative z-10 flex w-full items-center gap-[12px]">
                {/* Colour lives on this wrapper rather than on a
                                    `[&_svg]` descendant selector on the link.
                                    That selector also caught the attention flag
                                    and repainted it white on the active pill,
                                    and overriding it back would have come down
                                    to CSS source order between two equally
                                    specific arbitrary variants. */}
                <motion.span
                  animate={
                    needsAttention && !prefersReducedMotion
                      ? {
                          y: [0, -4, 0, -2, 0],
                          rotate: [0, -10, 8, -4, 0],
                        }
                      : { y: 0, rotate: 0 }
                  }
                  transition={
                    needsAttention
                      ? {
                          duration: 0.9,
                          // Long pause between bursts:
                          // an icon that never stops
                          // moving stops being a signal
                          // and becomes noise.
                          repeatDelay: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : { duration: 0.2 }
                  }
                  className={`flex shrink-0 transition-colors ${
                    needsAttention
                      ? "text-app-warning-solid"
                      : isHighlighted
                        ? "text-white"
                        : "text-app-text-muted group-hover:text-app-text"
                  }`}
                >
                  <Icon isActive={isHighlighted} />

                  {/* The movement is the whole signal here,
                                        and movement is invisible to a screen
                                        reader -- and to anyone who has reduced
                                        motion on, which is why the colour
                                        change is not conditional on it.
                                        Only rendered when there is actually
                                        something waiting: unconditional, it
                                        made every entry in the sidebar
                                        announce itself as needing attention.

                                        Stands down for a count, which says the
                                        same thing and says how many -- both
                                        would read out "Escalation Inbox, open
                                        escalations, 3 open escalations". */}
                  {needsAttention && count === 0 && (
                    <span className="sr-only">{attentionLabel ?? "Needs attention"}</span>
                  )}
                </motion.span>

                <span>{label}</span>

                {/* One trailing slot, not two. The count takes it when there is
                                    one: a number and the active dot side by side read as
                                    two separate signals about the same row, and the row
                                    you are already on has less to tell you than the one
                                    with work waiting behind it. */}
                {count > 0 ? (
                  <span className="ml-auto flex items-center">
                    {/* The same amber as the icon beside it, and the same
                                            amber on the active row as off it. This is the
                                            second half of one signal, not a badge of its
                                            own: in brand blue it read as a different kind
                                            of thing from the marker the Dashboard and PM
                                            Dashboard entries show, when it is the same
                                            kind of thing carrying a number. */}
                    <span
                      aria-hidden="true"
                      className="min-w-[20px] rounded-full bg-app-warning-bg px-1.5 py-0.5 text-center text-[11px] font-semibold text-app-warning-text"
                    >
                      {count}
                    </span>
                    <span className="sr-only">{countLabel?.(count) ?? `${count} waiting`}</span>
                  </span>
                ) : isHighlighted ? (
                  <span className="ml-auto h-[6px] w-[6px] rounded-full bg-white" />
                ) : null}
              </span>
            </>
          );
        }}
      </NavLink>
    </motion.div>
  );
}
