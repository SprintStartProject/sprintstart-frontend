import type { BadgeVariant } from "../../components/ui/Badge";
import { SIDE_PANEL_SLIDE_MS } from "../../styles/tokens";
import type { ProjectRole, Skill } from "../team-management/types";
import { deriveSourceStatus, SOURCE_META } from "../data-ingestion/data";
import { toSourceSystem } from "../data-ingestion/connectors/sourceSystems";
import type { SourceMeta } from "../data-ingestion/types";
import type { ProjectManager } from "../../services/projectService";
import type {
  AdminUser,
  ProjectEditFormState,
  ProjectFilter,
  ProjectOverview,
  ProjectSummary,
  SkillStatusFilter,
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
  { value: "no-project", label: "Without project" },
];

/** The user's full name, falling back to the username and then the email when it is empty. */
export function getDisplayName(user: AdminUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.username || user.email;
}

type SearchableUser = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
};

/** Manager display name, falling back to the username when no name is set. */
export function getManagerName(manager: ProjectManager): string {
  const fullName = [manager.firstName, manager.lastName].filter(Boolean).join(" ");

  return fullName || manager.username;
}

/**
 * Whether a person matches a free-text search.
 *
 * Name, username and email are each tested on their own. Searching a combined
 * "label" such as `email || username` hides the username as soon as an email
 * exists, which is the case for every real account.
 */
export function matchesUserSearch(user: SearchableUser, term: string): boolean {
  const normalized = term.trim().toLowerCase();

  if (normalized.length === 0) return true;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return [fullName, user.username, user.email].some((value) =>
    (value ?? "").toLowerCase().includes(normalized),
  );
}

