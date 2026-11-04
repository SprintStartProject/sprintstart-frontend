import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { skipLabelFor, type WizardPhase } from "./wizardRules";

type AddFormFooterState = {
  isOpen: boolean;
  step: string;
  canAdd: boolean;
  close: () => void;
};

type WizardFooterProps = {
  phase: WizardPhase;
  addForm: AddFormFooterState;
  isSubmitting: boolean;
  isNameValid: boolean;
  sourceCount: number;
  onDone: () => void;
  onCancel: () => void;
  onBack: () => void;
  onContinue: () => void;
  onCreate: () => void;
  onCommitAddSource: () => void;
};

function AddSourceFooter({
  addForm,
  onCommit,
}: {
  addForm: AddFormFooterState;
  onCommit: () => void;
}) {
  if (addForm.step === "type") {
    return (
      <Button
        variant="secondary"
        onClick={addForm.close}
        icon={<ArrowLeft className="h-4 w-4" />}
        className="sm:mr-auto"
      >
        Back to source list
      </Button>
    );
  }

  // The detail screen's "back to types" lives in its own navigation header
  // (master-detail), so the footer carries only the primary action.
  return (
    <Button
      variant="primary"
      onClick={onCommit}
      disabled={!addForm.canAdd}
      icon={<Plus className="h-4 w-4" />}
    >
      Add to list
    </Button>
  );
}

function StepFooter(props: WizardFooterProps) {
  const { phase, isSubmitting } = props;
  const isDetails = phase === "details";

  return (
    <>
      <Button
        variant="secondary"
        onClick={isDetails ? props.onCancel : props.onBack}
        disabled={isSubmitting}
        icon={isDetails ? undefined : <ArrowLeft className="h-4 w-4" />}
        className="sm:mr-auto"
      >
        {isDetails ? "Cancel" : "Back"}
      </Button>

      {phase === "sources" && (
        <Button variant="secondary" onClick={props.onCreate} loading={isSubmitting}>
          {skipLabelFor(props.sourceCount)}
        </Button>
      )}

      {phase === "review" ? (
        <Button
          variant="primary"
          onClick={props.onCreate}
          loading={isSubmitting}
          disabled={!props.isNameValid}
          icon={<Check className="h-4 w-4" />}
        >
          Create project
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={props.onContinue}
          disabled={isSubmitting}
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Continue
        </Button>
      )}
    </>
  );
}

/** The modal's footer: Done while provisioning, the add-source actions over that sub-flow, else the step buttons. */
export function WizardFooter(props: WizardFooterProps) {
  if (props.phase === "provisioning") {
    return (
      <Button
        variant="primary"
        onClick={props.onDone}
        loading={props.isSubmitting}
        disabled={props.isSubmitting}
      >
        Done
      </Button>
    );
  }

  if (props.addForm.isOpen) {
    return <AddSourceFooter addForm={props.addForm} onCommit={props.onCommitAddSource} />;
  }

  return <StepFooter {...props} />;
}
