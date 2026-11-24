import { useCallback, useMemo, useRef } from "react";
import { onboardingGraphService } from "../../../../../services/onboardingGraphService";
import { sameBlockers, withBlocker, withoutBlocker } from "./journeyRules";
import { phaseItems, type GraphEditing, type OnboardingPhaseEndpoint } from "./journeyKit";
import type { StepCreation } from "./useStepCreation";

/**
 * Replaces a node's blocker list with a changed one and reads the path again.
 *
 * Blocker lists sent but not yet back in `phases` are remembered. The endpoints replace the whole
 * list, so a second edit to the same node computed from the stale snapshot would drop the first.
 */
function useBlockerRewire(onPathChanged: () => Promise<void>) {
  const pending = useRef(new Map<string, string[]>());

  return useCallback(
    async (
      id: string,
      current: string[] | undefined,
      change: (blockers: string[]) => string[],
      save: (id: string, blockers: string[]) => Promise<unknown>,
    ) => {
      const before = pending.current.get(id) ?? current ?? [];
      const next = change(before);
      if (sameBlockers(next, before)) return;
      pending.current.set(id, next);
      try {
        await save(id, next);
        await onPathChanged();
      } finally {
        // Only this edit's own entry: a later edit to the same node has put its list there by now.
        if (pending.current.get(id) === next) pending.current.delete(id);
      }
    },
    [onPathChanged],
  );
}

type Args = {
  phases: OnboardingPhaseEndpoint[];
  userId: string;
  onPathChanged: () => Promise<void>;
  creation: StepCreation;
  /** Selects the step just dropped on the graph, so its details open. */
  onStepDropped: (stepId: string) => void;
};

type Node = { id: string; graphX: number; graphY: number };

/**
 * What the graph may change on the member's copy: draw and remove connections between steps and
 * between phases, drop a new step, and save where nodes were put.
 */
export function useGraphEditing({ phases, userId, onPathChanged, creation, onStepDropped }: Args) {
  const rewire = useBlockerRewire(onPathChanged);
  const { create } = creation;

  const editing = useMemo<GraphEditing>(() => {
    const itemBlockers = (nodeId: string, change: (blockers: string[]) => string[]) => {
      const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
      if (!node) return Promise.resolve();
      return rewire(nodeId, node.blockerIds, change, (id, list) =>
        onboardingGraphService.replaceNodeBlockers(id, list),
      );
    };
    const phaseBlockers = (phaseId: string, change: (blockers: string[]) => string[]) => {
      const target = phases.find((candidate) => candidate.id === phaseId);
      if (!target) return Promise.resolve();
      return rewire(phaseId, target.blockerIds, change, (id, list) =>
        onboardingGraphService.replacePhaseBlockers(id, list),
      );
    };

    return {
      connectItems: (_phaseId, blockerId, nodeId) =>
        itemBlockers(nodeId, (blockers) => withBlocker(blockers, blockerId)),
      disconnectItems: (_phaseId, blockerId, nodeId) =>
        itemBlockers(nodeId, (blockers) => withoutBlocker(blockers, blockerId)),
      connectPhases: (blockerId, phaseId) =>
        phaseBlockers(phaseId, (blockers) => withBlocker(blockers, blockerId)),
      disconnectPhases: (blockerId, phaseId) =>
        phaseBlockers(phaseId, (blockers) => withoutBlocker(blockers, blockerId)),
      addStep: async (phaseId, point) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        // Connected to nothing: the PM draws its connections next.
        const created = await create(target, {
          position: target.steps.length,
          waitsOn: [],
          unlocks: [],
          graphX: point.x,
          graphY: point.y,
        });
        if (created) onStepDropped(created.id);
      },
    };
  }, [create, onStepDropped, phases, rewire]);

  const saveLayout = useMemo(
    () => ({
      phase: async (phaseId: string, nodes: Node[]) => {
        await onboardingGraphService.arrangePhase(phaseId, nodes);
        await onPathChanged();
      },
      path: async (nodes: Node[]) => {
        await onboardingGraphService.arrangeUserPath(userId, nodes);
        await onPathChanged();
      },
    }),
    [onPathChanged, userId],
  );

  return { editing, saveLayout };
}