/** `"1 member"` / `"2 members"`. */
export function pluralize(count: number, noun: string, plural = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : plural}`;
}

/**
 * Shared Data Ingestion metadata (label, icon) for a project source's raw type
 * string, or `null` for a type the frontend does not know — the backend also
 * emits types such as `SONARQUBE` that have no ingestion UI.
 */
export function getSourceTypeMeta(type: string): SourceMeta | null {
  const system = toSourceSystem(type);

  return system ? SOURCE_META[system] : null;
}

export type SourceTypeGroup = {
  /** Upper-cased raw type, the grouping key. */
  type: string;
  label: string;
  count: number;
};

/** Sources collapsed to one entry per type, in order of first appearance. */
export function groupSourcesByType(sources: Array<{ type: string }>): SourceTypeGroup[] {
  const groups = new Map<string, SourceTypeGroup>();

  for (const source of sources) {
    const key = source.type.toUpperCase();
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { type: key, label: getSourceTypeLabel(source.type), count: 1 });
    }
  }

  return Array.from(groups.values());
}

/**
 * Display label for a project source's raw type string.
 *
 * Known systems use the label from the shared `SOURCE_META`, so "GitHub" reads
 * the same here as on the Data Ingestion page. Unknown types fall back to a
 * title-cased version of the raw value rather than disappearing.
 */
export function getSourceTypeLabel(type: string): string {
  const meta = getSourceTypeMeta(type);

  if (meta) return meta.type;

  return type
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Badge colour for a permission group label (`Admin`, `Project Manager`, `HR`, `User`). Matches by
 * substring, so it also accepts the backend values `ADMIN` and `PROJECT_MANAGER`, but not `PM`.
 */
export function getPermissionGroupVariant(permissionGroup: string): BadgeVariant {
  const normalized = permissionGroup.toUpperCase();

  if (normalized.includes("ADMIN")) return "danger";
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

export type SourceHealthState = "none" | "healthy" | "syncing" | "stale" | "attention";

export type SourceHealth = {
  state: SourceHealthState;
  total: number;
  /** Sources that failed, are disconnected or switched off. */
  attentionCount: number;
  syncingCount: number;
  /** Sources the backend flags as behind their upstream. */
  staleCount: number;
  label: string;
};

/**
 * One-line health of a project's sources, for lists that cannot show each source.
 *
 * Built on the same {@link deriveSourceStatus} the Data Ingestion page uses, so a
 * source reads as healthy or not identically in both places. A disabled source
 * counts as needing attention: it silently stops feeding the knowledge base.
 * "Out of date" is kept apart from failures on purpose — with auto-update off it
 * is the expected state between syncs and must not look like a fault.
 */
export function getSourceHealth(sources: Array<{ status: string }>): SourceHealth {
  let attentionCount = 0;
  let syncingCount = 0;
  let staleCount = 0;

  for (const source of sources) {
    const { state } = deriveSourceStatus({
      backendStatus: source.status,
      hasErrors: false,
      hasNeverSynced: false,
    });

    if (state === "attention" || state === "disabled") attentionCount += 1;
    else if (state === "syncing") syncingCount += 1;
    else if (state === "stale") staleCount += 1;
  }

  const base = { total: sources.length, attentionCount, syncingCount, staleCount };

  if (sources.length === 0) return { ...base, state: "none", label: "No sources" };

  if (attentionCount > 0) {
    return {
      ...base,
      state: "attention",
      label: attentionCount === 1 ? "1 needs attention" : `${attentionCount} need attention`,
    };
  }

  if (syncingCount > 0) return { ...base, state: "syncing", label: "Syncing" };

  if (staleCount > 0) return { ...base, state: "stale", label: `${staleCount} out of date` };

  return { ...base, state: "healthy", label: "All synced" };
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
 * A project a user is assigned to, with the full project record when the
 * project list has it. `overview` is `null` for a stale id, so views can show
 * the name they know without inventing a manager or member count.
 */
export type UserProject = ProjectSummary & {
  overview: ProjectOverview | null;
};

/** Pairs each assigned project summary with its full record from the project list. */
export function resolveUserProjects(
  assigned: ProjectSummary[],
  projects: ProjectOverview[],
): UserProject[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return assigned.map((summary) => {
    const overview = projectsById.get(summary.id) ?? null;

    return { id: summary.id, name: overview?.name ?? summary.name, overview };
  });
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
      (userFilter === "not-onboarded" && !user.hasCompletedOnboarding) ||
      (userFilter === "no-project" && user.projects.length === 0);

    return matchesSearch && matchesFilter;
  });
}

export const PROJECT_FILTER_OPTIONS: Array<{ value: ProjectFilter; label: string }> = [
  { value: "all", label: "All projects" },
  { value: "no-manager", label: "Without manager" },
  { value: "sources-attention", label: "Sources need attention" },
  { value: "no-members", label: "Without members" },
];

function matchesProjectFilter(project: ProjectOverview, filter: ProjectFilter): boolean {
  switch (filter) {
    case "no-manager":
      return project.manager === null;
    case "sources-attention":
      return getSourceHealth(project.sources).state === "attention";
    case "no-members":
      return project.users.length === 0;
    case "all":
      return true;
  }
}

/**
 * Projects matching the search text and the state filter. The filter picks out
 * the gaps the project cards flag (no manager, failing sources, nobody in it);
 * the search then narrows within them.
 */
export function filterAdminProjects(
  projects: ProjectOverview[],
  projectSearchValue: string,
  projectFilter: ProjectFilter = "all",
): ProjectOverview[] {
  const normalizedSearch = projectSearchValue.trim().toLowerCase();

  return projects.filter((project) => {
    if (!matchesProjectFilter(project, projectFilter)) return false;

    const searchableValues = [
      project.id,
      project.name,
      project.description,
      project.industry,
      ...(project.manager
        ? [
            project.manager.firstName,
            project.manager.lastName,
            [project.manager.firstName, project.manager.lastName].filter(Boolean).join(" "),
            project.manager.username,
          ]
        : []),
      ...project.sources.flatMap((source) => [source.id, source.name, source.type, source.status]),
      ...project.users.flatMap((user) => [user.id, user.username, user.email]),
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

export const SKILL_STATUS_FILTER_OPTIONS: Array<{ value: SkillStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "RETIRED", label: "Retired" },
];

/** Role names a skill is linked to, in the order `roles` lists them. */
export function getSkillRoleNames(skill: Skill, roles: ProjectRole[]): string[] {
  const roleNamesById = new Map(roles.map((role) => [role.id, role.name]));

  return skill.roleIds
    .map((roleId) => roleNamesById.get(roleId))
    .filter((name): name is string => Boolean(name));
}

/** Every distinct category currently in use, alphabetically. */
export function getSkillCategories(skills: Skill[]): string[] {
  return Array.from(
    new Set(skills.flatMap((skill) => (skill.category ? [skill.category] : []))),
  ).sort((left, right) => left.localeCompare(right));
}

export function filterSkills(
  skills: Skill[],
  searchValue: string,
  statusFilter: SkillStatusFilter,
  categoryFilter: string,
  roleFilter: string,
): Skill[] {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return skills.filter((skill) => {
    const matchesSearch =
      normalizedSearch.length === 0 || skill.name.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === "all" || skill.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || skill.category === categoryFilter;
    const matchesRole = roleFilter === "all" || skill.roleIds.includes(roleFilter);

    return matchesSearch && matchesStatus && matchesCategory && matchesRole;
  });
}

export function getPaginatedSkills(skills: Skill[], page: number, pageSize = PAGE_SIZE): Skill[] {
  const startIndex = (page - 1) * pageSize;

  return skills.slice(startIndex, startIndex + pageSize);
}
