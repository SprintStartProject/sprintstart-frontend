import type { BlueprintPath, BlueprintPhase } from "./types.ts";

/** The path with one phase replaced by what `change` makes of it. */
export function mapPhase(
  path: BlueprintPath,
  phaseId: string,
  change: (phase: BlueprintPhase) => BlueprintPhase,
): BlueprintPath {
  return {
    ...path,
    blueprintPhases: path.blueprintPhases.map((phase) =>
      phase.id === phaseId ? change(phase) : phase,
    ),
  };
}
