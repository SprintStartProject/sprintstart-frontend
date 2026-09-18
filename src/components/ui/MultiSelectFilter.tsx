import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Collapsible } from "./Collapsible";
import { buttonHoverMotion, buttonHoverMotionDisabled } from "../../styles/tokens";
import { MENU_Z_INDEX, menuTransition, usePopoverMenu } from "./usePopoverMenu";

/** One selectable row inside a section. */
export type MultiSelectFilterOption<TValue extends string> = {
  value: TValue;
  label: string;
  /**
   * How many artifacts this option would show if it were added — computed
   * against the reader's search and their *other* facets, so the number is a
   * promise about what clicking does rather than a statistic about the project.
   */
  count?: number;
  /** Optional leading glyph. Never the only carrier of meaning (standards §5). */
  icon?: ReactNode;
};

/** A titled group of options, folded by its own header. */
export type MultiSelectFilterSection<TValue extends string> = {
  id: string;
  label: string;
  options: MultiSelectFilterOption<TValue>[];
};

/** Trigger height, on the same scale as `ui/Field` and `ui/Button`. */
export type MultiSelectFilterSize = "sm" | "md";

const triggerSizeClasses: Record<MultiSelectFilterSize, string> = {
  sm: "h-9 px-2.5",
  md: "h-11 px-3.5",
};

type MultiSelectFilterProps<TValue extends string> = {
  /** Accessible name for the control, e.g. "Filter artifacts". */
  label: string;
  /** What the trigger reads, e.g. "GitHub, Jira" — the caller words it. */
  summary: string;
  /** Number of facets currently applied; drives the count badge. */
  activeCount: number;
  sections: MultiSelectFilterSection<TValue>[];
  selected: ReadonlySet<TValue>;
  onToggle: (value: TValue) => void;
  /**
   * Trigger height. `sm` when it shares a row with other compact controls, `md`
   * when it is the row's primary control and the search box is the small one.
   */
  size?: MultiSelectFilterSize;
  disabled?: boolean;
  className?: string;
  /** Prefix for the control's `data-testid`s. */
  testId?: string;
};

/**
 * Multi-select filter with grouped, counted options.
 *
 * The counterpart to {@link FilterSelect} for the case a `<select>` cannot
 * express: a facet where more than one answer is valid at once. It follows the
 * **disclosure** pattern rather than the combobox one, deliberately — the menu
 * holds real `<input type="checkbox">` elements, so the browser owns the
 * checked/indeterminate semantics and screen readers announce "checkbox,
 * checked" with no ARIA reimplementation to get wrong. `aria-expanded` plus
 * `aria-controls` on the trigger is the whole contract; the trigger is not a
 * combobox and must not claim to be one.
 *
 * **There is no "All" option, on purpose.** An empty selection *is* All, and a
 * choice that sometimes filters and sometimes resets is the single most
 * confusing thing a filter bar can offer. Clearing belongs to one explicit
 * control — the page's own reset, next to the results it clears — and not to a
 * checkbox that means two different things depending on what else is ticked.
 *
 * Placement and outside-dismissal come from {@link usePopoverMenu}, shared with
 * `FilterSelect`: the menu is portaled into `<body>` so no ancestor's stacking
 * context or `overflow: hidden` can swallow it.
 *
 * @param summary The trigger's text. Callers word it from the selection because
 *   only they know what the options mean ("3 sources" reads better than a list
 *   once the list is long).
 */
