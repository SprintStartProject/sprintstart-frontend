import { useQueryFetch } from "../../hooks/useQueryFetch";
import { offboardingService } from "../../services/offboardingService";
import { queryKeys } from "../../services/queryKeys";

/** The selected project's members with the identities in the evidence that are theirs. */
export function useProjectMembers(projectId: string) {
  return useQueryFetch(
    queryKeys.offboarding.members(projectId),
    () => offboardingService.fetchMembers(projectId),
    { enabled: projectId !== "" },
  );
}
