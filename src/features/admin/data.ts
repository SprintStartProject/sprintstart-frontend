import type { BadgeVariant } from "../../components/ui/Badge";
import { SIDE_PANEL_SLIDE_MS } from "../../styles/tokens";
import type {
  AdminUser,
  ProjectEditFormState,
  ProjectOverview,
  ProjectSummary,
  UserEditFormState,
  UserFilter,
} from "./types";

export const PAGE_SIZE = 8;
// The admin drawers keep their selection alive after closing for the same
// reason `PanelPresence` does: unmounting sooner would cut the slide off
// halfway and the drawer would appear to vanish rather than glide away.
export const DRAWER_CLOSE_DELAY_MS = SIDE_PANEL_SLIDE_MS + 30;
/**
 * The permission groups the user drawer offers, as the labels `adminUserService` maps them to and
 * from. `HR` is not among them, so the drawer cannot make a user HR.
 */
export const PERMISSION_GROUP_OPTIONS = ["Admin", "User", "Project Manager"] as const;

export const USER_FILTER_OPTIONS: Array<{ value: UserFilter; label: string }> = [
  { value: "all", label: "All users" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
  { value: "onboarded", label: "Onboarding completed" },
  { value: "not-onboarded", label: "Onboarding open" },
];

/** The user's full name, falling back to the username and then the email when it is empty. */
export function getDisplayName(user: AdminUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.username || user.email;
}

/**
 * Badge colour for a permission group label (`Admin`, `Project Manager`, `HR`, `User`). Matches by
 * substring, so it also accepts the backend values `ADMIN` and `PROJECT_MANAGER`, but not `PM`.
 */
export function getPermissionGroupVariant(permissionGroup: string): BadgeVariant {
  const normalized = permissionGroup.toUpperCase();

  if (normalized.includes("ADMIN")) return "warning";
  if (normalized.includes("PROJECT")) return "success";
  return "neutral";
}

/** Badge colour for a project source's connection status; an unknown status gets `brand`. */
export function getSourceStatusVariant(status: string): BadgeVariant {
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === "CONNECTED") return "success";
  if (normalizedStatus === "INDEXING") return "warning";
  if (normalizedStatus === "ERROR") return "danger";
  if (normalizedStatus === "DISCONNECTED") return "neutral";

  return "brand";
}

export function getProjectUsersCount(project: { users: unknown[] }) {
  return project.users.length;
}

export function getProjectSourcesCount(project: { sources: unknown[] }) {
  return project.sources.length;
}

export function getUserEditFormState(user: AdminUser): UserEditFormState {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    permissionGroup: user.permissionGroup,
    enabled: user.enabled,
  };
}

/** {@link getDisplayName} for the drawer while editing: reads the names from the unsaved draft. */
export function getDraftDisplayName(user: AdminUser, draftUser: UserEditFormState) {
  const fullName = [draftUser.firstName, draftUser.lastName].filter(Boolean).join(" ");

  return fullName || user.username || draftUser.email;
}

export function getProjectEditFormState(
  project: Pick<ProjectOverview, "name" | "description">,
): ProjectEditFormState {
  return {
    name: project.name,
    description: project.description,
  };
}

