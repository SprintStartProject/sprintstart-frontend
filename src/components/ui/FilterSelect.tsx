import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import {
  buttonHoverMotion,
  buttonHoverMotionDisabled,
  dockMagnifySpringToken,
  slidingIndicatorSpringToken,
} from "../../styles/tokens";

/**
 * Magnification of the highlighted option. Much gentler than the sidebar's
 * 1.12: the menu clips its own overflow, so an option may only grow into the
 * list's padding.
 */
const OPTION_HOVER_SCALE = 1.03;

/** Distance between the trigger and the menu, whichever side it opens on. */
const MENU_OFFSET = 6;

/** How tall the menu may get before it scrolls. */
const MENU_MAX_HEIGHT = 256;

/** Breathing room kept between the menu and the edge of the viewport. */
const VIEWPORT_MARGIN = 8;

/**
 * Below this, "there is room underneath" stops being true in any useful sense
 * and the menu flips above the trigger instead.
 */
const MIN_USABLE_HEIGHT = 160;

/**
 * Above modals (`z-50` on `<body>`), below toasts (`z-[200]`).
 *
 * A dropdown opened from inside a dialog has to clear it, and a toast arriving
 * while one is open has to clear the dropdown.
 */
const MENU_Z_INDEX = 100;

/**
 * Where the menu is painted, in viewport coordinates.
 *
 * Anchored by `top` when it opens downwards and by `bottom` when it flips, so
 * the edge that touches the trigger is the one that stays put — pinning `top`
 * for an upward menu would make it grow away from the control as options are
 * filtered.
 */
type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  isAbove: boolean;
};

export type FilterSelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type FilterSelectProps<TValue extends string> = {
  /** Accessible name for the control, e.g. "Filter runs by status". */
  label: string;
  value: TValue;
  options: FilterSelectOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
};

/** How long a typed sequence keeps accumulating before it starts a new search. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * Filter and sort dropdown used across the app.
 *
 * A native `<select>` cannot be styled once it is open -- the popup belongs to
 * the OS -- so this rebuilds the control to carry the same glass surface and
 * motion as the rest of the UI, in every browser.
 *
 * Follows the ARIA "select-only combobox" pattern: focus stays on the trigger
 * and the highlighted option is announced through `aria-activedescendant`, so
 * there is no focus to trap or restore. Everything a native select gives away
 * for free is reimplemented deliberately: arrow keys, Home/End, Enter/Escape,
 * typeahead, click-outside, and closing on blur.
 *
 * **The menu is rendered into `<body>`, not next to the trigger.** It used to
 * be an absolutely positioned sibling, which meant its `z-index` only counted
 * inside whatever stacking context the caller happened to sit in — and any
 * ancestor with `backdrop-filter`, `filter`, `transform` or `opacity` makes
 * one. The knowledge-gap detail page is the case that surfaced it: every card
 * there carries `backdrop-blur`, so the owner dropdown opened *underneath* the
 * card below it and its options could not be clicked. No z-index on this
 * component could have fixed that, because the whole control was already
 * trapped. A portal is the only way out, and it takes care of an ancestor's
 * `overflow: hidden` clipping the menu at the same time.
 *
 * The cost is that the menu no longer moves with the trigger for free, so its
 * position is measured on open and re-measured on scroll and resize.
 */
