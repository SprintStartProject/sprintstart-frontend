import { blueprintService } from "../../services/blueprintService.ts";
import type { BlueprintPhaseMetadata } from "./components/BlueprintGraphEditor.tsx";
import type { PathPageContext } from "./pathPageContext.ts";
import { mapPhase } from "./pathTransforms.ts";
import type { BlueprintPhase } from "./types.ts";

/** Moving a phase on the top-level graph, changing its prerequisites, and renaming it there. */
export function usePhaseGraphEdits(context: PathPageContext) {
  const { scope } = context;

  function updatePhase(phaseId: string, update: Partial<BlueprintPhase>) {
    context.setPath((current) =>
      current ? mapPhase(current, phaseId, (phase) => ({ ...phase, ...update })) : current,
    );
  }

  async function savePosition(phase: BlueprintPhase, graphX: number, graphY: number) {
    const response = await blueprintService.updateGraphNodePosition(scope, phase.id, {
      revision: phase.revision,
      graphX,
      graphY,
    });
    updatePhase(phase.id, response);
  }

  async function addBlocker(phase: BlueprintPhase, blockerId: string) {
    const response = await blueprintService.addGraphNodeBlocker(
      scope,
      phase.id,
      blockerId,
      phase.revision,
    );
    updatePhase(phase.id, response);
  }

  async function removeBlocker(phase: BlueprintPhase, blockerId: string) {
    const response = await blueprintService.removeGraphNodeBlocker(
      scope,
      phase.id,
      blockerId,
      phase.revision,
    );
    updatePhase(phase.id, response);
  }

  async function updateMetadata(phase: BlueprintPhase, metadata: BlueprintPhaseMetadata) {
    await blueprintService.updatePhase(scope, phase.id, {
      revision: phase.revision,
      position: phase.position,
      ...metadata,
    });
    await context.loadPath();
  }

  return { savePosition, addBlocker, removeBlocker, updateMetadata };
}
