import { useEffect, useId, useRef, useState } from "react";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
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

    // Pointer interactions outside the control dismiss it. `mousedown` rather
    // than `click`, so the menu is gone before the click lands on whatever is
    // underneath.
    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
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
                aria-activedescendant={
                    isOpen ? `${optionIdPrefix}-${activeIndex}` : undefined
                }
                disabled={disabled}
                onClick={() => (isOpen ? close() : open())}
                onKeyDown={handleKeyDown}
                {...(disabled ? buttonHoverMotionDisabled : buttonHoverMotion)}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-between gap-1.5 rounded-xl border border-app-border/70 bg-app-surface/70 px-2.5 text-sm text-app-text outline-none backdrop-blur-md transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-app-border/70 disabled:hover:bg-app-surface/70"
            >
                <span className="truncate">{selectedLabel}</span>

                <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.ul
                        id={listboxId}
                        role="listbox"
                        aria-label={label}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        // `p-1.5` is not cosmetic: the list clips its own overflow, so this
        // padding is the only room a magnified option has to grow into.
                        className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 min-w-full overflow-y-auto rounded-2xl border border-app-border/70 bg-app-surface/85 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl"
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
                                        scale:
                                            isActive && !prefersReducedMotion
                                                ? OPTION_HOVER_SCALE
                                                : 1,
                                    }}
                                    transition={dockMagnifySpringToken}
                                    // Anchored left so the label does not drift
                                    // sideways as the row grows.
                                    style={{ transformOrigin: "left center" }}
                                    className={`relative flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-sm transition-colors ${
                                        isSelected
                                            ? "font-semibold text-app-brand-text"
                                            : "text-app-text"
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
                                                prefersReducedMotion
                                                    ? { duration: 0 }
                                                    : slidingIndicatorSpringToken
                                            }
                                            className="absolute inset-0 rounded-xl bg-app-surface-hover/80 ring-1 ring-inset ring-app-border/50 backdrop-blur-sm"
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
            </AnimatePresence>
        </div>
    );
}
