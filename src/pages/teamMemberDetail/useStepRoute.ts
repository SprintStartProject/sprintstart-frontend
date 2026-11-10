import { useEffect, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import type { OnboardingPathEndpoint } from "../../features/onboarding/types";
import { MEMBER_PHASE_PARAM, MEMBER_STEP_PARAM } from "../../features/pm-area/pmWorkspacePaths";
import type { MemberJourneyHandle } from "../../features/team-management/components/detail/MemberJourneySection";

/**
 * The open step lives in the URL (see `MEMBER_STEP_PARAM`): opening pushes, so Back closes it;
 * closing replaces, so Back does not open it again.
 *
 * A phase asked for on the way in (the member panel's summary links here with one) is shown in the
 * path once it is there, then dropped from the URL.
 */
export function useStepRoute(
  journeyRef: RefObject<MemberJourneyHandle | null>,
  path: OnboardingPathEndpoint | null,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPhaseId = searchParams.get(MEMBER_PHASE_PARAM);

  useEffect(() => {
    if (!requestedPhaseId || !path || !journeyRef.current) return;
    journeyRef.current.showPhase(requestedPhaseId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(MEMBER_PHASE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [requestedPhaseId, path, journeyRef, setSearchParams]);

  const setDetailStepId = (stepId: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (stepId) next.set(MEMBER_STEP_PARAM, stepId);
        else next.delete(MEMBER_STEP_PARAM);
        return next;
      },
      { replace: !stepId },
    );

  return { detailStepId: searchParams.get(MEMBER_STEP_PARAM) ?? "", setDetailStepId };
}

export type StepRoute = ReturnType<typeof useStepRoute>;
