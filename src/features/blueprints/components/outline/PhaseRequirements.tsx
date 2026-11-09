import { Plus, X } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import type { BlueprintPhase, BlueprintPhaseRequirement } from "../../types.ts";
import type { OutlineActions } from "./outlineActions.ts";

interface RequirementChipProps {
  phase: BlueprintPhase;
  requirement: BlueprintPhaseRequirement;
  actions: OutlineActions;
}

function RequirementChip({ phase, requirement, actions }: RequirementChipProps) {
  return (
    <li className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface py-1 pr-1 pl-2 text-sm text-app-text">
      <span className="text-xs text-app-text-subtle">
        {requirement.type === "SKILL" ? "Skill:" : "Role:"}
      </span>
      <span>{requirement.displayName}</span>
      <Button
        iconOnly
        size="sm"
        variant="dangerGhost"
        aria-label={`Remove requirement ${requirement.displayName}`}
        loading={actions.removingRequirementId === requirement.id}
        onClick={() =>
          actions.whenEditable(() => actions.removeRequirement(phase.id, requirement.id))
        }
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

/** The skills and project roles a phase waits for, with a way to add and remove them. */
export function PhaseRequirements({
  phase,
  actions,
}: {
  phase: BlueprintPhase;
  actions: OutlineActions;
}) {
  const requirements = phase.requirements ?? [];
  return (
    <div className="mt-5 rounded-xl border border-app-border bg-app-surface-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-app-text">Phase requirements</h3>
          <p className="mt-1 text-sm text-app-text-muted">
            Skills or project roles required before this phase unlocks.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => actions.whenEditable(() => actions.openRequirementPicker(phase.id))}
        >
          Add requirement
        </Button>
      </div>
      {requirements.length === 0 ? (
        <p className="mt-3 text-sm text-app-text-subtle">No requirements yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {requirements.map((requirement) => (
            <RequirementChip
              key={requirement.id}
              phase={phase}
              requirement={requirement}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
