import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { availableRequirementChoices } from "../requirementChoices.ts";
import type { RequirementType } from "../pathEditorTypes.ts";
import type { RequirementPicker } from "../useRequirementPicker.ts";
import type { BlueprintPhase } from "../types.ts";

const FORM_ID = "add-phase-requirements";

interface RequirementFormProps {
  picker: RequirementPicker;
  phase: BlueprintPhase | undefined;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function RequirementForm({ picker, phase, onSubmit }: RequirementFormProps) {
  const choices = availableRequirementChoices(phase, picker.type, picker.catalog);
  return (
    <form id={FORM_ID} className="space-y-4" onSubmit={onSubmit}>
      <Field label="Requirement type">
        <Select
          value={picker.type}
          onChange={(event) => picker.changeType(event.target.value as RequirementType)}
        >
          <option value="SKILL">Skill</option>
          <option value="PROJECT_ROLE">Project role</option>
        </Select>
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-app-text">
          {picker.type === "SKILL" ? "Skills" : "Project roles"}
        </legend>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-app-border bg-app-surface p-2">
          {choices.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-app-text hover:bg-app-surface-muted"
            >
              <input
                type="checkbox"
                checked={picker.selectedIds.includes(item.id)}
                onChange={() => picker.toggle(item.id)}
                className="h-4 w-4 accent-[var(--color-app-brand)]"
              />
              {item.name}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}

interface AddRequirementsModalProps {
  picker: RequirementPicker;
  phase: BlueprintPhase | undefined;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Lets the author tick skills or project roles that must be met before a phase unlocks. */
export function AddRequirementsModal({
  picker,
  phase,
  isSaving,
  onSubmit,
}: AddRequirementsModalProps) {
  return (
    <Modal
      isOpen={picker.target !== null}
      title="Add phase requirements"
      description="Select skills or project roles that must be met before this phase unlocks."
      errorMessage={picker.error ?? undefined}
      onClose={picker.close}
      footer={
        <>
          <Button variant="secondary" onClick={picker.close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            loading={isSaving}
            disabled={picker.selectedIds.length === 0 || picker.isLoading}
          >
            Add selected
          </Button>
        </>
      }
    >
      {picker.isLoading ? (
        <div className="flex items-center gap-3 py-8 text-app-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading requirement choices…
        </div>
      ) : (
        <RequirementForm picker={picker} phase={phase} onSubmit={onSubmit} />
      )}
    </Modal>
  );
}
