import { Trash2 } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import type { DetailOnboardingStep } from "./stepPanelTypes";

type StepDeleteFooterProps = {
  step: DetailOnboardingStep;
  stepToDelete: DetailOnboardingStep | null;
  stepActionId: string | null;
  onRequestDelete: (step: DetailOnboardingStep) => void;
  onCancel: () => void;
  onConfirm: (step: DetailOnboardingStep) => void;
};

/** The panel's footer: a delete button that turns into a confirmation once it is pressed. */
export function StepDeleteFooter({
  step,
  stepToDelete,
  stepActionId,
  onRequestDelete,
  onCancel,
  onConfirm,
}: StepDeleteFooterProps) {
  const busy = stepActionId === step.id;

  if (stepToDelete?.id !== step.id) {
    return (
      <Button
        variant="dangerSoft"
        fullWidth
        onClick={() => onRequestDelete(step)}
        disabled={stepActionId !== null}
        icon={<Trash2 className="h-4 w-4" />}
      >
        Delete step
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3">
      <p className="text-sm text-app-danger-text">
        Delete <span className="font-medium">{step.title}</span>? This cannot be undone.
      </p>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>

        <Button variant="danger" size="sm" onClick={() => onConfirm(step)} loading={busy}>
          {busy ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}
