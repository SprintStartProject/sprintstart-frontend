import type { RequirementCatalog, RequirementType } from "./pathEditorTypes.ts";
import type { BlueprintPhase } from "./types.ts";

/** What can still be added to a phase: the catalog's entries of this type that it does not require yet. */
export function availableRequirementChoices(
  phase: BlueprintPhase | undefined,
  type: RequirementType,
  catalog: RequirementCatalog | null,
) {
  const taken = new Set(
    (phase?.requirements ?? [])
      .filter((requirement) => requirement.type === type)
      .map((requirement) => requirement.referenceId),
  );
  const choices = type === "SKILL" ? (catalog?.skills ?? []) : (catalog?.projectRoles ?? []);
  return choices.filter((choice) => !taken.has(choice.id));
}
