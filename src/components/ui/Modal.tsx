import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
    isOpen: boolean;
    title: string;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    size?: ModalSize;
    zIndexClassName?: string;
    bodyClassName?: string;
    role?: "dialog" | "alertdialog";
    closeLabel?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    isDismissDisabled?: boolean;
    titleId?: string;
    descriptionId?: string;
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
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("aria-hidden"));
}

export function Modal({
    isOpen,
    title,
    description,
    children,
    footer,
    size = "md",
    zIndexClassName = "z-50",
    bodyClassName = "px-7 py-6",
    role = "dialog",
    closeLabel = "Close dialog",
    closeOnBackdrop = true,
    closeOnEscape = true,
    isDismissDisabled = false,
    titleId = "modal-title",
    descriptionId = "modal-description",
    onClose,
}: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedElement.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        window.requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            if (!dialog) return;

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

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-app-overlay p-4 backdrop-blur-md`}
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

            <div
                ref={dialogRef}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`relative z-10 w-full ${sizeClassNames[size]} overflow-hidden rounded-[28px] border border-app-border bg-app-bg shadow-2xl`}
            >
                <div className="pointer-events-none absolute -right-16 -top-16 h-[200px] w-[200px] rounded-full bg-app-brand-glow blur-3xl" />

                <div className="relative z-10 flex items-start justify-between gap-4 px-7 pt-7">
                    <div>
                        <h2
                            id={titleId}
                            className="text-[22px] font-bold leading-tight text-app-text"
                        >
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

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDismissDisabled}
                        className="rounded-lg border border-app-border p-2 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={closeLabel}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {children && (
                    <div className={`relative z-10 ${bodyClassName}`}>
                        {children}
                    </div>
                )}

                {footer && (
                    <div
                        className={`relative z-10 flex flex-col-reverse gap-3 px-7 pb-7 sm:flex-row sm:justify-end ${
                            children ? "" : "pt-6"
                        }`}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
