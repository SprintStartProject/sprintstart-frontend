import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../context/useToast";
import { ApiError } from "../../../services/apiClient";
import { onboardingService } from "../../../services/onboardingService";
import { queryKeys } from "../../../services/queryKeys";
import { initialPhaseId } from "../initialPhase";
import { sortedPhases } from "../journey";
import type { OnboardingPathEndpoint } from "../../../services/onboardingTypes";

export type LoadingState = "loading" | "empty" | "success" | "error";

type Params = {
  /** The item a visit was sent for: a step in the address or a question in router state. */
  focusItemId: string | undefined;
  /** A phase to land on, set by anything that sends the member here pointing at one. */
  openPhaseId: string | undefined;
  /** Subscribes to changes the buddy made to the path; returns the unsubscribe. */
  subscribeToChanges: (handler: () => void) => () => void;
};

/**
 * The member's path, and the phase selected in it.
 *
 * Read once on mount; a 404 is a normal state (a path is only built when the user asks for one),
 * anything else is an error the page shows. `refreshPath` re-reads it keeping the selection, and is
 * what the buddy's announcements and every step or answer call.
 */
export function usePathLoading({ focusItemId, openPhaseId, subscribeToChanges }: Params) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");

  const applyPath = useCallback(
    (next: OnboardingPathEndpoint, { keepSelection }: { keepSelection: boolean }) => {
      setPath(next);
      // The dashboard's "next step" card reads the same path through the query cache.
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.myStatuses() });
      setSelectedPhaseId((current) => {
        const ordered = sortedPhases(next);
        if (keepSelection && ordered.some((phase) => phase.id === current)) return current;
        return initialPhaseId(next, ordered, focusItemId, openPhaseId);
      });
      setLoadingState("success");
    },
    [focusItemId, openPhaseId, queryClient],
  );

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void (async () => {
      try {
        // The step a link points at is started by the page's arrival effect, which sees every link
        // rather than only the one this visit started with.
        applyPath(await onboardingService.fetchPath(), { keepSelection: false });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setLoadingState("empty");
          return;
        }
        setLoadingState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      }
    })();
  }, [applyPath]);

  const refreshPath = useCallback(async () => {
    try {
      applyPath(await onboardingService.fetchPath(), { keepSelection: true });
    } catch (error) {
      console.error("Failed to refresh onboarding path:", error);
      // Said out loud: after finishing a step, a silent failure leaves progress looking unchanged.
      toast.error("Your path could not be refreshed", {
        description: "What you did is saved. Reload the page to see it.",
      });
    }
  }, [applyPath, toast]);

  // Told by the buddy rather than polled: it lives in a dock over this page, and confirming "mark
  // this step as done" in the conversation must not leave the list behind it showing the step open.
  useEffect(() => subscribeToChanges(() => void refreshPath()), [subscribeToChanges, refreshPath]);

  return {
    path,
    setPath,
    loadingState,
    errorMessage,
    selectedPhaseId,
    setSelectedPhaseId,
    applyPath,
    refreshPath,
  };
}
