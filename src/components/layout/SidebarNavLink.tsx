import { motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import type { SidebarIcon } from './SidebarNavIcons';
import { dockMagnifySpringToken, slidingIndicatorSpringToken } from '../../styles/tokens';

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
    /** True while this entry is the one under the pointer (or focused). */
    isMagnified: boolean;
    /** Shows a marker that this section has something waiting. */
    hasAttentionMarker?: boolean;
    /** Announced to assistive tech in place of the purely visual marker. */
    attentionLabel?: string;
    onNavigate?: () => void;
    onHoverChange: (isHovered: boolean) => void;
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
    isMagnified,
    hasAttentionMarker = false,
    attentionLabel,
    onNavigate,
    onHoverChange,
}: SidebarNavLinkProps) {
    const prefersReducedMotion = useReducedMotion();
    const scale = !prefersReducedMotion && isMagnified ? DOCK_HOVER_SCALE : 1;
    const indicatorTransition = prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken;

    return (
        <motion.div
            animate={{ scale }}
            transition={dockMagnifySpringToken}
            style={{ transformOrigin: 'left center', willChange: 'transform' }}
            onHoverStart={() => onHoverChange(true)}
            onHoverEnd={() => onHoverChange(false)}
            onFocusCapture={() => onHoverChange(true)}
            onBlurCapture={() => onHoverChange(false)}
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
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-[10px] bg-app-surface-hover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
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
                                        hasAttentionMarker && !prefersReducedMotion
                                            ? { y: [0, -4, 0, -2, 0], rotate: [0, -10, 8, -4, 0] }
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
