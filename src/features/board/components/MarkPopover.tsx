import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  HIGHLIGHT_CLASS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_LABEL,
  type HighlightColor,
} from "../marks/highlightColors";

type MarkPopoverProps = {
  /** The highlight this belongs to, in viewport coordinates. */
  anchor: DOMRect;
  /** The colour it currently carries, so the swatch that is already on says so. */
  color: HighlightColor;
  onPick: (color: HighlightColor) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Roughly the bar's own size, used to decide which side of the highlight it fits on. */
const WIDTH = 190;
const HEIGHT = 40;
const GAP = 6;
const MARGIN = 12;

/**
 * Where the bar sits: under the highlight, or over it when there is no room under.
 *
 * Centred on the highlight rather than aligned to its left edge, because a highlight can be a word
 * or three lines and the middle is the part somebody is looking at either way. Clamped to the
 * viewport so a mark at the right edge of a wide card does not open a bar half off screen.
 */
function popoverStyle(anchor: DOMRect): CSSProperties {
  const centred = anchor.left + anchor.width / 2 - WIDTH / 2;
  const left = Math.min(Math.max(centred, MARGIN), window.innerWidth - WIDTH - MARGIN);

  const below = anchor.bottom + GAP;
  const fitsBelow = below + HEIGHT < window.innerHeight - MARGIN;

  return {
    position: "fixed",
    top: `${fitsBelow ? below : anchor.top - HEIGHT - GAP}px`,
    left: `${left}px`,
    zIndex: 60,
  };
}

/**
 * The little bar that opens when somebody clicks one of their own highlights.
 *
 * **The colours moved here from the selection toolbar, and that is the point of it.** Marking used
 * to mean choosing a colour first: four swatches appeared over the selection and one of them had to
 * be pressed before anything was highlighted at all. That put a decision in front of a gesture that
 * should not have one — the reason to reach for a marker is that a sentence matters, and which
 * colour it gets is a thought that comes later, if ever. So marking is now one press, and the
 * colour is something you change afterwards, on the thing itself, by pointing at it.
 *
 * Portalled to the body. A board card is drawn inside a `motion.div` with a transform on it, and a
 * transformed ancestor is the containing block for anything `fixed` inside it — the bar would be
 * positioned against the card rather than the viewport, and clipped by the card's `overflow-hidden`
 * on top of that.
 *
 * Rendered at `z-60`, above the selection toolbar's `z-50`: the two can be on screen at the same
 * moment, and this one is the one that was just asked for.
 */
export function MarkPopover({ anchor, color, onPick, onRemove, onClose }: MarkPopoverProps) {
  const bar = useRef<HTMLDivElement>(null);

  // Takes the caret, so somebody who opened this from the keyboard is standing in it rather than
  // back on the highlight with an invisible menu open somewhere.
  useEffect(() => bar.current?.querySelector("button")?.focus(), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function onPointerDown(event: MouseEvent) {
      if (!bar.current?.contains(event.target as Node)) onClose();
    }

    // Closed rather than repositioned on scroll: the highlight it belongs to has moved, and a bar
    // that chases it across the page is harder to read than one that gets out of the way. Clicking
    // the highlight again is one gesture.
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label="This highlight"
      style={popoverStyle(anchor)}
      className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface p-1 shadow-lg"
    >
      {HIGHLIGHT_COLORS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          aria-pressed={color === option}
          aria-label={HIGHLIGHT_LABEL[option]}
          title={HIGHLIGHT_LABEL[option]}
          className={`h-6 w-6 rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
            HIGHLIGHT_CLASS[option]
          } ${
            color === option
              ? "ring-2 ring-app-text ring-offset-1 ring-offset-app-surface"
              : "border border-app-border"
          }`}
        />
      ))}

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-app-border" />

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this highlight"
        title="Remove this highlight"
        className="flex h-6 w-6 items-center justify-center rounded-md text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-danger-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
