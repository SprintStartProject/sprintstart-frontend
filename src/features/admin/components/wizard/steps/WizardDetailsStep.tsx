import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { Field } from "../../../../../components/ui/Field";
import { Input } from "../../../../../components/ui/Input";
import { Select } from "../../../../../components/ui/Select";
import { Textarea } from "../../../../../components/ui/Textarea";
import type { ProjectManager } from "../../../../../services/projectService";

type WizardDetailsStepProps = {
  name: string;
  description: string;
  managerId: string;
  managerCandidates: ProjectManager[];
  isLoadingCandidates: boolean;
  candidatesError: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  /** Advances to the next step, so Enter in a field submits the wizard's step. */
  onSubmit: () => void;
};

function managerLabel(candidate: ProjectManager): string {
  const fullName = `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim();
  return fullName || candidate.username;
}

/**
 * Step 1 of the create-project wizard: the project's own metadata and who runs
 * it. The manager lives here rather than on the members step — it is part of the
 * project's identity, and picking it early lets the members step and the review
 * show the manager as an automatic member.
 */
export function WizardDetailsStep({
  name,
  description,
  managerId,
  managerCandidates,
  isLoadingCandidates,
  candidatesError,
  onNameChange,
  onDescriptionChange,
  onManagerChange,
  onSubmit,
}: WizardDetailsStepProps) {
  const nameInputId = useId();
  const descriptionInputId = useId();
  const managerSelectId = useId();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Name" controlId={nameInputId}>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Customer Portal"
        />
      </Field>

      <Field label="Description" controlId={descriptionInputId}>
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          minRows={4}
          maxRows={12}
          placeholder="What is this project about?"
        />
      </Field>

      <Field label="Project manager" controlId={managerSelectId}>
        <Select
          value={managerId}
          onChange={(event) => onManagerChange(event.target.value)}
          disabled={isLoadingCandidates || managerCandidates.length === 0}
        >
          <option value="">
            {isLoadingCandidates
              ? "Loading candidates..."
              : managerCandidates.length === 0
                ? "No candidates available"
                : "No manager"}
          </option>
          {managerCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {managerLabel(candidate)}
            </option>
          ))}
        </Select>

        {candidatesError && (
          <p className="flex items-start gap-2 text-sm text-app-danger-text">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{candidatesError}</span>
          </p>
        )}

        <p className="text-xs text-app-text-muted">
          The manager becomes a member automatically, so they do not have to be ticked on the next
          step.
        </p>
      </Field>
    </form>
  );
}
