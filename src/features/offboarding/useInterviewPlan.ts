import { useMutation } from "@tanstack/react-query";

import { offboardingService } from "../../services/offboardingService";
import type { RiskQuery } from "../../services/offboardingTypes";

/**
 * Plans the exit interview of a departure when a manager asks for it.
 *
 * Planning costs model time and a second plan may word its questions differently, so it runs only on
 * request and is never refetched behind the manager's back.
 */
export function useInterviewPlan(projectId: string) {
  const mutation = useMutation({
    mutationFn: (query: RiskQuery) => offboardingService.planInterview(projectId, query),
  });
  return {
    plan: mutation.data ?? null,
    planning: mutation.isPending,
    failed: mutation.isError,
    request: mutation.mutate,
  };
}
