import { useCallback, useEffect, useRef, useState } from "react";
import { readJourneyView, writeJourneyView } from "../journeyViewMemory";
import type { OnboardingPhaseEndpoint } from "../types";
import type { LoadingState } from "./usePathLoading";

export type ViewMode = "list" | "graph";

type Params = {
  /** Whose remembered view this is; `null` only before the profile is there. */
  viewKey: string | null;
  /** This visit arrived for a step, a question or the phase chooser, all of which unfold in the list. */
  arrivedForList: boolean;
  /** A phase arrived at by name: the graph opens *inside* it, the same way the list selects it. */
  openPhaseId: string | undefined;
  phases: OnboardingPhaseEndpoint[];
  loadingState: LoadingState;
};

/**
 * Which of the two views the page is in, and the phase the graph is zoomed into -- remembered per
 * account, so a hire comes back to where they left the page.
 *
 * Arriving for a particular step, question or phase choice opens the list whichever view was used
 * last, since that is where each of them unfolds. That is marked as forced, so it is not written back
 * as a preference the member chose: without the distinction, one click on the dashboard's next-step
 * card wrote "list" over a remembered graph, for good. Choosing a view clears it, and only then is
 * the choice remembered.
 */
export function useJourneyView(params: Params) {
  const { viewKey, arrivedForList, openPhaseId, phases, loadingState } = params;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (arrivedForList) return "list";
    return viewKey ? readJourneyView(viewKey).mode : "graph";
  });
  const [graphPhaseId, setGraphPhaseId] = useState<string | null>(
    () => openPhaseId ?? (viewKey ? readJourneyView(viewKey).graphPhaseId : null),
  );
  const forcedList = useRef(arrivedForList);

  const chooseViewMode = useCallback((mode: ViewMode) => {
    forcedList.current = false;
    setViewMode(mode);
  }, []);
  const showListByArrival = useCallback(() => {
    forcedList.current = true;
    setViewMode("list");
  }, []);

  // A remembered phase that is not in this path (a rebuilt path, another project) opens the map.
  const openGraphPhaseId = phases.some((phase) => phase.id === graphPhaseId) ? graphPhaseId : null;
  useEffect(() => {
    if (loadingState !== "success" || forcedList.current || !viewKey) return;
    writeJourneyView(viewKey, { mode: viewMode, graphPhaseId: openGraphPhaseId });
  }, [loadingState, openGraphPhaseId, viewKey, viewMode]);

  return {
    viewMode,
    chooseViewMode,
    showListByArrival,
    graphPhaseId,
    setGraphPhaseId,
    openGraphPhaseId,
  };
}
