import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { dockMagnifySpringToken, slidingIndicatorSpringToken } from "../../styles/tokens";

/** Matches the dock magnification of the sidebar, scaled down for dense bars. */
const TAB_HOVER_SCALE = 1.06;

export type SegmentedTabOption<TValue extends string> = {
  value: TValue;
  label: string;
  /** Optional leading icon, already sized by the caller. */
  icon?: ReactNode;
  /** Optional trailing count badge. */
  count?: number;
  /**
   * Optional `data-testid` for end-to-end targeting, per AGENTS.md §5.
   *
   * Only for options whose label is not a stable handle — a provider switch
   * whose labels are product names, say. Prefer the accessible name where it
   * is stable, so the test asserts what a user can actually see.
   */
  testId?: string;
};

type SegmentedTabsProps<TValue extends string> = {
  value: TValue;
  options: SegmentedTabOption<TValue>[];
  onChange: (value: TValue) => void;
  /**
   * Unique id for the sliding pill. Framer Motion matches `layoutId` globally,
   * so two bars sharing one id would animate the pill between them.
   */
  layoutId: string;
  ariaLabel: string;
  /** Stretch options to fill the row instead of sizing them to their label. */
  fullWidth?: boolean;
  className?: string;
};

/**
 * The one segmented control for switching sections, used by every tab bar in
 * the app.
 *
 * Exists because the three bars that grew independently had drifted into three
 * different looks. Motion matches the sidebar: the hovered option magnifies,
 * and the active fill is a single shared element that slides between options
 * rather than blinking from one to the next.
 *
 * Deliberately a group of toggle buttons rather than an ARIA tablist. A real
 * tablist promises things this does not implement -- `aria-controls` pointing
 * at a `tabpanel`, and arrow-key navigation within the bar -- and a screen
 * reader announcing "tab 1 of 3" would set an expectation the component then
 * fails to meet. `aria-pressed` describes exactly what these buttons do.
 *
 * **The row scrolls, and never shows a scrollbar for it.** The bar needs the
 * overflow: `p-1` is the room a magnified option grows into, and a bar with
 * more options than fit has to be reachable. What it does not need is the
 * global slim scrollbar drawing a stray line under the pill -- which it does
 * even on bars that never scroll, because hover magnification alone pushes
 * past the padding. Team management hid it at its own call site first; the
 * second bar that wanted the same thing is what moved it in here.
 *
 * `!important` is required, not defensive: the global rule is
 * `* { scrollbar-width: thin }` and sits outside any cascade layer, so it beats
 * every Tailwind utility no matter how specific. The webkit rule is the
 * fallback for Chrome below 121, which does not support `scrollbar-width` at
 * all; newer Chrome ignores `::-webkit-scrollbar` once `scrollbar-width` is set.
 *
 * Hiding it is only safe because the active option is kept in view: with no
 * scrollbar and no thumb to drag, a pill that slid off the edge -- which a
 * swipe between tabs can do on a narrow bar -- would leave the reader with no
 * sign of where they are. The container is scrolled directly rather than
 * through `scrollIntoView`, which would also scroll the page vertically.
 */
export function SegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  layoutId,
  ariaLabel,
  fullWidth = false,
  className = "",
}: SegmentedTabsProps<TValue>) {
  const [hovered, setHovered] = useState<TValue | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Brings the selected option back into the row when it is off either edge, and does nothing
  // when it is already visible -- so an ordinary click on a visible tab never scrolls anything.
  useEffect(() => {
    const row = rowRef.current;
    const active = activeRef.current;
    if (!row || !active) return;

    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    // A little past the edge, so the option arrives looking reachable rather than flush against
    // the border with the next one clipped behind it.
    const margin = 12;

    const target =
      left < row.scrollLeft
        ? Math.max(left - margin, 0)
        : right > row.scrollLeft + row.clientWidth
          ? right - row.clientWidth + margin
          : null;
    if (target === null) return;

    // `Element.scrollTo` does not exist in jsdom. Nothing here reaches it today -- every layout
    // value is zero under test, so neither branch above fires -- but a primitive this many pages
    // render should not be one mocked `clientWidth` away from throwing. Assigning `scrollLeft` is
    // the same scroll without the easing, which is all a test would need anyway.
    if (typeof row.scrollTo === "function") {
      row.scrollTo({ left: target, behavior: prefersReducedMotion ? "auto" : "smooth" });
    } else {
      row.scrollLeft = target;
    }
  }, [value, prefersReducedMotion]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={ariaLabel}
      // `p-1` is what a magnified option grows into: the row may scroll
      // horizontally, and overflow clips at the padding box.
      className={`${
        fullWidth ? "flex w-full" : "inline-flex max-w-full"
      } [scrollbar-width:none]! gap-1 overflow-x-auto rounded-2xl border border-app-border/70 bg-app-bg-soft/70 p-1 backdrop-blur-md [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const isMagnified = !prefersReducedMotion && hovered === option.value;

        return (
          <motion.button
            key={option.value}
            ref={isActive ? activeRef : undefined}
            type="button"
            aria-pressed={isActive}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            onHoverStart={() => setHovered(option.value)}
            onHoverEnd={() => setHovered((current) => (current === option.value ? null : current))}
            animate={{ scale: isMagnified ? TAB_HOVER_SCALE : 1 }}
            transition={dockMagnifySpringToken}
            className={`group relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              fullWidth ? "flex-1" : ""
            } ${isActive ? "text-white" : "text-app-text-muted hover:text-app-text"}`}
          >
            {isActive ? (
              <motion.span
                aria-hidden="true"
                layoutId={layoutId}
                transition={prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken}
                className="absolute inset-0 rounded-xl bg-app-brand shadow-[0_6px_18px_-8px_var(--color-app-brand)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl bg-app-surface opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
              />
            )}

            {option.icon ? (
              <span className="relative z-10 flex items-center">{option.icon}</span>
            ) : null}

            <span className="relative z-10 leading-none">{option.label}</span>

            {typeof option.count === "number" && (
              // `leading-none` on both label and count is what
              // actually centres them: the count's smaller font
              // otherwise brings a smaller line box.
              <span
                className={`relative z-10 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums ${
                  isActive ? "bg-white/20 text-white" : "bg-app-surface text-app-text-subtle"
                }`}
              >
                {option.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
