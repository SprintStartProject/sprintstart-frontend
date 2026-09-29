import { useId } from "react";

type SidebarToggleIconProps = {
  collapsed: boolean;
  className?: string;
};

/**
 * A window with a rail down its left side, drawn at the width the sidebar has: wide while it is
 * open, a sliver while it is folded. It shows the sidebar's state rather than a direction, and
 * on hover the rail leans towards the other state, so the button previews what a click does.
 *
 * Drawn here rather than taken from lucide because the rail has to move: it scales from its left
 * edge and the divider travels with its right edge, both as CSS transforms (in the SVG's own
 * units, which CSS pixels are inside a `viewBox`), under a parent `group/toggle`.
 */
export function SidebarToggleIcon({ collapsed, className = "" }: SidebarToggleIconProps) {
  const clipId = useId();
  // The rail is 8 units wide when open (x 3 to 11). Its right edge, where the divider sits,
  // moves by 8 x (scale - 1) when it scales from the left.
  const rail = collapsed
    ? "scale-x-[0.4] group-hover/toggle:scale-x-[0.7]"
    : "scale-x-100 group-hover/toggle:scale-x-[0.65]";
  const divider = collapsed
    ? "translate-x-[-4.8px] group-hover/toggle:translate-x-[-2.4px]"
    : "translate-x-0 group-hover/toggle:translate-x-[-2.8px]";
  const moves = "transition-[scale,translate] duration-300 ease-out motion-reduce:transition-none";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
        </clipPath>
      </defs>
      {/* Clipped on a group, not on the rail: a clip on the rail would scale with it and squash
          the window's rounded corners. */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="3"
          y="4"
          width="8"
          height="16"
          stroke="none"
          fill="currentColor"
          fillOpacity={0.3}
          className={`origin-left [transform-box:fill-box] ${rail} ${moves}`}
        />
      </g>
      <line x1="11" y1="4" x2="11" y2="20" className={`${divider} ${moves}`} />
      <rect x="3" y="4" width="18" height="16" rx="3" />
    </svg>
  );
}
