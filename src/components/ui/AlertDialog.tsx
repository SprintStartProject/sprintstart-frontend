import type { ReactNode } from "react";
import { Button } from "./Button";
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
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>

          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
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
