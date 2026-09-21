import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { SWIPE_IGNORE_ATTRIBUTE } from "../../hooks/useHorizontalWheelNavigation";
import { getModalDialogVariants, modalBackdropVariants } from "../../styles/tokens";
import { Button } from "./Button";
import { useDialogFocus } from "./useDialogFocus";
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
   * A failure that belongs to what is in the dialog, shown just above the footer.
   *
   * Without it, forms in a dialog reported their failures through whatever page-wide error bar
   * their page had -- which renders in the page body, underneath the open overlay. The spinner
   * stopped, the dialog stayed open with the typed text still in it, and nothing on screen said
   * why.
   */
  errorMessage?: ReactNode;
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
  errorMessage,
  testId,
  onClose,
}: ModalProps) {
  // Moving focus in, keeping Tab inside and putting focus back is shared with the canvas covers,
  // which are dialogs drawn over a graph rather than overlays in a portal.
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen);
  const prefersReducedMotion = useReducedMotion();

  // Without this the page behind a dialog still scrolls under the pointer,
  // which is disorienting and, on a long admin table, loses the row the user
  // opened the dialog from.
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen || !closeOnEscape || isDismissDisabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
            // A sideways flick inside a dialog is a flick inside a dialog. Without this it reached
            // the page underneath, where it switches tabs behind the open overlay.
            {...{ [SWIPE_IGNORE_ATTRIBUTE]: "" }}
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

            {errorMessage && (
              <div className="relative z-10 shrink-0 px-5 pt-1 pb-4 sm:px-7">
                <p
                  role="alert"
                  className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
                >
                  {errorMessage}
                </p>
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
