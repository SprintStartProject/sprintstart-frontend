import { getDisplayName } from "../data";
import { ADMIN_TAB_ORDER } from "../types";
import type { AdminProjectDetails, AdminTab, AdminUser, ProjectOverview } from "../types";

/** Where a drawer was opened from, so the new one can offer a way back. */
export type DrawerOrigin = { kind: "user" | "project"; id: string };

/** A project or a user a link asked to open. */
export type DeepLink = { projectId: string | null; userId: string | null };

/**
 * The tabs a group may see. Skills is ADMIN-only: every mutation on it (create/update/retire)
 * 403s for HR, so the tab itself is hidden rather than shown and failing on click.
 */
export function visibleAdminTabs(permissionGroup: string | undefined): AdminTab[] {
  return ADMIN_TAB_ORDER.filter((tab) => tab !== "skills" || permissionGroup === "ADMIN");
}

/** `?projectId=` and `?userId=`, or none when the link names neither. */
export function readDeepLink(params: URLSearchParams): DeepLink | null {
  const projectId = params.get("projectId");
  const userId = params.get("userId");

  return projectId || userId ? { projectId, userId } : null;
}

/** The tab a link asked for, if the group may see it. */
export function requestedAdminTab(params: URLSearchParams, tabs: AdminTab[]): AdminTab | undefined {
  return tabs.find((tab) => tab === params.get("tab"));
}

/** The tab to start on: the one asked for, else projects for a project link, else users. */
export function initialAdminTab(
  requested: AdminTab | undefined,
  params: URLSearchParams,
): AdminTab {
  return requested ?? (params.get("projectId") ? "projects" : "users");
}

/**
 * The parameters to strip from the URL once handed off. `tab` is consumed whenever it arrives; the
 * drawer links only on mount, since the drawer logic assumes no drawer is open yet.
 */
export function handedOffKeys(params: URLSearchParams, drawerLinksConsumed: boolean): string[] {
  const keys = drawerLinksConsumed ? ["tab"] : ["tab", "projectId", "userId"];

  return keys.filter((key) => params.has(key));
}

export type DeepLinkTarget = {
  project: ProjectOverview | null;
  user: AdminUser | null;
  tab: AdminTab;
};

/**
 * What a link opens, once the lists are there. A project wins over a user; a link to something
 * that does not exist any more opens nothing.
 */
export function resolveDeepLink(
  link: DeepLink,
  projects: ProjectOverview[],
  users: AdminUser[],
): DeepLinkTarget | null {
  const project = link.projectId
    ? projects.find((entry) => entry.id === link.projectId)
    : undefined;
  const user = link.userId ? users.find((entry) => entry.id === link.userId) : undefined;

  if (!project && !user) return null;

  return project
    ? { project, user: null, tab: "projects" }
    : { project: null, user: user ?? null, tab: "users" };
}

/**
 * The label of the drawer a drawer was opened from, looked up live so a rename shows up and a
 * deleted origin simply offers no way back instead of a button that does nothing.
 */
export function drawerOriginName(
  origin: DrawerOrigin | null,
  users: AdminUser[],
  projects: ProjectOverview[],
): string | null {
  if (!origin) return null;

  if (origin.kind === "user") {
    const originUser = users.find((entry) => entry.id === origin.id);

    return originUser ? getDisplayName(originUser) : null;
  }

  return projects.find((entry) => entry.id === origin.id)?.name ?? null;
}

/** The users with a project's membership brought in line with its updated member list. */
export function applyProjectToUsers(
  users: AdminUser[],
  updatedProject: AdminProjectDetails,
): AdminUser[] {
  const summary = { id: updatedProject.id, name: updatedProject.name };
  const assigned = new Set(updatedProject.users.map((projectUser) => projectUser.id));

  return users.map((user) => {
    const hasProject = user.projects.some((project) => project.id === updatedProject.id);

    if (assigned.has(user.id)) {
      const nextProjects = hasProject
        ? user.projects.map((project) => (project.id === updatedProject.id ? summary : project))
        : [...user.projects, summary];

      return {
        ...user,
        projects: nextProjects.sort((left, right) => left.name.localeCompare(right.name)),
      };
    }

    if (hasProject) {
      return {
        ...user,
        projects: user.projects.filter((project) => project.id !== updatedProject.id),
      };
    }

    return user;
  });
}

/** A copy of the set without one id. */
export function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);

  return next;
}
