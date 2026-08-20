import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useMatch, useResolvedPath } from "react-router-dom";
import type { SidebarIcon } from "./SidebarNavIcons";
import { SIDEBAR_INDICATOR_COLOR_MS, sidebarIndicatorSpringToken } from "../../styles/tokens";

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
 * Radius of the tint falloff: exactly one row pitch, 40px of row plus the 5px
 * gap the nav puts between them.
 *
 * The number is not a taste call, it is the one value that makes the tint hand
 * off cleanly, and the reason is the identity `cos²x + sin²x = 1`. A row at
 * distance `d` shows `cos²(d/P · π/2)`; its neighbour, being `P - d` away,
 * shows `sin²(d/P · π/2)`. The two always sum to exactly 1. So the sidebar
 * carries precisely one row's worth of tint at every pointer position, split
 * between at most two adjacent rows, and the highlight travels from one to the
 * next without the total ever dipping.
 *
 * Getting this wrong is what both previous versions did, in opposite
 * directions. The original ran the tint off the wide lift radius, which lit
 * five rows at once -- and five lit rows next to one brand-filled one is six
 * things claiming to be the highlight, which is the ambiguity the client
 * reported. Tightening it to 30px overcorrected: at the midpoint between two
 * rows both sat at 0.15, so sweeping across dropped the highlight to a third
 * of a row and the marker visibly blinked out between entries. One pitch is
 * the width where neither happens.
 *
 * The lift keeps its own, wider radius, so the dock wave is untouched: motion
 * still travels across several neighbours, colour spans exactly two. Movement
 * is the flourish, colour is the statement about state, and they should not be
 * speaking at the same width.
 */
const NAV_ROW_PITCH_PX = 45;

/**
 * Squaring the cosine is what makes the handoff exact rather than approximate
 * -- see the identity in `NAV_ROW_PITCH_PX`. It is not a shoulder tweak, and
 * changing it breaks the constant-total property that keeps the tint from
 * dipping between rows.
 */
const DOCK_TINT_FALLOFF_EXPONENT = 2;

/**
 * Lift radius for the row of the current page, in pixels.
 *
 * Tight on purpose, and tighter than one pitch: the selected row reaches zero
 * lift well before the pointer gets to its neighbour's centre, so sweeping
 * past leaves it sitting still. An indicator that drifts whenever the mouse
 * passes nearby is behaving like a hover response, and a hover response is not
 * what "this is the page you are on" should look like. Squared for the same
 * reason -- it puts the row at a sixth of a lift when the pointer is in the
 * gap beside it, which reads as stationary.
 */
const DOCK_SELECTED_LIFT_RADIUS_PX = 30;

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
 * same shape, so the tint stays centred on the row the lift peaks at.
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
  onNavigate?: () => void;
};

// No `duration-*` here on purpose: the colour timing is asymmetric -- an
// arriving row waits for the pill, a leaving row does not -- and Tailwind
// cannot build a class name out of a runtime value anyway. It comes from
// `getColorTimingStyle` below, off the shared constants, so the durations have
// one home rather than being literals repeated across three elements.
const BASE_LINK_CLASS = [
  "group relative flex h-[40px] items-center rounded-[10px] px-[12px] text-[14px] font-medium leading-none",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
].join(" ");

function getLinkStateClass(isHighlighted: boolean): string {
  return isHighlighted ? "text-white" : "text-app-text-muted hover:text-app-text";
}

/**
 * One colour timing for every row, in both directions.
 *
 * Symmetric on purpose -- see {@link SIDEBAR_INDICATOR_COLOR_MS} for why the
 * asymmetric version that used to live here made the selection blink rather
 * than travel. Because the same value goes to the link, the icon and the dot,
 * a row changes as one thing instead of as three.
 */
