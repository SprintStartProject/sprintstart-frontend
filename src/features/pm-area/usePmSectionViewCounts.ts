import { useQueryFetch } from "../../hooks/useQueryFetch";
import { knowledgeRequestService } from "../../services/knowledgeRequestService";
import { queryKeys } from "../../services/queryKeys";
import { getProjectRoles } from "../../services/teamManagementService";
import { useProjectContext } from "../projects/useProjectContext";
import { useTeamRoster } from "./useTeamRoster";

export type PmSectionViewCounts = {
  members?: number;
  roles?: number;
  answers?: number;
};

/**
 * The counts on the views that grow out of the workspace's tab bar: Members and Roles inside
 * Team, Durable answers inside Escalations (Open already has its figure).
 *
 * Read from the same cache entries the sections themselves read, under the same keys and
 * loaders, so the figure in the tab and the list under it are always the one answer. Roles and
 * answers are only asked for while their section is open; the roster is read on every PM page
 * anyway.
 */
export function usePmSectionViewCounts(section: string): PmSectionViewCounts {
  const { selectedProjectId } = useProjectContext();
  const { data: roster } = useTeamRoster();
  const { data: roles } = useQueryFetch(
    queryKeys.projectRoles.byProject(selectedProjectId),
    getProjectRoles,
    { enabled: section === "team" && Boolean(selectedProjectId) },
  );
  const { data: answers } = useQueryFetch(
    queryKeys.knowledgeRequest.answers(selectedProjectId),
    () =>
      selectedProjectId
        ? knowledgeRequestService.listAnswers(selectedProjectId)
        : Promise.resolve([]),
    { enabled: section === "escalations" && Boolean(selectedProjectId) },
  );

  return {
    members: roster?.length,
    roles: roles?.length,
    answers: answers?.length,
  };
}
