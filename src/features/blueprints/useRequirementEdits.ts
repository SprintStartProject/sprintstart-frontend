import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useToast } from "../../context/useToast.ts";
import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import { mapPhase } from "./pathTransforms.ts";
import type { RequirementPicker } from "./useRequirementPicker.ts";
import type { BlueprintPath } from "./types.ts";

interface EditContext {
  path: BlueprintPath | null;
  setPath: Dispatch<SetStateAction<BlueprintPath | null>>;
  scope: BlueprintScope;
  setPageError: (message: string | null) => void;
}

/** Saves what the add-requirements overlay has ticked onto its phase. */
export function useAddRequirements(context: EditContext, picker: RequirementPicker) {
  const { path, setPath, scope } = context;
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!path || !picker.target || picker.selectedIds.length === 0) return;
    const phase = path.blueprintPhases.find((item) => item.id === picker.target?.phaseId);
    if (!phase) return;

    setIsSaving(true);
    picker.setError(null);
    try {
      const response = await blueprintService.addPhaseRequirements(
        scope,
        phase.id,
        phase.revision,
        picker.selectedIds.map((referenceId) => ({ referenceId, type: picker.type })),
      );
      setPath((current) =>
        current
          ? mapPhase(current, phase.id, (item) => ({
              ...item,
              revision: response.revision,
              requirements: response.requirements,
            }))
          : current,
      );
      picker.close();
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "The phase requirement could not be added.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, submit };
}

/**
 * Takes one requirement off a phase.
 *
 * One at a time, from the chip itself: the thing being removed is already on screen.
 */
export function useRemoveRequirement(context: EditContext) {
  const { path, setPath, scope } = context;
  const toast = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(phaseId: string, requirementId: string) {
    const phase = path?.blueprintPhases.find((item) => item.id === phaseId);
    if (!phase) return;

    setRemovingId(requirementId);
    context.setPageError(null);
    try {
      const response = await blueprintService.deletePhaseRequirements(
        scope,
        phase.id,
        phase.revision,
        [requirementId],
      );
      setPath((current) =>
        current
          ? mapPhase(current, phase.id, (item) => ({
              ...item,
              revision: response.revision,
              requirements: (item.requirements ?? []).filter(
                (requirement) => requirement.id !== requirementId,
              ),
            }))
          : current,
      );
      toast.success("Requirement removed");
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "The phase requirement could not be removed.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return { removingId, remove };
}
