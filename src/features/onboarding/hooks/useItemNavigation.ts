import type { Dispatch, SetStateAction } from "react";
import { continueAfter, type ContinueStep } from "../pageRules";
import type { PhaseItem } from "../journey";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
} from "../../../services/onboardingTypes";
import type { ViewMode } from "./useJourneyView";

/** What a "continue" does on this page, handed in by the hook that owns the state it moves. */
type ContinueActions = {
  openItem: (item: PhaseItem) => void;
  closeItems: () => void;
  openChooser: () => void;
};

function continueAction(step: ContinueStep, actions: ContinueActions) {
  if (step.kind === "item") {
    const { item } = step;
    return { label: step.label, run: () => item && actions.openItem(item) };
  }
  return {
    label: step.label,
    run: step.kind === "choose" ? actions.openChooser : actions.closeItems,
  };
}

type Params = {
  path: OnboardingPathEndpoint | null;
  phases: OnboardingPhaseEndpoint[];
  viewMode: ViewMode;
  expandedItemId: string | null;
  setExpandedItemId: Dispatch<SetStateAction<string | null>>;
  setGraphItemId: (itemId: string | null) => void;
  setGraphPhaseId: (phaseId: string | null) => void;
  setSelectedPhaseId: (phaseId: string) => void;
  setChosenPhaseId: (phaseId: string) => void;
  chooseViewMode: (mode: ViewMode) => void;
  scrollToChooser: () => void;
  scrollWhenOpened: (itemId: string) => void;
  clearLinkHighlight: () => void;
  beginStepIfWaiting: (item: PhaseItem) => Promise<void>;
};

/**
 * Moving around the path: opening an item, choosing a phase, and what "continue" does once an item
 * is behind the member. An item opens where the hire is -- unfolded in the list, or on the graph.
 */
export function useItemNavigation(params: Params) {
  const { phases, viewMode, expandedItemId, setExpandedItemId, setGraphItemId, setGraphPhaseId } =
    params;

  const phaseOf = (item: PhaseItem) =>
    phases.find(
      (phase) => phase.id === (item.kind === "step" ? item.step.phaseId : item.question.phaseId),
    );

  /** Start, continue or answer: the item opens where it is. */
  const openItem = (item: PhaseItem) => {
    const phase = phaseOf(item);
    if (phase) params.setSelectedPhaseId(phase.id);
    if (viewMode === "graph") {
      setGraphPhaseId(phase?.id ?? null);
      setGraphItemId(item.id);
    } else {
      params.scrollWhenOpened(item.id);
      setExpandedItemId(item.id);
    }
    void params.beginStepIfWaiting(item);
  };

  const toggleItem = (item: PhaseItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      return;
    }
    openItem(item);
  };

  const selectPhase = (phaseId: string) => {
    params.setSelectedPhaseId(phaseId);
    setExpandedItemId(null);
    params.clearLinkHighlight();
  };

  const choosePhase = (phaseId: string) => {
    params.setChosenPhaseId(phaseId);
    selectPhase(phaseId);
  };

  /** What "continue" does once an item in a phase is behind the member, and what its button says. */
  const continueFrom = (phaseId: string) =>
    continueAction(continueAfter(params.path, phaseId), {
      openItem,
      closeItems: () => {
        setExpandedItemId(null);
        setGraphItemId(null);
      },
      openChooser: () => {
        setExpandedItemId(null);
        setGraphItemId(null);
        setGraphPhaseId(null);
        // The chooser lives in the list; from inside the graph there is nothing to scroll to.
        params.chooseViewMode("list");
        params.scrollToChooser();
      },
    });

  return { phaseOf, openItem, toggleItem, selectPhase, choosePhase, continueFrom };
}
