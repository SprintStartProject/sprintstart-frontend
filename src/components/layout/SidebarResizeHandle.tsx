import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_WIDTH_VAR,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STEP,
  clampSidebarWidth,
} from "./useSidebarLayout";

/** Dragged this far past the minimum, the sidebar folds to icons instead of stopping there. */
const COLLAPSE_OVERSHOOT_PX = 80;
/**
 * Where the edge switches between folded and open, in both directions: pulled left of it the
 * sidebar folds, pulled right of it (out of the folded rail) the sidebar opens again.
 */
const COLLAPSE_THRESHOLD = SIDEBAR_MIN_WIDTH - COLLAPSE_OVERSHOOT_PX;

type SidebarResizeHandleProps = {
  /** The open width -- kept while folded, for when it opens again. */
  width: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onCollapse: () => void;
  onExpand: () => void;
};

/** Marks a drag on the root element, where `app-sidebar-eases` holds its transition off meanwhile. */
function setDragging(dragging: boolean) {
  if (dragging) document.documentElement.dataset.sidebarResizing = "true";
  else delete document.documentElement.dataset.sidebarResizing;
}

/**
 * The desktop sidebar's right edge, as something to drag: wider or narrower within
 * {@link SIDEBAR_MIN_WIDTH} and {@link SIDEBAR_MAX_WIDTH}, folded to icons when pulled well past
 * the minimum, back to the default on a double click. Folded, the same edge pulls it open again,
 * so neither direction needs the toggle button.
 *
 * Folding and opening happen as the pointer crosses {@link COLLAPSE_THRESHOLD}, not on release:
 * the rail snaps shut or open under the pointer, so what is let go of is what stays.
 *
 * While dragging it writes the width straight into the sidebar's CSS variable (which the page's
 * margin reads too) and only hands the result back on release: a state update per pointer move
 * would re-render every entry of the sidebar sixty times a second for a line that just follows
 * the mouse.
 *
 * A `separator` with a value, so it is reachable and usable from the keyboard too: the arrow
 * keys move the edge, Home and End jump to the limits, Enter folds the sidebar to icons or opens
 * it again. Folded, the right arrow and End open it.
 */
export function SidebarResizeHandle({
  width,
  collapsed,
  onResize,
  onCollapse,
  onExpand,
}: SidebarResizeHandleProps) {
  const drag = useRef<{
    startX: number;
    startWidth: number;
    raw: number;
    collapsed: boolean;
  } | null>(null);

  // Unmounted mid-drag (focus mode swapping the shell, a route change, HMR), `endDrag` never runs,
  // and the mark would hold the sidebar's easing off for the rest of the visit.
  useEffect(() => () => setDragging(false), []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;
    drag.current = { startX: event.clientX, startWidth, raw: startWidth, collapsed };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    current.raw = current.startWidth + event.clientX - current.startX;
    const folds = current.raw < COLLAPSE_THRESHOLD;

    if (folds !== current.collapsed) {
      // One state update per crossing, not per move: the sidebar has to swap between its folded
      // and open layout, which the CSS variable alone cannot do.
      current.collapsed = folds;
      if (folds) {
        onCollapse();
      } else {
        // Opens at the width under the pointer, not at the one it had before it folded.
        onResize(current.raw);
        onExpand();
      }
    }
    // Folded, the sidebar writes the rail's width itself.
    if (folds) return;
    document.documentElement.style.setProperty(
      SIDEBAR_WIDTH_VAR,
      `${clampSidebarWidth(current.raw)}px`,
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    // Folded or opened already while crossing the threshold; an open edge still has to hand its
    // final width back. The sidebar writes the variable again from its state on the next render.
    if (!current.collapsed) onResize(current.raw);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (collapsed) onExpand();
      else onCollapse();
      return;
    }
    if (collapsed) {
      // Folded there is no width to move; growing it means opening it, at the width it had.
      if (event.key === "ArrowRight" || event.key === "End") {
        event.preventDefault();
        onExpand();
      }
      return;
    }

    const next =
      event.key === "ArrowLeft"
        ? width - SIDEBAR_WIDTH_STEP
        : event.key === "ArrowRight"
          ? width + SIDEBAR_WIDTH_STEP
          : event.key === "Home"
            ? SIDEBAR_MIN_WIDTH
            : event.key === "End"
              ? SIDEBAR_MAX_WIDTH
              : null;

    if (next === null) return;
    event.preventDefault();
    onResize(next);
  };

  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
     A focusable `separator` with a value is the ARIA pattern for a splitter, and an interactive
     widget when focusable; the lint rules treat every separator as static. */
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={collapsed ? SIDEBAR_COLLAPSED_WIDTH : width}
      aria-valuemin={collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuetext={collapsed ? "Collapsed" : `${width} pixels`}
      tabIndex={0}
      title={
        collapsed
          ? "Drag to expand, double-click to reset, Enter to expand"
          : "Drag to resize, double-click to reset, Enter to collapse"
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        onResize(SIDEBAR_DEFAULT_WIDTH);
        if (collapsed) onExpand();
      }}
      onKeyDown={onKeyDown}
      // A wide, invisible grip centred on the border; the line itself only shows on hover, focus
      // or drag.
      className="group absolute top-0 -right-1.5 z-20 flex h-full w-3 cursor-col-resize touch-none justify-center focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="h-full w-0.5 bg-transparent transition-colors group-hover:bg-app-brand-border-strong group-focus-visible:bg-app-focus group-active:bg-app-brand"
      />
    </div>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}