/** Every project as id and name, sorted by name, for the project pickers in the drawers. */
export function getAvailableProjects(projects: ProjectOverview[]): ProjectSummary[] {
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Fills in each user's assigned projects with their names.
 *
 * The user endpoint only returns `projectIds`, so the names have to come from
 * the separately loaded project list — `projects` on a freshly mapped
 * `AdminUser` is always empty. It is still used as a fallback, because the
 * drawers update it optimistically after assigning or removing a project.
 *
 * An id without a matching project keeps a readable placeholder rather than
 * disappearing: it means the project list is stale or the project was deleted,
 * and silently dropping the row would hide that.
 */
export function enrichUsersWithProjectNames(
  users: AdminUser[],
  projects: ProjectSummary[],
): AdminUser[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return users.map((user) => {
    const assignedIds =
      user.projectIds.length > 0 ? user.projectIds : user.projects.map((project) => project.id);

    return {
      ...user,
      projects: assignedIds.map(
        (projectId) =>
          projectsById.get(projectId) ??
          user.projects.find((project) => project.id === projectId) ?? {
            id: projectId,
            name: `Project ${projectId.slice(0, 8)}`,
          },
      ),
    };
  });
}

/**
 * Narrows the user table to the search text and the status filter.
 *
 * The search is a case-insensitive substring match over nearly every field of a user, including
 * ids, roles and project names, so an admin can paste any id they have to hand.
 */
export function filterAdminUsers(
  users: AdminUser[],
  searchValue: string,
  userFilter: UserFilter,
): AdminUser[] {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return users.filter((user) => {
    const searchableValues = [
      user.id,
      user.username,
      user.email,
      user.firstName,
      user.lastName,
      user.permissionGroup,
      user.profileIcon,
      String(user.enabled),
      String(user.hasCompletedOnboarding),
      ...user.roles.flatMap((role) => [role.id, role.name, role.description, role.type]),
      ...user.projects.flatMap((project) => [project.id, project.name]),
    ];

    const matchesSearch =
      normalizedSearch.length === 0 ||
      searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch));

    const matchesFilter =
      userFilter === "all" ||
      (userFilter === "enabled" && user.enabled) ||
      (userFilter === "disabled" && !user.enabled) ||
      (userFilter === "onboarded" && user.hasCompletedOnboarding) ||
      (userFilter === "not-onboarded" && !user.hasCompletedOnboarding);

    return matchesSearch && matchesFilter;
  });
}

/**
 * Narrows the project table to the search text: a case-insensitive substring match over the
 * project's own fields and those of its sources and members.
 */
export function filterAdminProjects(
  projects: ProjectOverview[],
  projectSearchValue: string,
): ProjectOverview[] {
  const normalizedSearch = projectSearchValue.trim().toLowerCase();

  return projects.filter((project) => {
    const searchableValues = [
      project.id,
      project.name,
      project.description,
      ...project.sources.flatMap((source) => [source.id, source.name, source.type, source.status]),
      ...project.users.flatMap((user) => [
        user.id,
        user.username,
        user.email,
        ...user.projectRoles,
      ]),
    ];

    return (
      normalizedSearch.length === 0 ||
      searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  });
}

export function getTotalPages(itemCount: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

/** Clamps the current page to the last one, e.g. after a filter or a delete shortened the list. */
export function getSafePage(page: number, totalPages: number) {
  return Math.min(page, totalPages);
}

export function getPaginatedUsers(
  users: AdminUser[],
  page: number,
  pageSize = PAGE_SIZE,
): AdminUser[] {
  const startIndex = (page - 1) * pageSize;

  return users.slice(startIndex, startIndex + pageSize);
}

export function getPaginatedProjects(
  projects: ProjectOverview[],
  page: number,
  pageSize = PAGE_SIZE,
): ProjectOverview[] {
  const startIndex = (page - 1) * pageSize;

  return projects.slice(startIndex, startIndex + pageSize);
}

export function areAllVisibleUsersSelected(users: AdminUser[], selectedUserIds: Set<string>) {
  return users.length > 0 && users.every((user) => selectedUserIds.has(user.id));
}

export function toggleSelectedUserId(selectedUserIds: Set<string>, userId: string) {
  const nextSelectedUserIds = new Set(selectedUserIds);

  if (nextSelectedUserIds.has(userId)) {
    nextSelectedUserIds.delete(userId);
  } else {
    nextSelectedUserIds.add(userId);
  }

  return nextSelectedUserIds;
}

/**
 * The "select all" checkbox: selects or clears only the users on the current page and leaves the
 * selection on other pages as it is.
 */
export function toggleVisibleUserSelection(
  selectedUserIds: Set<string>,
  visibleUsers: AdminUser[],
  allVisibleUsersSelected: boolean,
) {
  const nextSelectedUserIds = new Set(selectedUserIds);

  if (allVisibleUsersSelected) {
    visibleUsers.forEach((user) => nextSelectedUserIds.delete(user.id));
  } else {
    visibleUsers.forEach((user) => nextSelectedUserIds.add(user.id));
  }

  return nextSelectedUserIds;
}

/**
 * Takes deleted users out of every project's member list, so the projects tab does not show them
 * until the next reload.
 */
export function removeUsersFromProjects(
  projects: ProjectOverview[],
  userIdsToRemove: Set<string>,
): ProjectOverview[] {
  return projects.map((project) => ({
    ...project,
    users: project.users.filter((user) => !userIdsToRemove.has(user.id)),
  }));
}
