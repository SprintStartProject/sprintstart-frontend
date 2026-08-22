import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { PanelPresenceContext } from "./panelPresenceContext";
import { sidePanelSlideToken } from "../../styles/tokens";

type SidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  zIndexClassName?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  panelBackgroundClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  headerDividerClassName?: string;
  footerClassName?: string;
  closeAriaLabel?: string;
  closeOnEscape?: boolean;
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
 * Slide-in drawer panel. Uses sidePanelSlideToken for animation and
 * PanelPresence for guaranteed unmount timing. Supports optional overlay,
 * title, description, leading content, badge, header actions, and footer.
 * Used by admin drawers, team member detail panels, and source details.
 */
export function SidePanel({
  isOpen: isOpenProp,
  onClose,
  title,
  description,
  leading,
  badge,
  actions,
  children,
  footer,
  widthClassName = "w-full max-w-xl sm:w-[34rem]",
  zIndexClassName = "z-50",
  showOverlay = true,
  overlayClassName = "bg-app-overlay",
  panelClassName = "",
  panelBackgroundClassName = "bg-app-bg",
  contentClassName = "px-6 py-6",
  headerClassName = "px-6 py-5",
  headerDividerClassName = "border-b border-app-border",
  footerClassName = "border-t border-app-border bg-app-bg px-6 py-5",
  closeAriaLabel = "Close details",
  closeOnEscape = true,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // A surrounding `PanelPresence` knows the panel is closing before the
  // caller has torn its props down, so it wins over the local prop.
  const presence = useContext(PanelPresenceContext);
  const isOpen = presence ? presence.isOpen : isOpenProp;

  const prefersReducedMotion = useReducedMotion();
  const panelTransition = prefersReducedMotion ? { duration: 0 } : sidePanelSlideToken;

  useEffect(() => {
    if (!isOpen) {
      previouslyFocusedElement.current?.focus();
      return;
    }

    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const animationFrameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const [firstFocusable] = getFocusableElements(panel);
      (firstFocusable ?? panel).focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape) {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
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
  }, [closeOnEscape, isOpen, onClose]);

  return (
    <>
      {/* Kept mounted so the backdrop can fade instead of blinking in and
                out. `inert` keeps it out of the tab order while closed. */}
      {showOverlay && (
        <button
          type="button"
          aria-label={closeAriaLabel}
          aria-hidden={!isOpen}
          inert={!isOpen}
          onClick={onClose}
          className={`fixed inset-x-0 top-0 h-screen ${zIndexClassName} ${overlayClassName} transition-opacity duration-300 ease-out ${
            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
      )}

      {/* Driven by Framer Motion rather than by CSS classes, on purpose.
                A class-based slide has to survive the cascade: Tailwind v4's
                `translate-x-*` writes the standalone `translate` property, and
                a panel that mounts already open needs a keyframe to animate in,
                which then does not reliably hand back over to a transition on
                the way out. Motion writes the transform inline and owns both
                directions, so entry and exit are symmetric by construction. */}
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: isOpen ? 0 : "100%", opacity: isOpen ? 1 : 0 }}
        transition={panelTransition}
        className={`fixed inset-y-0 right-0 ${zIndexClassName} flex h-screen ${widthClassName} flex-col overflow-hidden border-l border-app-border ${panelBackgroundClassName} shadow-2xl sm:rounded-l-[28px] ${panelClassName}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
        tabIndex={-1}
      >
        {(title || description || leading || badge || actions) && (
          <div className={`${headerDividerClassName} ${headerClassName}`}>
            {/* Mobile: the leading media (avatar/icon) and the action/close
                cluster share the top row; the title, description and badge drop
                to their own full-width row below (`order-last` + `w-full`), so
                the name gets the whole row. From `sm` up it collapses to the
                original inline row — avatar and title on the left, actions and
                close on the right. */}
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3 sm:gap-4">
              {leading}

              <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                {title && (
                  <h2
                    id={titleId}
                    className="text-xl leading-tight font-bold break-words text-app-text"
                  >
                    {title}
                  </h2>
                )}

                {description && (
                  <div
                    id={descriptionId}
                    className="mt-1 text-sm leading-relaxed text-app-text-muted"
                  >
                    {description}
                  </div>
                )}

                {badge && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-app-text-muted">
                    {badge}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {actions}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-app-border p-2 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                  aria-label={closeAriaLabel}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 [scrollbar-gutter:auto] overflow-y-auto">
          <div className={contentClassName}>{children}</div>
        </div>

        {footer && <div className={footerClassName}>{footer}</div>}
      </motion.div>
    </>
  );
}
