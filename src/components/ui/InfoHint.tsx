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
 * the hover handlers live on the wrapper that spans the visual gap — and Escape closes it.
 *
 * Visibility model — `open` shows the tooltip, `pinned` makes it outlive hover and focus:
 * - hover in and keyboard focus open it; hover out and blur close it while unpinned;
 * - a click toggles the pin, which is the touch story: one tap opens the tooltip and keeps it
 *   open, the next tap (or a tap anywhere outside) closes it. Touch devices have no Escape key
 *   and a tap on inert background does not blur the trigger, so `onBlur` alone would leave the
 *   tooltip stuck open;
 * - Escape closes and unpins.
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

  // A tap anywhere outside closes and unpins. Bound only while open, and a native document
  // listener rather than blur, because mobile Safari does not blur the button when the tap lands
  // on inert content.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // The gap between the trigger and the bubble is transparent padding inside the positioned
  // wrapper (`pt-2`/`pb-2`), so the pointer can travel the whole way from the trigger onto the
  // tooltip without leaving the hover area (SC 1.4.13) — while the bubble still sits 8px clear.
  const placementClasses =
    placement === "top-end" ? "bottom-full right-0 pb-2" : "top-5 left-0 pt-2";

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex ${className}`}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setPinned(false);
          setOpen(false);
        }}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPinned(false);
            setOpen(false);
          }
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Info className="h-[15px] w-[15px]" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`absolute ${placementClasses} z-50 w-80 max-w-[min(22rem,85vw)] transition-all duration-150 ${
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
