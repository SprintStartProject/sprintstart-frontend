import type { CSSProperties } from "react";

/**
 * Computes `fixed`-position style for a popover anchored just below a clicked
 * element (e.g. a `[1]` citation superscript), clamped to the viewport. Flips
 * above the anchor when there's no room below. Shared by the citation popover
 * and the per-file citation detail chip so positioning stays consistent.
 *
 * @param rect  Bounding rect of the anchor element.
 * @param width Desired popover width in px (defaults to 320).
 */
export function getCitationPopoverStyle(rect: DOMRect, width = 320): CSSProperties {
  const WIDTH = width;
  const GAP = 8;
  const EST_HEIGHT = 120;
  const MARGIN = 16;

  let top = rect.bottom + GAP;
  let left = rect.left;

  if (left + WIDTH > window.innerWidth - MARGIN) {
    left = window.innerWidth - WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  if (top + EST_HEIGHT > window.innerHeight - MARGIN) {
    const aboveTop = rect.top - EST_HEIGHT - GAP;
    if (aboveTop >= MARGIN) {
      top = aboveTop;
    }
  }

  return {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `${WIDTH}px`,
    zIndex: 50,
  };
}
