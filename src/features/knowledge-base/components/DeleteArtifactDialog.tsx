import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";

interface DeleteArtifactDialogProps {
  isOpen: boolean;
  /** The title of the artifact about to be deleted, if it has one. */
  artifactTitle: string | null | undefined;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks for confirmation before an uploaded artifact is deleted for good. */
export function DeleteArtifactDialog({
  isOpen,
  artifactTitle,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteArtifactDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      role="alertdialog"
      title="Delete artifact?"
      description={`This will permanently remove "${artifactTitle ?? "this artifact"}" and its indexed content. This cannot be undone.`}
      size="sm"
    >
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          data-testid="cancel-delete-btn"
          className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          data-testid="confirm-delete-btn"
          className="flex items-center gap-2 rounded-lg bg-app-danger-text px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
