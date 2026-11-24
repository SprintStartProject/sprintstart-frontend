import type { ProjectRole, TeamOverviewUser } from "./featureTypes";

/**
 * Team-overview user as the API actually sends it.
 *
 * The projects arrive under `projectIds` as objects keyed by `projectId`. The
 * older single `project` shape is still accepted because fixtures and the
 * `me/team-overview` endpoint use it.
 */
export type BackendTeamOverviewUser = Omit<TeamOverviewUser, "projects"> & {
  projectIds?: { projectId?: string; id?: string; name?: string }[];
  project?: { id?: string; name?: string };
};

/** Normalizes whichever project shape the API returned into `projects`. */
export function toTeamOverviewProjects(
  user: BackendTeamOverviewUser,
): TeamOverviewUser["projects"] {
  const fromList = (user.projectIds ?? []).flatMap((project) => {
    const id = project.projectId ?? project.id;

    return id ? [{ id, name: project.name ?? "" }] : [];
  });

  if (fromList.length > 0) return fromList;

  return user.project?.id ? [{ id: user.project.id, name: user.project.name ?? "" }] : [];
}

/** A team-overview user as the app uses it: one `projects` list, and role ids that are set. */
export function normalizeOverviewUser(user: BackendTeamOverviewUser): TeamOverviewUser {
  return {
    ...user,
    projects: toTeamOverviewProjects(user),
    roles: user.roles.map((role: ProjectRole & { roleId?: string }) => ({
      ...role,
      id: role.id || role.roleId || "",
    })),
  };
}
