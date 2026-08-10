import type { ReactNode } from "react";
import { Modal } from "./Modal";

export type AlertDialogVariant = "danger" | "default";

type AlertDialogProps = {
    isOpen: boolean;
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: AlertDialogVariant;
    isLoading?: boolean;
    loadingLabel?: string;
    errorMessage?: string;
    onClose: () => void;
    onConfirm: () => void;
};

/**
 * Confirmation dialog wrapping Modal. Supports danger/default variants,
 * loading state with spinner, and error display.
 * Used for destructive actions across admin, team management and settings.
 */
export function AlertDialog({
    isOpen,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    isLoading = false,
    loadingLabel = "Working...",
    errorMessage,
    onClose,
    onConfirm,
}: AlertDialogProps) {
    const confirmButtonClassName =
        variant === "danger"
            ? "border-app-danger-border bg-app-danger-solid text-white hover:opacity-90"
            : "border-app-brand bg-app-brand text-app-text-inverse hover:border-app-brand-hover hover:bg-app-brand-hover";

    return (
        <Modal
            isOpen={isOpen}
            title={title}
            description={description}
            size="md"
            role="alertdialog"
            titleId="alert-dialog-title"
            descriptionId="alert-dialog-description"
            isDismissDisabled={isLoading}
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cancelLabel}
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${confirmButtonClassName}`}
                    >
                        {isLoading ? loadingLabel : confirmLabel}
                    </button>
                </>
            }
        >
            {errorMessage && (
                <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
                    {errorMessage}
                </div>
            )}
        </Modal>
    );
}
