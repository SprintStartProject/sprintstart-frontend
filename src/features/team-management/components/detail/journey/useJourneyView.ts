import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { useSwipeableTabs } from "../../../../../hooks/useHorizontalWheelNavigation";
import {
  memberJourneyViewKey,
  readJourneyView,
  writeJourneyView,
  type OnboardingPhaseEndpoint,
} from "./journeyKit";

export type ViewMode = "list" | "graph";
export const VIEW_ORDER: readonly ViewMode[] = ["graph", "list"];

/** What the rest of the profile can ask of the path section. */
export type MemberJourneyHandle = {
  /**
   * Scrolls the path into view, showing `phaseId` in whichever view is open: selected in the
   * list, opened in the graph. Without a phase it only scrolls.
   */
  showPhase: (phaseId?: string) => void;
};

type HandleSetters = {
  setSelectedPhaseId: (id: string | null) => void;
  setSelectedItemId: (id: string | null) => void;
  setGraphPhaseId: (id: string | null) => void;
};

/** What the rest of the profile may ask of the section: to show a phase, and scroll to the path. */
function useJourneyHandle(
  ref: Ref<MemberJourneyHandle> | undefined,
  viewMode: ViewMode,
  { setSelectedPhaseId, setSelectedItemId, setGraphPhaseId }: HandleSetters,
) {
  useImperativeHandle(
    ref,
    () => ({
      showPhase: (phaseId) => {
        if (phaseId) {
          setSelectedPhaseId(phaseId);
          setSelectedItemId(null);
          if (viewMode === "graph") setGraphPhaseId(phaseId);
        }
        document
          .getElementById("member-journey-title")
          ?.closest("section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    }),
    [setGraphPhaseId, setSelectedItemId, setSelectedPhaseId, viewMode],
  );
}

/** Remembers the open view for next time, once there is a path to remember it for. */
function useRememberedView({
  viewerId,
  userId,
  phaseCount,
  viewMode,
  openGraphPhaseId,
}: {
  viewerId: string;
  userId: string;
  phaseCount: number;
  viewMode: ViewMode;
  openGraphPhaseId: string | null;
}) {
  useEffect(() => {
    if (phaseCount === 0 || !viewerId) return;
    writeJourneyView(memberJourneyViewKey(viewerId, userId), {
      mode: viewMode,
      graphPhaseId: openGraphPhaseId,
    });
  }, [openGraphPhaseId, phaseCount, userId, viewerId, viewMode]);
}

/**
 * Which reading of the path is open (the list or the graph), which phase the graph has open, and
 * which phase and item are selected. The view is remembered per manager as well as per member:
 * browser storage is per browser, so a key without the viewer hands one manager's view to whoever
 * signs in next.
 *
 * Returned as a pair, not an object: the swipe ref has to reach the section's root element
 * without travelling inside something the lint rule reads as used during render.
 */
export function useJourneyView(
  viewerId: string,
  userId: string,
  phases: OnboardingPhaseEndpoint[],
  ref: Ref<MemberJourneyHandle> | undefined,
) {
  const key = memberJourneyViewKey(viewerId, userId);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readJourneyView(key).mode);
  const [graphPhaseId, setGraphPhaseId] = useState<string | null>(
    () => readJourneyView(key).graphPhaseId,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // A remembered phase of another member's path is simply not there: that opens the map.
  const openGraphPhaseId = phases.some((candidate) => candidate.id === graphPhaseId)
    ? graphPhaseId
    : null;
  useRememberedView({
    viewerId,
    userId,
    phaseCount: phases.length,
    viewMode,
    openGraphPhaseId,
  });

  const swipeRef = useSwipeableTabs<ViewMode, HTMLElement>({
    order: VIEW_ORDER,
    value: viewMode,
    onChange: setViewMode,
    enabled: phases.length > 0,
  });

  useJourneyHandle(ref, viewMode, { setSelectedPhaseId, setSelectedItemId, setGraphPhaseId });

  const view = {
    viewMode,
    selectedPhaseId,
    setSelectedPhaseId,
    openGraphPhaseId,
    setGraphPhaseId,
    selectedItemId,
    setSelectedItemId,
    changeMode: (mode: ViewMode) => {
      setViewMode(mode);
      setSelectedItemId(null);
    },
  };

  return [swipeRef, view] as const;
}

export type JourneyView = ReturnType<typeof useJourneyView>[1];
