import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import type { BlueprintQuestion, BlueprintStep } from "../../../services/blueprintTypes.ts";
import type { NodeDeletion } from "./useNodeDeletion.ts";
import type { UnsavedGuard } from "./useUnsavedGuard.ts";

type DeleteNodeDialogProps = {
  step: BlueprintStep | null;
  question: BlueprintQuestion | null;
  deletion: NodeDeletion;
};

function deleteTitle({ step, question }: Pick<DeleteNodeDialogProps, "step" | "question">) {
  if (step) return `Delete step "${step.title}"?`;
  if (question) return `Delete knowledge check "${question.title}"?`;
  return "Delete this node?";
}

export function DeleteNodeDialog({ step, question, deletion }: DeleteNodeDialogProps) {
  return (
    <AlertDialog
      isOpen={deletion.isConfirmOpen}
      title={deleteTitle({ step, question })}
      description={
        <>
          <p>
            {step
              ? "Its tasks, resources and every prerequisite pointing at it go with it."
              : "Its answer options and every prerequisite pointing at it go with it."}{" "}
            Hires who already have a path built from this blueprint keep theirs.
          </p>
          <p className="mt-2">This cannot be undone from here.</p>
        </>
      }
      confirmLabel={step ? "Delete step" : "Delete knowledge check"}
      variant="danger"
      isLoading={deletion.isDeleting}
      loadingLabel="Deleting…"
      errorMessage={deletion.error ?? undefined}
      onClose={deletion.cancel}
      onConfirm={() => void deletion.confirm()}
    />
  );
}

export function DiscardChangesDialog({ isStep, guard }: { isStep: boolean; guard: UnsavedGuard }) {
  return (
    <AlertDialog
      isOpen={guard.isOpen}
      title="Discard your changes?"
      description={
        <p>
          This {isStep ? "step" : "knowledge check"} has edits that have not been saved.
          {guard.hasNext ? " Discarding them moves on to the next one." : ""}
        </p>
      }
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      variant="danger"
      onClose={guard.keepEditing}
      onConfirm={guard.discard}
    />
  );
}
