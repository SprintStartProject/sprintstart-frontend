import {
    motion,
    useReducedMotion,
    useSpring,
    useTransform,
    type MotionValue,
} from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { SidebarIcon } from './SidebarNavIcons';
import { slidingIndicatorSpringToken } from '../../styles/tokens';

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
 * How much of the row's hover tint is showing, at full influence. Short of 1,
 * so the row the pointer is actually on still reads as the brightest one.
 */
const DOCK_TINT_OPACITY = 0.9;

/**
 * How strongly this item is affected by the pointer, from 0 to 1.
 *
 * Cosine rather than a straight ramp: a linear falloff has a visible corner
 * where the influence starts, and the corner is what makes a slow pass feel
 * mechanical.
 *
 * One number for every effect on the row -- lift, nudge and tint all read from
 * it -- so they cannot drift apart and the whole row moves as one thing.
 */
function getInfluence(pointerY: number, centerY: number) {
    const distance = Math.abs(pointerY - centerY);

    if (!Number.isFinite(distance) || distance >= DOCK_INFLUENCE_RADIUS_PX) {
        return 0;
    }

    return Math.cos((distance / DOCK_INFLUENCE_RADIUS_PX) * (Math.PI / 2));
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

const BASE_LINK_CLASS = [
    'group relative flex h-[40px] items-center rounded-[10px] px-[12px] text-[14px] font-medium leading-none',
    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
].join(' ');

function getLinkStateClass(isHighlighted: boolean): string {
    return isHighlighted
        ? 'text-white'
        : 'text-app-text-muted hover:text-app-text';
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
    const indicatorTransition = prefersReducedMotion
        ? { duration: 0 }
        : slidingIndicatorSpringToken;

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
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    });

    // Derived from the pointer rather than from `pointerenter` on this element.
    // At speed the pointer can skip a row entirely between two frames, and an
    // entry that is never entered never magnifies -- which is what made a quick
    // sweep look like it had missed half the list.
    const targetInfluence = useTransform(pointerY, (y) => {
        if (prefersReducedMotion) return 0;
        if (isFocused) return 1;

        return getInfluence(y, centerYRef.current);
    });

    const influence = useSpring(targetInfluence, DOCK_TRACKING_SPRING);
    const scale = useTransform(
        influence,
        (value) => 1 + (DOCK_HOVER_SCALE - 1) * value,
    );
    const x = useTransform(influence, (value) => value * DOCK_NUDGE_PX);
    const tintOpacity = useTransform(
        influence,
        (value) => value * DOCK_TINT_OPACITY,
    );

    return (
        <motion.div
            ref={elementRef}
            style={{
                scale: prefersReducedMotion ? 1 : scale,
                x: prefersReducedMotion ? 0 : x,
                transformOrigin: 'left center',
                willChange: 'transform',
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
                                <motion.span
                                    aria-hidden="true"
                                    layoutId={indicatorLayoutId}
                                    transition={indicatorTransition}
                                    className="absolute inset-0 rounded-[10px] bg-app-brand shadow-[0_6px_20px_-8px_var(--color-app-brand)]"
                                />
                            ) : prefersReducedMotion ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-[10px] bg-app-surface-hover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                                />
                            ) : (
                                // Tied to the same influence as the lift rather
                                // than to `:hover`. A binary hover tint snaps on
                                // and off one row at a time, which is what made
                                // the magnification look like it jumped between
                                // neighbours instead of travelling through them.
                                <motion.span
                                    aria-hidden="true"
                                    style={{ opacity: tintOpacity }}
                                    className="absolute inset-0 rounded-[10px] bg-app-surface-hover"
                                />
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
                                        hasAttentionMarker &&
                                        !prefersReducedMotion
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
                                                  ease: 'easeInOut',
                                              }
                                            : { duration: 0.2 }
                                    }
                                    className={`flex shrink-0 transition-colors ${
                                        hasAttentionMarker
                                            ? 'text-app-warning-solid'
                                            : isHighlighted
                                              ? 'text-white'
                                              : 'text-app-text-muted group-hover:text-app-text'
                                    }`}
                                >
                                    <Icon isActive={isHighlighted} />

                                    {/* The movement is the whole signal here,
                                        and movement is invisible to a screen
                                        reader -- and to anyone who has reduced
                                        motion on, which is why the colour
                                        change is not conditional on it. */}
                                    <span className="sr-only">
                                        {attentionLabel ?? 'Needs attention'}
                                    </span>
                                </motion.span>

                                <span>{label}</span>

                                {isHighlighted ? (
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
