import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { getModalDialogVariants, modalBackdropVariants } from "../../styles/tokens";
import { Button } from "./Button";
import { useScrollLock } from "./useScrollLock";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /**
   * Overrides the footer's layout classes (flex direction, gap, alignment).
   * Defaults to a mobile-stacked / desktop-row layout. The container's spacing
   * (padding) is always kept; only the layout portion is replaced.
   */
  footerClassName?: string;
  /** Optional controls shown in the header, left of the close button. */
  headerActions?: ReactNode;
  size?: ModalSize;
  zIndexClassName?: string;
  bodyClassName?: string;
  role?: "dialog" | "alertdialog";
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  isDismissDisabled?: boolean;
  /**
   * Extra right padding (px) on the centering area, which slides the centered
   * dialog left. Used to make room for a companion panel opening to its right.
   */
  contentInsetRight?: number;
  titleId?: string;
  descriptionId?: string;
  /**
   * `data-testid` for the dialog itself, and — suffixed with `-close` — for
   * its close button. Present because standards §5 requires E2E-targeted
   * elements to carry one, and a dialog is the thing a test opens and closes.
   */
  testId?: string;
  onClose: () => void;
};

const sizeClassNames: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("aria-hidden"),
  );
}

/**
 * Portal-based dialog overlay — the core modal primitive for all dialogs.
 * Supports configurable size (sm/md/lg/xl), role (dialog/alertdialog),
 * escape-key and backdrop dismiss, optional header actions, and a shared
 * backdrop/dialog animation via modalBackdropVariants + getModalDialogVariants.
 */
export function Modal({
  isOpen,
  title,
  description,
  children,
  footer,
  footerClassName = "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
  headerActions,
  size = "md",
  zIndexClassName = "z-50",
  bodyClassName = "px-5 py-5 sm:px-7 sm:py-6",
  role = "dialog",
  closeLabel = "Close dialog",
  closeOnBackdrop = true,
  closeOnEscape = true,
  isDismissDisabled = false,
  contentInsetRight = 0,
  titleId = "modal-title",
  descriptionId = "modal-description",
  testId,
  onClose,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Without this the page behind a dialog still scrolls under the pointer,
  // which is disorienting and, on a long admin table, loses the row the user
  // opened the dialog from.
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      // The autofocus runs a frame late, so a keyboard user (or a test
      // typing into the dialog) may already have moved focus inside it by
      // now. Don't yank it back to the first control in that case.
      const active = document.activeElement;
      if (active && active !== dialog && dialog.contains(active)) return;

      const [firstFocusable] = getFocusableElements(dialog);
      (firstFocusable ?? dialog).focus();
    });

    return () => {
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape && !isDismissDisabled) {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, isDismissDisabled, isOpen, onClose]);

  const dialogVariants = getModalDialogVariants(Boolean(prefersReducedMotion));

  // Rendered into <body> so the dialog is never trapped inside an ancestor's
  // stacking context. Callers sit anywhere in the tree -- the sidebar's
  // `position: sticky` wrapper, for one, creates a stacking context that would
  // otherwise cap the overlay below page content that uses a positive z-index.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={modalBackdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center overflow-y-auto bg-app-overlay p-4 backdrop-blur-md transition-[padding] duration-300 ease-out`}
          style={contentInsetRight ? { paddingRight: contentInsetRight } : undefined}
        >
          {closeOnBackdrop && (
            <button
              type="button"
              aria-label={closeLabel}
              disabled={isDismissDisabled}
              onClick={onClose}
              className="absolute inset-0 disabled:cursor-default"
            />
          )}

          <motion.div
            ref={dialogRef}
            data-testid={testId}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`relative z-10 flex max-h-[calc(100dvh-2rem)] w-full ${sizeClassNames[size]} flex-col overflow-hidden rounded-[28px] border border-app-border bg-app-bg shadow-2xl`}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-[200px] w-[200px] rounded-full bg-app-brand-glow blur-3xl" />

            <div className="relative z-10 flex shrink-0 items-start justify-between gap-4 px-5 pt-6 sm:px-7 sm:pt-7">
              <div>
                <h2 id={titleId} className="text-[22px] leading-tight font-bold text-app-text">
                  {title}
                </h2>

                {description && (
                  <div
                    id={descriptionId}
                    className="mt-1 text-xs leading-relaxed text-app-text-muted"
                  >
                    {description}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {headerActions}

                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  onClick={onClose}
                  disabled={isDismissDisabled}
                  aria-label={closeLabel}
                  data-testid={testId ? `${testId}-close` : undefined}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {children && (
              <div className={`relative z-10 min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
                {children}
              </div>
            )}

            {footer && (
              <div
                className={`relative z-10 shrink-0 px-5 pb-6 sm:px-7 sm:pb-7 ${footerClassName} ${
                  children ? "" : "pt-6"
                }`}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