export function FilterSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: FilterSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadRef = useRef<{ query: string; timeoutId: number | null }>({
    query: "",
    timeoutId: null,
  });
  const listboxId = useId();
  const optionIdPrefix = useId();
  const prefersReducedMotion = useReducedMotion();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? "";

  /**
   * Measures the trigger and decides which side the menu opens on.
   *
   * Downwards unless the space under the trigger has stopped being usable and
   * there is more of it above — a control near the bottom of the window would
   * otherwise open into a two-option sliver.
   */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_OFFSET - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_OFFSET - VIEWPORT_MARGIN;
    const isAbove = spaceBelow < MIN_USABLE_HEIGHT && spaceAbove > spaceBelow;
    const available = isAbove ? spaceAbove : spaceBelow;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: isAbove ? undefined : rect.bottom + MENU_OFFSET,
      bottom: isAbove ? window.innerHeight - rect.top + MENU_OFFSET : undefined,
      maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(available, 0)),
      isAbove,
    });
  }, []);

  const open = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    // Measured before the menu is mounted, so it is never painted at 0,0 first.
    updatePosition();
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  // Re-measured rather than closed on scroll: a filter bar inside a scrolling
  // page is the normal case, and a menu that vanishes the moment the page moves
  // under the pointer is worse than one that follows. Capture phase, because a
  // scroll inside a nested container does not bubble to `window`.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const handle = () => updatePosition();

    window.addEventListener("scroll", handle, { capture: true, passive: true });
    window.addEventListener("resize", handle, { passive: true });

    return () => {
      window.removeEventListener("scroll", handle, { capture: true });
      window.removeEventListener("resize", handle);
    };
  }, [isOpen, updatePosition]);

  const commit = (index: number) => {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
    close();
    triggerRef.current?.focus();
  };

  // Pointer interactions outside the control dismiss it. `mousedown` rather
  // than `click`, so the menu is gone before the click lands on whatever is
  // underneath.
  //
  // The menu has to be tested separately from the container: it is portaled
  // into `<body>`, so `containerRef` no longer contains it, and checking the
  // container alone would treat a press on an option as an outside click —
  // unmounting the option before the click that selects it could land.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (!containerRef.current?.contains(target) && !listRef.current?.contains(target)) {
        close();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const typeahead = typeaheadRef.current;
    return () => {
      if (typeahead.timeoutId !== null) {
        window.clearTimeout(typeahead.timeoutId);
      }
    };
  }, []);

  const runTypeahead = (character: string) => {
    const typeahead = typeaheadRef.current;

    if (typeahead.timeoutId !== null) {
      window.clearTimeout(typeahead.timeoutId);
    }

    typeahead.query += character.toLowerCase();
    typeahead.timeoutId = window.setTimeout(() => {
      typeahead.query = "";
    }, TYPEAHEAD_RESET_MS);

    const matchIndex = options.findIndex((option) =>
      option.label.toLowerCase().startsWith(typeahead.query),
    );

    if (matchIndex === -1) return;

    if (isOpen) {
      setActiveIndex(matchIndex);
    } else {
      onChange(options[matchIndex].value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          open();
        } else {
          setActiveIndex((current) => Math.min(current + 1, options.length - 1));
        }
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          open();
        } else {
          setActiveIndex((current) => Math.max(current - 1, 0));
        }
        return;
      case "Home":
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) {
          commit(activeIndex);
        } else {
          open();
        }
        return;
      case "Escape":
        if (!isOpen) return;
        event.preventDefault();
        close();
        return;
      case "Tab":
        // Let focus leave naturally, but never leave an orphaned popup.
        close();
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          runTypeahead(event.key);
        }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <motion.button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        // Re-parents the menu onto the combobox in the accessibility tree.
        // It is portaled into `<body>`, so DOM containment can no longer say
        // that the listbox belongs to this control — `aria-owns` is the only
        // thing left that does, and without it the menu reads as loose page
        // content sitting outside every landmark.
        aria-owns={isOpen ? listboxId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? `${optionIdPrefix}-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        {...(disabled ? buttonHoverMotionDisabled : buttonHoverMotion)}
        className="inline-flex h-9 w-full cursor-pointer items-center justify-between gap-1.5 rounded-xl border border-app-border/70 bg-app-surface/70 px-2.5 text-sm text-app-text backdrop-blur-md transition-colors outline-none hover:border-app-brand-border-strong hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-app-border/70 disabled:hover:bg-app-surface/70"
      >
        <span className="truncate">{selectedLabel}</span>

        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && position && (
            <motion.ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={label}
              // The menu slides out of the trigger, so an upward one has to
              // start below its resting place rather than above it.
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: position.isAbove ? 6 : -6 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: position.isAbove ? 6 : -6 }
              }
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                minWidth: position.width,
                maxHeight: position.maxHeight,
                zIndex: MENU_Z_INDEX,
              }}
              // `p-1.5` is not cosmetic: the list clips its own overflow, so this
              // padding is the only room a magnified option has to grow into.
              className="fixed overflow-y-auto rounded-2xl border border-app-border/70 bg-app-surface/85 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  // No keyboard handler by design: in the
                  // select-only combobox pattern the options are
                  // never focused. Keyboard users drive the list
                  // from the trigger via `aria-activedescendant`,
                  // which is handled in `handleKeyDown` above.
                  <motion.li
                    key={option.value}
                    id={`${optionIdPrefix}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(index)}
                    animate={{
                      scale: isActive && !prefersReducedMotion ? OPTION_HOVER_SCALE : 1,
                    }}
                    transition={dockMagnifySpringToken}
                    // Anchored left so the label does not drift
                    // sideways as the row grows.
                    style={{ transformOrigin: "left center" }}
                    className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
                      isSelected ? "font-semibold text-app-brand-text" : "text-app-text"
                    }`}
                  >
                    {isActive && (
                      // One shared element rather than a
                      // background per row, so the highlight
                      // glides down the list instead of
                      // blinking from row to row.
                      <motion.span
                        aria-hidden="true"
                        layoutId={`${optionIdPrefix}-highlight`}
                        transition={
                          prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken
                        }
                        className="absolute inset-0 rounded-xl bg-app-surface-hover/80 ring-1 ring-app-border/50 backdrop-blur-sm ring-inset"
                      />
                    )}

                    <Check
                      aria-hidden="true"
                      className={`relative z-10 h-3.5 w-3.5 shrink-0 ${
                        isSelected ? "opacity-100" : "opacity-0"
                      }`}
                    />

                    <span className="relative z-10">{option.label}</span>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
