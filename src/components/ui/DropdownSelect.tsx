import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
 * Magnification of the highlighted option. Gentle: the menu clips its own
 * overflow, so an option may only grow into the list's padding.
 */
const OPTION_HOVER_SCALE = 1.03;

/** How long a typed sequence keeps accumulating before it starts a new search. */
const TYPEAHEAD_RESET_MS = 500;

/** Menu sizing/anchoring constants. */
const MENU_MAX_HEIGHT = 256;
const MENU_GAP = 6;

export type DropdownOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type DropdownSelectProps<TValue extends string> = {
  /** Accessible name for the control, e.g. "Project manager". */
  label: string;
  value: TValue;
  options: DropdownOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * The animated single-select dropdown for forms and dialogs — the same glass
 * trigger and sliding-highlight menu as {@link FilterSelect}, but with its popup
 * portalled to `<body>` and positioned `fixed` against the trigger.
 *
 * That portal is the whole reason this exists separately: `FilterSelect` renders
 * its menu inline, which a dialog's `overflow-hidden` (or a transformed
 * ancestor, e.g. an animating modal) clips and stacks under the footer. Rendering
 * to `<body>` escapes both, and the menu flips above the trigger when there is
 * not enough room below. Reach for `FilterSelect` in toolbars, this in modals.
 *
 * Follows the ARIA "select-only combobox" pattern: focus stays on the trigger and
 * the highlighted option is announced through `aria-activedescendant`, so there
 * is no focus to trap or restore. Arrow keys, Home/End, Enter/Escape, typeahead,
 * click-outside and closing on blur are all reimplemented deliberately.
 */
export function DropdownSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: DropdownSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // The open menu is portalled to <body> and positioned with these fixed
  // coordinates, so no `overflow-hidden`/transformed ancestor can clip it. It
  // starts off-screen (but already `fixed`) so that if it ever paints before the
  // layout effect measures, it is never visible at the wrong place.
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
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

  const open = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
    close();
    triggerRef.current?.focus();
  };

  // Anchor the fixed-position menu to the trigger, flipping above it when there
  // is not enough room below (e.g. the trigger sits low in a dialog).
  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_MAX_HEIGHT + MENU_GAP && rect.top > spaceBelow;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      minWidth: rect.width,
      maxWidth: `calc(100vw - ${rect.left + 8}px)`,
      maxHeight: MENU_MAX_HEIGHT,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  }, []);

  // Position the menu before the browser paints it (a plain effect would let it
  // paint once at its stale/off-screen spot first), then keep it glued to the
  // trigger through scrolls (page or any nested container) and viewport resizes.
  useLayoutEffect(() => {
    if (!isOpen) return;

    positionMenu();
    const reposition = () => positionMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isOpen, positionMenu]);

  // Pointer interactions outside the control dismiss it. `mousedown` rather than
  // `click`, so the menu is gone before the click lands on whatever is underneath.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // The menu lives in a portal outside the container, so it is checked
      // separately or clicking an option would read as "outside".
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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
        // The portal wraps AnimatePresence — not the other way around. An
        // AnimatePresence whose child is a `createPortal(...)` silently drops
        // that child in the browser (it renders in jsdom, which is why tests did
        // not catch it), so the menu never appeared.
        <AnimatePresence>
          {isOpen && (
            <motion.ul
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={label}
              style={menuStyle}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              // Fixed and portalled to <body>, so an `overflow-hidden` or
              // transformed ancestor can't clip it. `p-1.5` is not cosmetic: the
              // list clips its own overflow, so this padding is the only room a
              // magnified option has to grow into.
              className="z-[60] overflow-y-auto rounded-2xl border border-app-border/70 bg-app-surface/85 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  // No keyboard handler by design: in the select-only combobox
                  // pattern the options are never focused. Keyboard users drive
                  // the list from the trigger via `aria-activedescendant`.
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
                    // Anchored left so the label does not drift sideways as the
                    // row grows.
                    style={{ transformOrigin: "left center" }}
                    className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
                      isSelected ? "font-semibold text-app-brand-text" : "text-app-text"
                    }`}
                  >
                    {isActive && (
                      // One shared element rather than a background per row, so
                      // the highlight glides down the list instead of blinking.
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
