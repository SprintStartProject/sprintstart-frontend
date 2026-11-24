import { useCallback, useRef, useState } from "react";
import { useToast } from "../../../../../context/useToast";
import { onboardingGraphService } from "../../../../../services/onboardingGraphService";
import { blankStepRequest, listPlacement, type StepPlacement } from "./journeyRules";
import type { OnboardingPhaseEndpoint, PhaseItem } from "./journeyKit";

/**
 * Adding a blank step the PM names next -- dropped on the graph, or put in between two list rows.
 *
 * One step per gesture, across all five ways of asking for one. A double click created two, wired
 * into the member's live path with the same prerequisites -- both computed from the same
 * pre-refresh snapshot -- and only the second opened for naming, leaving the first as an unnamed
 * orphan to hunt down. The ref is the guard, the state is what the buttons read.
 */
export function useStepCreation(onPathChanged: () => Promise<void>) {
  const toast = useToast();
  const adding = useRef(false);
  const [isAdding, setIsAdding] = useState(false);
  const [freshStepId, setFreshStepId] = useState<string | null>(null);

  const create = useCallback(
    async (target: OnboardingPhaseEndpoint, placement: StepPlacement) => {
      if (adding.current) return null;
      adding.current = true;
      setIsAdding(true);
      try {
        const created = await onboardingGraphService.createConnectedStep(
          target.id,
          blankStepRequest(target, placement),
        );
        await onPathChanged();
        setFreshStepId(created.id);
        return created;
      } finally {
        adding.current = false;
        setIsAdding(false);
      }
    },
    [onPathChanged],
  );

  const addInList = async (target: OnboardingPhaseEndpoint, after: PhaseItem | null) => {
    try {
      await create(target, listPlacement(target, after));
    } catch (error) {
      toast.error("Couldn't add the step", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return { isAdding, freshStepId, setFreshStepId, create, addInList };
}

export type StepCreation = ReturnType<typeof useStepCreation>;
