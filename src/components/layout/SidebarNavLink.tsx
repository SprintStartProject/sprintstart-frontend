import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { dockMagnifySpringToken, slidingIndicatorSpringToken } from '../../styles/tokens';

/**
 * Scale applied to the item directly under the pointer.
 *
 * Tuned against the sidebar geometry: with a 286px sidebar and 28px inner
 * padding an item is 230px wide, so 1.12 grows it to the right edge without
 * spilling over the sidebar border. Raising this needs more inner padding.
 */
const DOCK_HOVER_SCALE = 1.12;

type SidebarNavLinkProps = {
    to: string;
    label: string;
    icon: ReactNode;
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
    onNavigate?: () => void;
    onHoverChange: (isHovered: boolean) => void;
};

const BASE_LINK_CLASS = [
    'group relative flex h-[40px] items-center rounded-[10px] px-[12px] text-[14px] font-medium leading-none',
    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
].join(' ');

function getLinkStateClass(isHighlighted: boolean): string {
    return isHighlighted
        ? 'text-white [&_svg]:text-white'
        : 'text-app-text-muted hover:text-app-text [&_svg]:text-app-text-muted hover:[&_svg]:text-app-text';
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
    icon,
    end,
    indicatorLayoutId,
    forceActive = false,
    isMagnified,
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
                                {icon}

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
