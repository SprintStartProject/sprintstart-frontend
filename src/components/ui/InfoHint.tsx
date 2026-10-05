import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

type InfoHintProps = {
  /** The helper text revealed on hover or focus. */
  text: string;
  /** Accessible label for the trigger. Defaults to "More information". */
  label?: string;
  /**
   * Where the tooltip opens relative to the trigger.
   *
   * - `"bottom-start"` (default) — below the trigger, growing to the right. The right choice in
   *   open sections, and the untouched behaviour for existing callers.
   * - `"top-end"` — above the trigger, right-aligned to it. For headers inside cards that clip
   *   overflow (`SpotlightCard` is `overflow-hidden`): a tooltip below would be cut off by a
   *   short card's bottom edge, and one growing rightwards by a narrow card's right edge.
   *
   * Neither placement escapes the clipping container. `"top-end"` still needs enough vertical
   * headroom above the trigger inside the card (true for a section header under a card title —
   * the gaps panel case — but not for the card title itself), and browser text scaling (up to
   * 200%, WCAG 1.4.4) eats into that headroom. A portal-based tooltip would be the robust fix
   * if a call site ever needs placement freedom inside a clipping card.
   */
  placement?: "bottom-start" | "top-end";
  className?: string;
};

/**
 * A small "i" trigger that reveals a section's helper text on hover, keyboard focus, or click.
 *
 * Section headings used to carry their explanation as a paragraph under the title. This tucks the
 * same text behind an info affordance so the heading row stays compact, without losing it. The
 * tooltip is wired up with `aria-describedby` so it is always in the accessibility tree, and it
 * follows WCAG 2.1 SC 1.4.13 (Content on Hover or Focus): the pointer can move from the trigger
 * onto the open tooltip without it disappearing — the open tooltip accepts pointer events, and
 * the hover handlers live on the wrapper that spans the visual gap — pressing the tooltip text
 * keeps it open (focus moves onto the tooltip itself, still inside the wrapper), and Escape
 * closes it from anywhere while it is open.
 *
 * Visibility model — `open` shows the tooltip, `pinned` makes it outlive hover and focus:
 * - hover in and keyboard focus open it; hover out and blur close it while unpinned — a blur
 *   whose new focus target is inside the hint (trigger onto the tooltip text) is not a leave;
 * - a click toggles the pin, which is the touch story: one tap opens the tooltip and keeps it
 *   open, the next tap (or a tap anywhere outside) closes it. Touch devices have no Escape key
 *   and a tap on inert background does not blur the trigger, so `onBlur` alone would leave the
 *   tooltip stuck open;
 * - Escape closes and unpins, wherever focus is: the outside-tap and Escape listeners both live
 *   on the document while the tooltip is open.
 *
 * Kept CSS-driven (no framer-motion) on purpose, so it never inherits SlidingTabPanel's
 * `initial={false}` and pops instead of fading.
 */
export function InfoHint({
  text,
  label = "More information",
  placement = "bottom-start",
  className = "",
}: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // A tap anywhere outside closes and unpins, and Escape dismisses from wherever focus is —
  // after a hover-only open the trigger has no focus, so a handler on the button would never
  // hear the key. Both listeners are native and bound only while open; `blur` alone cannot
  // dismiss, because mobile Safari does not blur the button when the tap lands on inert content.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPinned(false);
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // The gap between the trigger and the bubble is transparent padding inside the positioned
  // wrapper (`pt-2`/`pb-2`), so the pointer can travel the whole way from the trigger onto the
  // tooltip without leaving the hover area (SC 1.4.13) — while the bubble still sits 8px clear.
  //
  // The width cap differs per placement. `top-end` anchors its right edge to a trigger ~24px
  // inside the card's padding, so on 320–375px phones the default `85vw` cap still overflows
  // the clipping card on the left (measured: 17/11/9px at 320/360/375). Capping by the card's
  // width budget — viewport minus page gutters minus card padding, with 16px slack — keeps a
  // constant 16px of clearance at every phone width; the cap never binds above ~400px.
  //
  // The one remaining artefact, measured at 320px: the narrower bubble wraps to ~163px tall and
  // trims ~6px of its own top border and padding band against the card's top edge — the text
  // stays whole (`textClippedBy: 0`). That viewport cannot fit this copy both horizontally and
  // vertically at once (a 6-line bubble needs ~284px of width; the card offers 256px), and the
  // text winning is the point of the placement. 360px and up measure clean on all four edges;
  // a portal-based tooltip is the fix if the shell trim ever matters.
  const placementClasses =
    placement === "top-end"
      ? "bottom-full right-0 pb-2 max-w-[min(22rem,calc(100vw_-_5rem))]"
      : "top-5 left-0 pt-2 max-w-[min(22rem,85vw)]";

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex ${className}`}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onBlur={(event) => {
        // Focus moving within the hint — trigger onto the tooltip text, which is focusable for
        // exactly this reason — is not leaving it. Only an exit to somewhere else closes.
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setPinned(false);
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onFocus={() => setOpen(true)}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-app-text-muted transition-colors hover:text-app-text"
      >
        <Info className="h-[15px] w-[15px]" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        // Focusable so a press on the text keeps focus inside the hint — otherwise it would
        // drop to the body and the wrapper would read the resulting blur as a leave.
        tabIndex={-1}
        className={`absolute ${placementClasses} z-50 w-80 transition-all duration-150 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0"
        }`}
      >
        <span className="block w-full rounded-xl border border-app-border/70 bg-app-surface/95 p-3 text-xs leading-relaxed font-normal text-app-text-muted shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {text}
        </span>
      </span>
    </span>
  );
}