export function MultiSelectFilter<TValue extends string>({
  label,
  summary,
  activeCount,
  sections,
  selected,
  onToggle,
  size = "sm",
  disabled = false,
  className = "",
  testId = "multiselect-filter",
}: MultiSelectFilterProps<TValue>) {
  const { isOpen, position, containerRef, triggerRef, menuRef, open, close } =
    usePopoverMenu<HTMLDivElement>();
  const menuId = useId();
  const prefersReducedMotion = useReducedMotion();

  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(
    new Set<string>(),
  );

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Opening hands the keyboard to the menu: a disclosure that opens a panel of
  // checkboxes is expected to move focus into it, or the reader has to Tab past
  // the rest of the page to reach the first option. The menu container takes
  // focus (`tabIndex={-1}`) rather than its first checkbox, so the reader lands
  // on the labelled group and Tabs through the options in order.
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.focus();
  }, [isOpen, menuRef]);

  // Tabbing out dismisses the menu. Without this the panel stays open over
  // whatever the reader moved on to, and their next Escape closes something they
  // can no longer see. `focusout` rather than `blur`, because it bubbles from the
  // checkboxes up to the container.
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      // Focus leaving the document entirely (another window, devtools) is not a
      // dismissal — nothing was clicked or tabbed to.
      if (!next) return;
      if (containerRef.current?.contains(next) || menuRef.current?.contains(next)) return;
      close();
    };

    document.addEventListener("focusout", handleFocusOut);
    return () => document.removeEventListener("focusout", handleFocusOut);
  }, [isOpen, close, containerRef, menuRef]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/*
        Hand-written rather than `ui/Button`, like `FilterSelect`'s trigger: this
        is a popover trigger whose `aria-expanded`/`aria-controls` and open-state
        chevron are the control, not an action wearing a button's clothes. The
        surface classes are copied from that trigger on purpose; the height comes
        from `size`, because this control is asked to out-weigh the search box
        beside it and `FilterSelect` never is.
      */}
      <motion.button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={menuId}
        // Re-parents the menu onto the trigger in the accessibility tree. It is
        // portaled into `<body>`, so DOM containment can no longer say that the
        // menu belongs to this control — `aria-owns` is the only thing left that
        // does, and without it the menu reads as loose page content sitting
        // outside every landmark (axe's `region` rule fails on exactly that).
        aria-owns={isOpen ? menuId : undefined}
        // Non-modal dialog, not a modal one: it never traps focus and the page
        // behind it stays usable. The role is what keeps the portaled menu inside
        // the accessibility tree as *this* control's panel rather than orphaned
        // page content (axe's `region` rule).
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        {...(disabled ? buttonHoverMotionDisabled : buttonHoverMotion)}
        data-testid={`${testId}-trigger`}
        className={`inline-flex w-full cursor-pointer items-center gap-1.5 rounded-xl border border-app-border/70 bg-app-surface/70 text-sm text-app-text backdrop-blur-md transition-colors outline-none hover:border-app-brand-border-strong hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-app-border/70 disabled:hover:bg-app-surface/70 ${triggerSizeClasses[size]}`}
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-muted" />

        <span className="flex-1 truncate text-left">{summary}</span>

        {activeCount > 0 && (
          <Badge variant="brand" size="sm" className="shrink-0 tabular-nums">
            {activeCount}
          </Badge>
        )}

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
            <motion.div
              ref={menuRef}
              id={menuId}
              role="dialog"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: position.isAbove ? 6 : -6 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: position.isAbove ? 6 : -6 }
              }
              transition={menuTransition}
              style={{
                position: "fixed",
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
                maxWidth: position.maxWidth,
                zIndex: MENU_Z_INDEX,
              }}
              className="fixed overflow-y-auto rounded-2xl border border-app-border/70 bg-app-surface/85 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl outline-none"
              data-testid={`${testId}-menu`}
            >
              {sections.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-app-text-muted">Nothing to filter yet</p>
              )}

              {sections.map((section) => {
                const headerId = `${menuId}-${section.id}-header`;
                const panelId = `${menuId}-${section.id}-panel`;
                const isCollapsed = collapsedSections.has(section.id);

                return (
                  <div key={section.id} className="py-0.5">
                    <Button
                      id={headerId}
                      variant="ghost"
                      size="xs"
                      fullWidth
                      aria-expanded={!isCollapsed}
                      aria-controls={panelId}
                      onClick={() => toggleSection(section.id)}
                      className="justify-between"
                      data-testid={`${testId}-section-${section.id}`}
                      trailingIcon={
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isCollapsed ? "-rotate-90" : ""
                          }`}
                        />
                      }
                    >
                      {section.label}
                    </Button>

                    <Collapsible open={!isCollapsed}>
                      <div id={panelId} role="group" aria-labelledby={headerId}>
                        {section.options.map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-app-text transition-colors hover:bg-app-surface-hover"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(option.value)}
                              onChange={() => onToggle(option.value)}
                              data-testid={`${testId}-option-${option.value.toLowerCase()}`}
                              className="h-4 w-4 shrink-0 cursor-pointer accent-app-brand focus-visible:ring-2 focus-visible:ring-app-focus"
                            />

                            {option.icon}

                            <span className="flex-1 truncate">{option.label}</span>

                            {option.count !== undefined && (
                              <span className="shrink-0 text-xs text-app-text-subtle tabular-nums">
                                {option.count}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </Collapsible>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
