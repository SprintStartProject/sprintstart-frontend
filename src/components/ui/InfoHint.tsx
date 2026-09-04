import { useId, useState } from "react";
import { Info } from "lucide-react";

type InfoHintProps = {
  /** The helper text revealed on hover or focus. */
  text: string;
  /** Accessible label for the trigger. Defaults to "More information". */
  label?: string;
  className?: string;
};

/**
 * A small "i" trigger that reveals a section's helper text on hover or keyboard focus.
 *
 * Section headings used to carry their explanation as a paragraph under the title. This tucks the
 * same text behind an info affordance so the heading row stays compact, without losing it: the
 * tooltip is wired up with `aria-describedby` so it is always in the accessibility tree, shows on
 * hover and on focus, and dismisses on Escape. Kept CSS-driven (no framer-motion) on purpose, so it
 * never inherits SlidingTabPanel's `initial={false}` and pops instead of fading.
 */
export function InfoHint({ text, label = "More information", className = "" }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <Info className="h-[15px] w-[15px]" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute top-7 left-0 z-50 w-80 max-w-[min(22rem,85vw)] rounded-xl border border-app-border/70 bg-app-surface/95 p-3 text-xs leading-relaxed font-normal text-app-text-muted shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-150 ${
          open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
