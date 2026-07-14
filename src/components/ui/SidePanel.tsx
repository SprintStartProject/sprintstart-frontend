import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

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
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("aria-hidden"));
}

export function SidePanel({
    isOpen,
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
            {showOverlay && isOpen && (
                <button
                    type="button"
                    aria-label={closeAriaLabel}
                    onClick={onClose}
                    className={`fixed inset-0 ${zIndexClassName} ${overlayClassName}`}
                />
            )}

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                className={`fixed inset-y-0 right-0 ${zIndexClassName} flex h-screen ${widthClassName} flex-col overflow-hidden border-l border-app-border ${panelBackgroundClassName} shadow-2xl transition-[transform,opacity] duration-300 ease-out sm:rounded-l-[28px] ${
                    isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                } ${panelClassName}`}
                aria-hidden={!isOpen}
                inert={!isOpen}
                tabIndex={-1}
            >
                {(title || description || leading || badge || actions) && (
                    <div className={`${headerDividerClassName} ${headerClassName}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                                {leading}

                                <div className="min-w-0">
                                    {title && (
                                        <h2 id={titleId} className="break-words text-xl font-bold leading-tight text-app-text">
                                            {title}
                                        </h2>
                                    )}

                                    {description && (
                                        <div id={descriptionId} className="mt-1 text-sm leading-relaxed text-app-text-muted">
                                            {description}
                                        </div>
                                    )}

                                    {badge && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-app-text-muted">
                                            {badge}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
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

                <div className="flex-1 overflow-y-auto [scrollbar-gutter:auto]">
                    <div className={contentClassName}>{children}</div>
                </div>

                {footer && (
                    <div className={footerClassName}>
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
}
