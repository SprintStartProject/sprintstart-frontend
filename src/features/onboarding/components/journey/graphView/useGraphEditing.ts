import { useToast } from "../../../../../context/useToast";
import type { PhaseItem } from "../../../journey";
import type { GraphPoint } from "../../../graph/layout";
import type { OnboardingPhaseEndpoint } from "../../../../../services/onboardingTypes";
import { EDGE_REFUSAL_MESSAGE, edgeRefusal } from "./graphKit";
import { freeSpot, pinnedPositions, ruleNodes, type PhaseNode } from "./graphRules";
import type { GraphEditing, SaveLayout } from "./graphTypes";

type EditingInput = {
  editing: GraphEditing | undefined;
  saveLayout: SaveLayout | undefined;
  openPhase: OnboardingPhaseEndpoint | null;
  items: PhaseItem[];
  phaseNodes: PhaseNode[];
  positions: Map<string, GraphPoint>;
  isAutomatic: boolean;
  /** Where the open phase's camera is looking, for the "Add step" button. */
  viewCenter: () => GraphPoint | undefined;
};

type EditingTools = {
  connect: (blockerId: string, nodeId: string) => void;
  disconnect: (blockerId: string, nodeId: string) => void;
  addStepAt: (point: GraphPoint) => void;
  addStepInView: () => void;
};

/** The PM's tools: draw and remove connections, add a step. Each failure is said, not swallowed. */
export function useGraphEditing(input: EditingInput): EditingTools {
  const { editing, saveLayout, openPhase, items, phaseNodes, positions, isAutomatic } = input;
  const toast = useToast();

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(failure, { description: error instanceof Error ? error.message : undefined });
    }
  };

  const connect = (blockerId: string, nodeId: string) => {
    if (!editing) return;
    const nodes = openPhase ? items : phaseNodes;
    // The same rules, and the same sentences, as the blueprint canvas: a loop, a duplicate and a
    // node pointed at itself are each said, not silently dropped.
    const refusal = edgeRefusal(ruleNodes(nodes), nodeId, blockerId);
    if (refusal) {
      toast.warning("Those can't be connected", { description: EDGE_REFUSAL_MESSAGE[refusal] });
      return;
    }
    void run(
      () =>
        openPhase
          ? editing.connectItems(openPhase.id, blockerId, nodeId)
          : editing.connectPhases(blockerId, nodeId),
      "Couldn't connect them",
    );
  };

  const disconnect = (blockerId: string, nodeId: string) => {
    if (!editing) return;
    void run(
      () =>
        openPhase
          ? editing.disconnectItems(openPhase.id, blockerId, nodeId)
          : editing.disconnectPhases(blockerId, nodeId),
      "Couldn't remove the connection",
    );
  };

  const addStepAt = (point: GraphPoint) => {
    if (!editing || !openPhase) return;
    const phaseId = openPhase.id;
    const spot = freeSpot(point, [...positions.values()]);
    void run(async () => {
      // A graph still on its automatic layout ignores one pinned node, so pin what is on screen
      // first -- otherwise the new step would not appear where it was put.
      if (isAutomatic && saveLayout && items.length > 0) {
        await saveLayout.phase(phaseId, pinnedPositions(positions));
      }
      await editing.addStep(phaseId, spot);
    }, "Couldn't add the step");
  };

  return {
    connect,
    disconnect,
    addStepAt,
    addStepInView: () => addStepAt(input.viewCenter() ?? { x: 0, y: 0 }),
  };
}
