import type { AdminUser, ProjectSummary } from "./types";

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

/**
 * Whether a person with this app role may belong to several projects at once.
 *
 * Customer rule: a regular user (HR included) is in exactly one project, PM and
 * ADMIN may be in several. The backend applies the same rule when assigning, so
 * this only decides whether the UI has to warn about a move. Pass
 * `AdminUser.permissionGroup`, not `AdminUser.roles` (those are project roles).
 */
export function canJoinMultipleProjects(permissionGroup: string | undefined): boolean {
  return isManagerEligible(permissionGroup);
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
