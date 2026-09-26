import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_WIDTH_VAR,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STEP,
  clampSidebarWidth,
} from "./useSidebarLayout";

/** Dragged this far past the minimum, the sidebar folds to icons instead of stopping there. */
const COLLAPSE_OVERSHOOT_PX = 80;

type SidebarResizeHandleProps = {
  width: number;
  onResize: (width: number) => void;
  onCollapse: () => void;
};

/** Marks a drag on the root element, where `app-sidebar-eases` holds its transition off meanwhile. */
function setDragging(dragging: boolean) {
  if (dragging) document.documentElement.dataset.sidebarResizing = "true";
  else delete document.documentElement.dataset.sidebarResizing;
}

/**
 * The desktop sidebar's right edge, as something to drag: wider or narrower within
 * {@link SIDEBAR_MIN_WIDTH} and {@link SIDEBAR_MAX_WIDTH}, folded to icons when pulled well past
 * the minimum, back to the default on a double click.
 *
 * While dragging it writes the width straight into the sidebar's CSS variable (which the page's
 * margin reads too) and only hands the result back on release: a state update per pointer move
 * would re-render every entry of the sidebar sixty times a second for a line that just follows
 * the mouse.
 *
 * A `separator` with a value, so it is reachable and usable from the keyboard too: the arrow
 * keys move the edge, Home and End jump to the limits, Enter folds the sidebar to icons.
 */
export function SidebarResizeHandle({ width, onResize, onCollapse }: SidebarResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number; raw: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, raw: width };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    current.raw = current.startWidth + event.clientX - current.startX;
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
    // The sidebar writes the variable again from its state on the next render.
    if (current.raw < SIDEBAR_MIN_WIDTH - COLLAPSE_OVERSHOOT_PX) {
      // Keeps the width it had, for when it is opened again.
      onCollapse();
    } else {
      onResize(current.raw);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

    if (event.key === "Enter") {
      event.preventDefault();
      onCollapse();
      return;
    }
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
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT_WIDTH)}
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