function getColorTimingStyle(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) return undefined;

  return { transitionDuration: `${SIDEBAR_INDICATOR_COLOR_MS}ms` };
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
  onNavigate,
}: SidebarNavLinkProps) {
  const prefersReducedMotion = useReducedMotion();
  const indicatorTransition = prefersReducedMotion ? { duration: 0 } : sidebarIndicatorSpringToken;

  // Resolved here rather than read off `NavLink`'s render prop, because the
  // motion wrapper sits *outside* the link and now needs to know whether this
  // is the current page: the selected row is held still while the pointer
  // sweeps past its neighbours, and that decision has to be made before the
  // link renders. This is the same match `NavLink` performs internally, so the
  // two cannot disagree, and `NavLink` still sets `aria-current` itself.
  const resolvedPath = useResolvedPath(to);
  const routeMatch = useMatch({ path: resolvedPath.pathname, end: end ?? false });
  const isHighlighted = routeMatch !== null || forceActive;
  const colorTimingStyle = getColorTimingStyle(prefersReducedMotion);

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
    function measure() {
      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      centerYRef.current = rect.top + rect.height / 2;
    }

    measure();
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  });

  // Derived from the pointer rather than from `pointerenter` on this element.
  // At speed the pointer can skip a row entirely between two frames, and an
  // entry that is never entered never magnifies -- which is what made a quick
  // sweep look like it had missed half the list.
  //
  // The selected row is the exception: it runs the tight radius instead, so a
  // pointer two rows away no longer lifts it. It still lifts when the pointer
  // is genuinely over it, so it stays as obviously clickable as every other
  // entry.
  const targetInfluence = useTransform(pointerY, (y) => {
    if (prefersReducedMotion) return 0;
    if (isFocused) return 1;

    return isHighlighted
      ? getInfluence(
          y,
          centerYRef.current,
          DOCK_SELECTED_LIFT_RADIUS_PX,
          DOCK_TINT_FALLOFF_EXPONENT,
        )
      : getInfluence(y, centerYRef.current, DOCK_INFLUENCE_RADIUS_PX);
  });

  // Kept as its own value rather than scaled down from the lift, because the
  // two answer different questions: the lift says "the pointer is near", the
  // tint says "this is the row you would click". They therefore run different
  // radii, which is the whole reason this is a second value and not a factor
  // applied to the first.
  const targetTint = useTransform(pointerY, (y) => {
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
  // that puts it near a sixteenth while the fill sits at a half, so crossing
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
        style={colorTimingStyle}
        className={`${BASE_LINK_CLASS} ${getLinkStateClass(isHighlighted)}`}
      >
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
          />
        ) : prefersReducedMotion ? (
          <span
            key="hover-tint-static"
            aria-hidden="true"
            className="absolute inset-0 rounded-[10px] bg-app-surface-hover opacity-0 ring-1 ring-app-border-muted transition-opacity duration-300 ease-out ring-inset group-hover:opacity-100"
          />
        ) : (
          // Runs the tint curve at one row pitch, not the wide lift
          // radius, so the sidebar carries a single row's worth of
          // fill in total and it never competes with the brand pill
          // for the reading of "selected".
          //
          // The inset ring nested inside is the other half of that:
          // a soft fill shades off gradually at its edges, and a
          // hard 1px border is what turns "roughly around here"
          // into a stated target the eye can land on.
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
              hasAttentionMarker && !prefersReducedMotion
                ? {
                    y: [0, -4, 0, -2, 0],
                    rotate: [0, -10, 8, -4, 0],
                  }
                : { y: 0, rotate: 0 }
            }
            transition={
              hasAttentionMarker
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
            // Same timing as the link above rather than Tailwind's bare
            // 150ms default, which had the icon finishing its colour
            // change 50ms before the label it sits next to.
            style={colorTimingStyle}
            className={`flex shrink-0 transition-colors ${
              hasAttentionMarker
                ? "text-app-warning-solid"
                : isHighlighted
                  ? "text-white"
                  : "text-app-text-muted group-hover:text-app-text"
            }`}
          >
            <Icon isActive={isHighlighted} />

            {/* The movement is the whole signal here, and
                movement is invisible to a screen reader --
                and to anyone who has reduced motion on,
                which is why the colour change is not
                conditional on it.

                Gated on the flag: this sat outside the
                condition, so every entry in the sidebar
                announced "Needs attention" to a screen
                reader whether or not anything was waiting
                on it. */}
            {hasAttentionMarker ? (
              <span className="sr-only">{attentionLabel ?? "Needs attention"}</span>
            ) : null}
          </motion.span>

          <span>{label}</span>

          {/* Always mounted, faded rather than added and removed. This
              was the harshest thing in the whole transition: a plain
              conditional, so while the pill spent 300ms gliding to its
              new row the dot simply vanished from one entry and
              materialised on another, on no timeline at all. Keeping it
              mounted also means an inactive row reserves the same 6px,
              so nothing reflows when the selection lands.

              It runs the same window and the same curve as the text
              beside it, in both directions, so the dot leaving one row
              and the dot arriving at the next are mirror images and
              always sum to one visible marker. Staggering them was
              what previously left a gap with no dot anywhere. */}
          <motion.span
            aria-hidden="true"
            className="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-white"
            initial={false}
            animate={{
              opacity: isHighlighted ? 1 : 0,
              scale: isHighlighted ? 1 : 0.4,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    duration: SIDEBAR_INDICATOR_COLOR_MS / 1000,
                    // Tailwind's default curve, restated here so the dot
                    // and the CSS-driven colours beside it are on the
                    // same easing as well as the same duration.
                    ease: [0.4, 0, 0.2, 1],
                  }
            }
          />
        </span>
      </NavLink>
    </motion.div>
  );
}
