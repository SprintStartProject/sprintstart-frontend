import type { AdminUser, ProjectOverview, ProjectSummary } from "./types";

// Both spellings the two data sources use for the manager-granting roles: project
// members carry raw `GlobalUserRole` codes, while `AdminUser` exposes the
// humanized permission-group label.
const MANAGER_ELIGIBLE_ROLES = new Set(["PM", "ADMIN", "PROJECT MANAGER", "PROJECT_MANAGER"]);

/**
 * Whether any of the given role signals grants project-manager eligibility.
 *
 * The backend only accepts a manager who already holds the global PM (or ADMIN)
 * role and rejects anyone else with a bare 400, so the UI enforces the same rule
 * up front instead of letting the assignment fail with an opaque "Bad request".
 */
export function isManagerEligible(...roleSignals: Array<string | undefined>): boolean {
  return roleSignals.some(
    (signal) => signal !== undefined && MANAGER_ELIGIBLE_ROLES.has(signal.trim().toUpperCase()),
  );
}

// Kept apart from the manager-eligible set: it is a separate backend rule that
// only happens to name the same roles today.
const MULTI_PROJECT_ROLES = new Set(["PM", "ADMIN", "PROJECT MANAGER", "PROJECT_MANAGER"]);

/**
 * Whether a person with this app role may belong to several projects at once.
 *
 * Customer rule: a regular user (HR included) is in exactly one project, PM and
 * ADMIN may be in several. The backend applies the same rule when assigning, so
 * this only decides whether the UI has to warn about a move. Pass
 * `AdminUser.permissionGroup`, not `AdminUser.roles` (those are project roles).
 */
export function canJoinMultipleProjects(permissionGroup: string | undefined): boolean {
  return (
    permissionGroup !== undefined && MULTI_PROJECT_ROLES.has(permissionGroup.trim().toUpperCase())
  );
}

/** Ids of the projects `userId` is the assigned manager of. */
export function getManagedProjectIds(projects: ProjectOverview[], userId: string): Set<string> {
  return new Set(
    projects.filter((project) => project.manager?.id === userId).map((project) => project.id),
  );
}

/** What a role change from PM/admin to a regular user would leave inconsistent. */
export type RoleDowngradeConflicts = {
  /** How many projects the user is in; `0` when that is no problem (one project at most). */
  projectCount: number;
  /** Projects the user manages; a manager has to hold the PM or admin role. */
  managedProjects: ProjectSummary[];
};

/**
 * The conflicts of changing `user` to `nextPermissionGroup`, or `null` when the
 * change is not a downgrade out of a multi-project role or leaves nothing behind.
 *
 * The backend only swaps the role: memberships and the manager assignment stay,
 * which leaves a regular user in several projects or a manager without the
 * role. The UI only warns, since the admin may clean up right afterwards.
 */
export function getRoleDowngradeConflicts(
  user: AdminUser,
  projects: ProjectOverview[],
  nextPermissionGroup: string,
): RoleDowngradeConflicts | null {
  if (!canJoinMultipleProjects(user.permissionGroup)) return null;
  if (canJoinMultipleProjects(nextPermissionGroup)) return null;

  const projectIds = new Set([...user.projectIds, ...user.projects.map((project) => project.id)]);
  const managedProjects = projects
    .filter((project) => project.manager?.id === user.id)
    .map(({ id, name }) => ({ id, name }));
  const projectCount = projectIds.size > 1 ? projectIds.size : 0;

  if (projectCount === 0 && managedProjects.length === 0) return null;

  return { projectCount, managedProjects };
}

/**
 * How many projects other than `projectId` the user belongs to.
 *
 * `projectIds` is what the user endpoint returns; `projects` is the named list
 * filled in from it (or updated optimistically), so either may be the one that
 * is populated.
 */
export function getOtherProjectCount(user: AdminUser, projectId: string): number {
  const ids = new Set([...user.projectIds, ...user.projects.map((project) => project.id)]);
  ids.delete(projectId);

  return ids.size;
}

/** A person an assignment would move, with the projects they would leave. */
export type MovedUser = {
  user: AdminUser;
  leaving: ProjectSummary[];
};

/**
 * Of the users about to be assigned to `targetProjectId`, those who would leave
 * other projects. Unknown ids are skipped, so a stale selection cannot break it.
 */
export function getMovedUsers(
  users: AdminUser[],
  userIds: Iterable<string>,
  targetProjectId: string,
): MovedUser[] {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return [...userIds].flatMap((userId) => {
    const user = usersById.get(userId);
    if (!user) return [];

    const leaving = getProjectsLeftOnMove(user, targetProjectId);
    return leaving.length > 0 ? [{ user, leaving }] : [];
  });
}

/**
 * The projects a user is removed from when assigned to `targetProjectId`.
 *
 * Empty for PM and ADMIN (they keep every membership) and for users who are in
 * no other project yet, so a non-empty result is exactly the case that needs a
 * warning before the assignment.
 */
export function getProjectsLeftOnMove(user: AdminUser, targetProjectId: string): ProjectSummary[] {
  if (canJoinMultipleProjects(user.permissionGroup)) return [];

  return user.projects.filter((project) => project.id !== targetProjectId);
}
