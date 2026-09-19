import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import {
  buttonHoverMotion,
  buttonHoverMotionDisabled,
  dockMagnifySpringToken,
  slidingIndicatorSpringToken,
} from "../../styles/tokens";
import { MENU_Z_INDEX, menuTransition, usePopoverMenu } from "./usePopoverMenu";

/**
 * Magnification of the highlighted option. Much gentler than the sidebar's
 * 1.12: the menu clips its own overflow, so an option may only grow into the
 * list's padding.
 */
const OPTION_HOVER_SCALE = 1.03;

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
  const [activeIndex, setActiveIndex] = useState(0);
  // Open/close state, measured placement and outside-dismissal all come from the
  // shared popover hook, so this control and `MultiSelectFilter` cannot drift
  // apart on where the menu lands or what counts as an outside press.
  const { isOpen, position, containerRef, triggerRef, menuRef, open, close } =
    usePopoverMenu<HTMLUListElement>();
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

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    open();
  };

  // Re-measured rather than closed on scroll: a filter bar inside a scrolling
  // page is the normal case, and a menu that vanishes the moment the page moves
  // under the pointer is worse than one that follows. Capture phase, because a
  // scroll inside a nested container does not bubble to `window`.
  const commit = (index: number) => {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
    close();
    triggerRef.current?.focus();
  };

  // Focus never leaves the trigger in the select-only combobox pattern, so the
  // browser does not scroll the list for us the way it would if the options
  // themselves were focused. Past the visible window, arrow keys and typeahead
  // would otherwise move a highlight nobody can see.
  useEffect(() => {
    if (!isOpen) return;
    const option = document.getElementById(`${optionIdPrefix}-${activeIndex}`);
    option?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex, optionIdPrefix]);

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
          openMenu();
        } else {
          setActiveIndex((current) => Math.min(current + 1, options.length - 1));
        }
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          openMenu();
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
          openMenu();
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
        onClick={() => (isOpen ? close() : openMenu())}
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
              ref={menuRef}
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
              transition={menuTransition}
              style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                minWidth: position.width,
                maxWidth: position.maxWidth,
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
