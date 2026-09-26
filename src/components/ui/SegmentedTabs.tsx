import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
   * Optional `data-testid` for end-to-end targeting, per AGENTS.md §5.
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
 * **An option can hold views of its own** (`subOptions`). While it is selected they hang below
 * its pill as a droplet -- a small brand-coloured bubble joined to the pill by a tail -- and
 * choosing another option folds it back up. A tab inside the tab, rather than a second bar
 * further down that looks like a sibling and slides on its own. Below rather than beside: the
 * views used to widen the pill sideways, which pushed every tab after it along the bar.
 */
export function SegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  layoutId,
  ariaLabel,
  fullWidth = false,
  wrap = false,
  size = "md",
  className = "",
}: SegmentedTabsProps<TValue>) {
  const [hovered, setHovered] = useState<TValue | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const dropletRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  /** The droplet element last placed, so a freshly mounted one lands without sliding in. */
  const placedDropletRef = useRef<HTMLDivElement | null>(null);
  const isCompact = size === "sm";

  const activeOption = options.find((option) => option.value === value);
  const activeViews = activeOption?.subOptions ?? [];
  const showDroplet = activeViews.length > 1;
  // Bars without views anywhere keep their old, single-element shape.
  const hasNestedViews = options.some((option) => (option.subOptions?.length ?? 0) > 1);

  // Hangs the droplet under the selected pill: centred on it, but kept inside the column, with
  // the tail still pointing at the pill. Written to the elements rather than kept in state -- it is
  // pure layout, measured after every change that can move the pill (a new selection, the row
  // scrolling, the window resizing).
  useLayoutEffect(() => {
    if (!showDroplet) return;

    const place = () => {
      const outer = outerRef.current;
      // The pressed option read from the row itself, not from `activeRef`: a motion button hands
      // its ref over only after this effect has run, so on a switch from Team to Escalations the
      // ref still pointed at Team and the droplet stayed under the tab that was left.
      const active = rowRef.current?.querySelector<HTMLElement>(
        ':scope > button[aria-pressed="true"]',
      );
      const droplet = dropletRef.current;
      if (!outer || !active || !droplet) return;

      const outerBox = outer.getBoundingClientRect();
      const activeBox = active.getBoundingClientRect();
      const center = activeBox.left - outerBox.left + activeBox.width / 2;
      const width = droplet.offsetWidth;
      // Free to reach past the bar's own right end, as long as it stays inside the column the bar
      // sits in: under the last tab a droplet wider than the tab would otherwise sit off-centre.
      const room = outer.parentElement
        ? outer.parentElement.getBoundingClientRect().right - outerBox.left
        : outerBox.width;
      const left = Math.min(Math.max(center - width / 2, 0), Math.max(room - width, 0));

      const fresh = placedDropletRef.current !== droplet;
      if (fresh) droplet.style.transition = "none";
      droplet.style.left = `${left}px`;
      if (tailRef.current) tailRef.current.style.left = `${center - left}px`;
      if (fresh) {
        // Commits the position before the transition comes back, so it does not animate from 0.
        void droplet.offsetWidth;
        droplet.style.transition = "";
        placedDropletRef.current = droplet;
      }
    };

    place();
    const row = rowRef.current;
    row?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      row?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [value, showDroplet, options.length]);

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

  const row = (
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
      } gap-1 ${
        isCompact ? "rounded-xl p-0.5" : "rounded-2xl p-1"
      } border border-app-border/70 bg-app-bg-soft/70 backdrop-blur-md ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const isMagnified = !prefersReducedMotion && hovered === option.value;
        // Its views hang below it while selected, and only when there is more than one of them.
        const grown = isActive && (option.subOptions?.length ?? 0) > 1;

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
            // The pill with a droplet under it does not magnify: the droplet would come apart from it.
            animate={{ scale: isMagnified && !grown ? TAB_HOVER_SCALE : 1 }}
            transition={dockMagnifySpringToken}
            className={`group relative inline-flex ${
              wrap ? "min-w-fit" : "shrink-0"
            } items-center justify-center ${
              isCompact
                ? "gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                : "gap-2 rounded-xl px-4 py-2 text-sm"
            } font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              fullWidth && !wrap ? "flex-1" : ""
            } ${isActive ? "text-white" : "text-app-text-muted hover:text-app-text"}`}
          >
            {isActive ? (
              pill
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

            {/* While its views are out they carry their own counts; the section's would repeat one. */}
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
      })}
    </div>
  );

  if (!hasNestedViews) return row;

  return (
    <div
      ref={outerRef}
      className={`relative ${wrap || fullWidth ? "flex w-full" : "inline-flex max-w-full"}`}
    >
      {row}
      <AnimatePresence initial={false}>
        {showDroplet && activeOption && (
          <motion.div
            key="views"
            ref={dropletRef}
            role="group"
            aria-label={activeOption.subAriaLabel ?? `${activeOption.label} views`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10, scaleY: 0.3 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scaleY: 0.3 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 30 }
            }
            style={{ originY: 0 }}
            // `mt-2` clears the bar's border; the tail reaches back up through it towards the pill.
            // Slides along with the pill when another section with views is chosen.
            className="absolute top-full left-0 z-20 mt-2 transition-[left] duration-300 ease-out motion-reduce:transition-none"
          >
            <span
              ref={tailRef}
              aria-hidden="true"
              className={`absolute -top-2 h-4 w-4 -translate-x-1/2 rotate-45 bg-app-progress-fill ${
                isCompact ? "rounded-[2px]" : "rounded-[3px]"
              }`}
            />
            {/* The app's brand gradient, blue into indigo, with a soft halo: set apart from the
                flat blue pill above it, so the views read as the thing to pick next. */}
            <span
              className={`relative flex items-center gap-1 bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end shadow-[0_10px_28px_-10px_var(--color-app-progress-fill-end)] ring-4 ring-app-brand/15 ${
                isCompact ? "rounded-xl p-1" : "rounded-2xl p-1.5"
              }`}
            >
              {activeViews.map((sub) => {
                const selected = (activeOption.subValue ?? activeViews[0].value) === sub.value;
                return (
                  <button
                    key={sub.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => activeOption.onSubChange?.(sub.value)}
                    className={`inline-flex shrink-0 items-center gap-1.5 font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none ${
                      isCompact
                        ? "rounded-lg px-2.5 py-1.5 text-xs"
                        : "rounded-xl px-3.5 py-2 text-sm"
                    } ${
                      selected
                        ? "bg-app-surface text-app-text shadow-sm"
                        : "text-white/85 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    <span className="leading-none">{sub.label}</span>
                    {typeof sub.count === "number" && (
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums ${
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
}
