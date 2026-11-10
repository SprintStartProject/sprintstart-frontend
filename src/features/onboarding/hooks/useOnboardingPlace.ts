import { useEffect } from "react";
import { phaseItems } from "../journey";
import { setOnboardingPlace, type OnboardingPlace } from "../onboardingPlace";
import type { OnboardingPhaseEndpoint } from "../types";
import type { ViewMode } from "./useJourneyView";

type Params = {
  viewMode: ViewMode;
  phases: OnboardingPhaseEndpoint[];
  /** The phase the list has selected. */
  selectedPhase: OnboardingPhaseEndpoint | null;
  /** The phase the graph is zoomed into, if any. */
  openGraphPhaseId: string | null;
  expandedItemId: string | null;
  graphItemId: string | null;
};

/** The phase the hire is looking at: the one the graph is zoomed into, or the list's selection. */
function shownPhaseOf(params: Params): OnboardingPhaseEndpoint | null {
  if (params.viewMode !== "graph") return params.selectedPhase;
  return params.phases.find((phase) => phase.id === params.openGraphPhaseId) ?? null;
}

/**
 * Where the hire is: the step they have open, else the phase they are looking at -- which for an
 * open question is the question's own phase, because a question is not a place a note is kept
 * *about*.
 */
export function placeOf(params: Params): OnboardingPlace | null {
  const { viewMode, phases, expandedItemId, graphItemId } = params;
  const openItemId = viewMode === "graph" ? graphItemId : expandedItemId;
  const openItem = openItemId
    ? phases.flatMap(phaseItems).find((item) => item.id === openItemId)
    : undefined;
  if (openItem?.kind === "step") return { kind: "step", id: openItem.id, title: openItem.title };

  const questionPhaseId = openItem?.kind === "question" ? openItem.question.phaseId : undefined;
  const phase =
    phases.find((candidate) => candidate.id === questionPhaseId) ?? shownPhaseOf(params);
  return phase ? { kind: "phase", id: phase.id, title: phase.title } : null;
}

/**
 * Tells the rest of the app where the hire is on this page, for whatever they keep on their board
 * from here. See `onboardingPlace.ts`. Cleared when the page goes away.
 */
export function useOnboardingPlace(params: Params) {
  const { viewMode, phases, selectedPhase, openGraphPhaseId, expandedItemId, graphItemId } = params;

  useEffect(() => {
    setOnboardingPlace(
      placeOf({ viewMode, phases, selectedPhase, openGraphPhaseId, expandedItemId, graphItemId }),
    );
  }, [expandedItemId, graphItemId, openGraphPhaseId, phases, selectedPhase, viewMode]);

  useEffect(() => () => setOnboardingPlace(null), []);
}
