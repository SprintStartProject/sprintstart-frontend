import { useState } from "react";
import { useToast } from "../../../context/useToast.ts";
import type { BlueprintQuestion, BlueprintStep } from "../../../services/blueprintTypes.ts";

type Args = {
  step: BlueprintStep | null;
  question: BlueprintQuestion | null;
  onDeleteStep: (step: BlueprintStep) => Promise<void>;
  onDeleteQuestion: (question: BlueprintQuestion) => Promise<void>;
  /** Called once it is gone, to close the panel that showed it. */
  onDeleted: () => void;
};

/** Deleting whichever of the two the details panel is showing, once it has been confirmed. */
export function useNodeDeletion({
  step,
  question,
  onDeleteStep,
  onDeleteQuestion,
  onDeleted,
}: Args) {
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The panel closes after the request, not before: closing first said "gone" before anybody
   * knew, and left a failure with nowhere to appear.
   */
  async function confirm() {
    const target = step ?? question;
    if (!target) return;
    const isStep = step !== null;

    setIsDeleting(true);
    setError(null);
    try {
      if (step) await onDeleteStep(step);
      else if (question) await onDeleteQuestion(question);
      setIsConfirmOpen(false);
      onDeleted();
      toast.success(`${isStep ? "Step" : "Knowledge check"} "${target.title}" deleted`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `The ${isStep ? "step" : "knowledge check"} could not be deleted.`,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    isConfirmOpen,
    isDeleting,
    error,
    ask: () => {
      setError(null);
      setIsConfirmOpen(true);
    },
    cancel: () => setIsConfirmOpen(false),
    confirm,
  };
}

export type NodeDeletion = ReturnType<typeof useNodeDeletion>;
