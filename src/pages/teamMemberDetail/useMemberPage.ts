import { useState, type RefObject } from "react";
import type { MemberJourneyHandle } from "../../features/team-management/components/detail/MemberJourneySection";
import type { PhaseCheckAdminTab } from "../../features/team-management/components/detail/PhaseCheckAdminModal";
import { useProjectContext } from "../../features/projects/useProjectContext";
import { useFeedbackActions } from "./useFeedbackActions";
import { useMemberData } from "./useMemberData";
import { useMemberRoles } from "./useMemberRoles";
import { usePathRebuild } from "./usePathRebuild";
import { useSkipReview } from "./useSkipReview";
import { useStepEditing } from "./useStepEditing";
import { useStepRoute } from "./useStepRoute";
import { useStepTasks } from "./useStepTasks";

/** The phase whose knowledge-check modal is open, and on which tab (null = closed). */
export type CheckModal = { phaseId: string; tab: PhaseCheckAdminTab } | null;

/** Everything one member's page reads and does, a hook per concern. */
export function useMemberPage(
  userId: string | undefined,
  journeyRef: RefObject<MemberJourneyHandle | null>,
) {
  const { selectedProjectId } = useProjectContext();
  const [checkModal, setCheckModal] = useState<CheckModal>(null);
  const data = useMemberData(userId, selectedProjectId);
  const tasks = useStepTasks(data.onboardingPath);
  const route = useStepRoute(journeyRef, data.onboardingPath);

  return {
    selectedProjectId,
    checkModal,
    setCheckModal,
    data,
    tasks,
    route,
    roles: useMemberRoles(data),
    skips: useSkipReview(data),
    feedback: useFeedbackActions(data),
    editing: useStepEditing(data, tasks, route),
    rebuild: usePathRebuild(data, selectedProjectId),
  };
}

export type MemberPageModel = ReturnType<typeof useMemberPage>;
