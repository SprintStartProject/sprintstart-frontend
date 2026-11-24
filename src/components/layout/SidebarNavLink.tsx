import { motion, useReducedMotion, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { SidebarIcon } from "./SidebarNavIcons";
import { prefetchRoute } from "../../router/routePrefetch";
import { ShortcutHint } from "../ui/ShortcutHint";
import { useProjectContext } from "../../features/projects/useProjectContext";
import { NavLinkBackdrop } from "./navLink/NavLinkBackdrop";
import { NavLinkIcon } from "./navLink/NavLinkIcon";
import { NavLinkTooltip } from "./navLink/NavLinkTooltip";
import { NavLinkTrailing } from "./navLink/NavLinkTrailing";
import { needsAttentionOf, statusDetail } from "./navLink/navLinkText";
import { useDockMotion } from "./navLink/useDockMotion";
import { useRowTooltip } from "./navLink/useRowTooltip";

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
  /**
   * Something is being prepared behind this entry right now -- the onboarding path while it is
   * built in the background. A small spinner in the trailing slot, announced with `busyLabel`.
   */
  busy?: boolean;
  busyLabel?: string;
  /**
   * The chord that jumps here, shown on hover/focus. Comes from the shortcuts registry
   * (`navigationShortcut`) rather than being typed at each call site, so the hint on the
   * entry and the keypress that answers it cannot drift apart.
   */
  shortcut?: string;
  onNavigate?: () => void;
  /**
   * The desktop sidebar folded to icons: the label is kept for assistive technology only and
   * shown as a tooltip beside the icon on hover and keyboard focus, and a count shrinks to a
   * bubble on the icon's corner.
   */
  collapsed?: boolean;
};

const BASE_LINK_CLASS = [
  "group relative flex h-[40px] items-center rounded-[10px] px-[12px] text-sm font-medium leading-none",
  "transition-colors duration-200",
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
  icon,
  end,
  indicatorLayoutId,
  forceActive = false,
  pointerY,
  hasAttentionMarker = false,
  attentionLabel,
  count = 0,
  countLabel,
  busy = false,
  busyLabel,
  shortcut,
  onNavigate,
  collapsed = false,
}: SidebarNavLinkProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const queryClient = useQueryClient();
  const { selectedProjectId } = useProjectContext();
  const needsAttention = needsAttentionOf(hasAttentionMarker, count);

  const elementRef = useRef<HTMLDivElement>(null);
  const dock = useDockMotion(pointerY, elementRef, prefersReducedMotion);
  const tooltip = useRowTooltip(elementRef, collapsed);

  return (
    <motion.div
      ref={elementRef}
      style={{
        scale: prefersReducedMotion ? 1 : dock.scale,
        x: prefersReducedMotion ? 0 : dock.x,
        transformOrigin: "left center",
        willChange: "transform",
      }}
      // Keyboard users get no pointer, so focus stands in for it and asks for the full lift.
      onFocusCapture={() => {
        dock.setFocused(true);
        tooltip.show();
      }}
      onBlurCapture={() => {
        dock.setFocused(false);
        tooltip.hide();
      }}
      onPointerEnter={tooltip.show}
      onPointerLeave={tooltip.hide}
      onKeyDown={(event) => {
        // The usual way out of a tooltip that is in the way.
        if (event.key === "Escape") tooltip.hide();
      }}
    >
      <NavLink
        to={to}
        end={end}
        // The chord lives in the title rather than in the link's text: the chip is
        // `aria-hidden` (a second rendering of the same thing), and this is the copy a
        // screen reader does get.
        title={shortcut ? `${label} (${shortcut})` : undefined}
        onClick={onNavigate}
        // Pointerdown rather than hover: a sweep across the sidebar passes over several
        // entries in one motion, and prefetching all of them would spend requests on
        // entries nobody meant to visit. A press is committed — by the time the browser
        // paints the new route, the request is already a beat ahead of it.
        onPointerDown={() => prefetchRoute(queryClient, to, selectedProjectId || null)}
        className={({ isActive }) =>
          `${BASE_LINK_CLASS} ${getLinkStateClass(isActive || forceActive)}`
        }
      >
        {({ isActive }) => {
          const isHighlighted = isActive || forceActive;

          return (
            <>
              <NavLinkBackdrop
                isHighlighted={isHighlighted}
                indicatorLayoutId={indicatorLayoutId}
                prefersReducedMotion={prefersReducedMotion}
                tintOpacity={dock.tintOpacity}
                ringOpacity={dock.ringOpacity}
              />

              <span className="relative z-10 flex w-full items-center gap-[12px]">
                <NavLinkIcon
                  icon={icon}
                  isHighlighted={isHighlighted}
                  needsAttention={needsAttention}
                  prefersReducedMotion={prefersReducedMotion}
                  count={count}
                  attentionLabel={attentionLabel}
                />

                {/* Folded to icons, the label is still the entry's accessible name -- and the
                    tooltip's text, for everyone else. */}
                <span className={collapsed ? "sr-only" : undefined}>{label}</span>

                {/* Not on the folded rail: there is no room beside the icon, and the chord stays
                    in the link's `title` and in the shortcuts modal. */}
                {shortcut && !collapsed && (
                  <ShortcutHint keys={shortcut} className="border-app-border text-app-text-muted" />
                )}

                <NavLinkTrailing
                  busy={busy}
                  busyLabel={busyLabel}
                  count={count}
                  countLabel={countLabel}
                  isHighlighted={isHighlighted}
                  collapsed={collapsed}
                />
              </span>
            </>
          );
        }}
      </NavLink>

      {collapsed && tooltip.at && (
        <NavLinkTooltip
          at={tooltip.at}
          label={label}
          detail={statusDetail({
            busy,
            busyLabel,
            count,
            countLabel,
            needsAttention,
            attentionLabel,
          })}
        />
      )}
    </motion.div>
  );
}
