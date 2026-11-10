import { useEffect } from "react";
import { useToast } from "../../../context/useToast";
import { onboardingService } from "../../../services/onboardingService";
import type { OnboardingJourneyValue } from "../generation/OnboardingJourneyContext";
import type { OnboardingPathEndpoint } from "../../../services/onboardingTypes";
import type { LoadingState } from "./usePathLoading";

type Params = {
  generation: OnboardingJourneyValue["generation"];
  clearGeneration: () => void;
  path: OnboardingPathEndpoint | null;
  loadingState: LoadingState;
  applyPath: (next: OnboardingPathEndpoint, options: { keepSelection: boolean }) => void;
};

/**
 * What the page does once a generation has ended: reads the new path when it finished, and says so
 * beside the path the member already had when a rebuild failed.
 */
export function useGenerationFollowUp(params: Params) {
  const { generation, clearGeneration, path, loadingState, applyPath } = params;
  const toast = useToast();

  // A generation that finished -- here or while the user was elsewhere -- means there is a new path.
  // Read fresh rather than taken from the generation: the hire may have started working on it before
  // coming back here, and the stream's copy knows nothing of that.
  useEffect(() => {
    if (generation.status !== "done") return;
    let cancelled = false;
    onboardingService
      .fetchPath()
      .then((next) => {
        if (!cancelled) applyPath(next, { keepSelection: false });
      })
      .catch((error: unknown) => console.error("Failed to load the new onboarding path:", error))
      .finally(() => clearGeneration());
    return () => {
      cancelled = true;
    };
  }, [applyPath, clearGeneration, generation]);

  // A rebuild that failed leaves the path the member already had in place -- so the failure is said
  // once, beside it, instead of taking the page over.
  useEffect(() => {
    if (generation.status !== "error" || loadingState !== "success" || !path) return;
    toast.error("Your path could not be rebuilt", {
      description:
        generation.reason === "not-enough-knowledge"
          ? "The project's knowledge base does not cover any phase yet. Your current path is unchanged."
          : `${generation.message} Your current path is unchanged.`,
    });
    clearGeneration();
  }, [clearGeneration, generation, loadingState, path, toast]);
}
