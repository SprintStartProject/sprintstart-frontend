import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
   * Optional `data-testid` for end-to-end targeting, per FRONTEND_CODING_STANDARDS.md §5.
   *
   * Only for options whose label is not a stable handle — a provider switch
   * whose labels are product names, say. Prefer the accessible name where it
   * is stable, so the test asserts what a user can actually see.
   */
  testId?: string;
  /**
   * Views inside this option — Members and Roles inside Team, say. They are drawn only while the
   * option is selected: the selected pill grows to hold them and folds them away again when
   * another option is chosen, so a section's own views live in the one bar instead of a second
   * slider under it.
   */
  subOptions?: SegmentedSubOption[];
  /** Which of `subOptions` is selected. */
  subValue?: string;
  onSubChange?: (value: string) => void;
  /** Accessible name of the group the sub-options form, e.g. "Team views". */
  subAriaLabel?: string;
};

/**
 * One view inside a {@link SegmentedTabOption}: a label and a count, one level down. No icon —
 * the parent's already says what they are, and the grown pill has to fit the bar.
 */
export type SegmentedSubOption = {
  value: string;
  label: string;
  count?: number;
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
  /** Stretch options to fill the row instead of sizing them to their label. Ignored when `wrap` is true. */
  fullWidth?: boolean;
  /** Allow options to wrap into multiple rows when they exceed container width. */
  wrap?: boolean;
  /**
   * Wrap the options into multiple rows below the given breakpoint while the bar keeps its
   * scrolling single row at or above it. For bars that only overflow on small screens —
   * `wrap` wraps at every width, and this variant leaves the desktop row sizing itself to
   * its label. Ignored when `wrap` is true.
   */
  wrapBelow?: "lg";
  /**
   * Visual size variant.
   * - `md` (default): Standard height with text-sm, rounded-xl pills, and px-4 py-2.
   * - `sm`: Compact height with text-xs, rounded-lg pills, and px-3 py-1.5 for secondary underfilter rows.
   */
  size?: "sm" | "md";
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
 *
 * **An option can hold views of its own** (`subOptions`). While it is selected the pill widens
 * and they pop out beside its label, as smaller pills on the brand fill; choosing another option
 * folds them away. A tab inside the tab, rather than a second bar further down that looks like a
 * sibling and slides on its own.
 */
export function SegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  layoutId,
  ariaLabel,
  fullWidth = false,
  wrap = false,
  wrapBelow,
  size = "md",
  className = "",
}: SegmentedTabsProps<TValue>) {
  const [hovered, setHovered] = useState<TValue | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const isCompact = size === "sm";

  // Brings the selected option back into the row when it is off either edge, and does nothing
  // when it is already visible -- so an ordinary click on a visible tab never scrolls anything.
  useEffect(() => {
    if (wrap) return;
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
  }, [value, prefersReducedMotion, wrap]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={ariaLabel}
      // `p-1` (or `p-0.5` on sm) is what a magnified option grows into: the row may scroll
      // horizontally, and overflow clips at the padding box.
      className={`${
        wrap
          ? "flex w-full flex-wrap"
          : fullWidth
            ? "flex w-full [scrollbar-width:none]! overflow-x-auto [&::-webkit-scrollbar]:hidden"
            : "inline-flex max-w-full [scrollbar-width:none]! overflow-x-auto [&::-webkit-scrollbar]:hidden"
      } ${wrapBelow === "lg" ? "max-lg:flex-wrap" : ""} gap-1 ${
        isCompact ? "rounded-xl p-0.5" : "rounded-2xl p-1"
      } border border-app-border/70 bg-app-bg-soft/70 backdrop-blur-md ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const isMagnified = !prefersReducedMotion && hovered === option.value;
        const subOptions = option.subOptions ?? [];
        // Grows only while selected, and only when there is more than one view to choose from.
        const grown = isActive && subOptions.length > 1;

        const pill = (
          <motion.span
            aria-hidden="true"
            layoutId={layoutId}
            transition={prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken}
            className={`absolute inset-0 ${
              isCompact
                ? "rounded-lg shadow-[0_4px_12px_-4px_var(--color-app-brand)]"
                : "rounded-xl shadow-[0_6px_18px_-8px_var(--color-app-brand)]"
            } bg-app-brand`}
          />
        );

        const button = (
          <motion.button
            key={option.value}
            ref={isActive ? activeRef : undefined}
            type="button"
            aria-pressed={isActive}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            onHoverStart={() => setHovered(option.value)}
            onHoverEnd={() => setHovered((current) => (current === option.value ? null : current))}
            // The grown pill does not magnify: it is already the widest thing in the bar, and a
            // label scaling inside a fill that does not would come apart from it.
            animate={{ scale: isMagnified && !grown ? TAB_HOVER_SCALE : 1 }}
            transition={dockMagnifySpringToken}
            className={`group relative inline-flex ${
              wrap ? "min-w-fit" : "shrink-0"
            } items-center justify-center ${
              isCompact
                ? "gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                : "gap-2 rounded-xl px-4 py-2 text-sm max-sm:py-3"
            } font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              fullWidth && !wrap ? (wrapBelow ? "lg:flex-1" : "flex-1") : ""
            } ${grown ? (isCompact ? "pr-2" : "pr-2.5") : ""} ${
              isActive ? "text-white" : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {isActive ? (
              grown ? null : (
                pill
              )
            ) : (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 ${
                  isCompact ? "rounded-lg" : "rounded-xl"
                } bg-app-surface opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100`}
              />
            )}

            {option.icon ? (
              <span className="relative z-10 flex items-center">{option.icon}</span>
            ) : null}

            <span className="relative z-10 leading-none">{option.label}</span>

            {/* Once grown, the views carry their own counts; the section's would repeat one. */}
            {typeof option.count === "number" && !grown && (
              // `leading-none` on both label and count is what
              // actually centres them: the count's smaller font
              // otherwise brings a smaller line box.
              <span
                className={`relative z-10 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 leading-none font-bold tabular-nums ${
                  isCompact ? "min-w-4 text-[10px]" : "min-w-5 text-[11px]"
                } ${isActive ? "bg-white/20 text-white" : "bg-app-surface text-app-text-subtle"}`}
              >
                {option.count}
              </span>
            )}
          </motion.button>
        );

        if (subOptions.length <= 1) return button;

        return (
          <div
            key={option.value}
            className={`relative inline-flex ${wrap ? "min-w-fit" : "shrink-0"} items-center ${
              fullWidth && !wrap ? (wrapBelow ? "lg:flex-1" : "flex-1") : ""
            }`}
          >
            {grown && pill}
            {button}
            <AnimatePresence initial={false}>
              {grown && (
                <motion.div
                  key="views"
                  role="group"
                  aria-label={option.subAriaLabel ?? `${option.label} views`}
                  initial={prefersReducedMotion ? false : { width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 36 }
                  }
                  className="relative z-10 flex items-center overflow-hidden"
                >
                  <span aria-hidden="true" className="mr-1 h-4 w-px shrink-0 bg-white/30" />
                  <span className={`flex items-center gap-0.5 ${isCompact ? "pr-0.5" : "pr-1"}`}>
                    {subOptions.map((sub) => {
                      const selected = (option.subValue ?? subOptions[0].value) === sub.value;
                      return (
                        <button
                          key={sub.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => option.onSubChange?.(sub.value)}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none ${
                            isCompact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"
                          } ${
                            selected
                              ? "bg-app-surface text-app-text shadow-sm"
                              : "text-white/80 hover:bg-white/15 hover:text-white"
                          }`}
                        >
                          <span className="leading-none">{sub.label}</span>
                          {typeof sub.count === "number" && (
                            <span
                              className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold tabular-nums ${
                                selected
                                  ? "bg-app-brand-soft text-app-brand-text"
                                  : "bg-white/20 text-white"
                              }`}
                            >
                              {sub.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
