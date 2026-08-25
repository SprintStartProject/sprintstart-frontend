// ============================================================
// projectService.ts
// ============================================================

import { ApiError, apiClient } from "./apiClient";

/**
 * Moves one user out of `sourceProjectId` and into the project addressed by the
 * request path.
 *
 * Deliberately a single request rather than a remove followed by an assign: a
 * project manager only sees users mapped to their own projects, so a failed
 * second call would leave them unable to undo the first.
 */
export type GlobalUserRole = "ADMIN" | "HR" | "PM" | "USER" | (string & {});

export type ProjectRole = "MEMBER" | "MANAGER" | "TEAMLEAD" | (string & {});

export type ProjectSourceType = "GITHUB" | "JIRA" | "SONARQUBE" | "UPLOAD" | (string & {});

export type ProjectSourceStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "UPDATING"
  | "OUT_OF_DATE"
  | "DISABLED"
  | "FAILED"
  | "INDEXING"
  | "ERROR"
  | (string & {});

export type ProjectSource = {
  id: string;
  name: string;
  type: ProjectSourceType;
  status: ProjectSourceStatus;
};

/**
 * A role as the authoring surfaces need it: the id to edit by, the name to show.
 *
 * Carried beside `projectRoles` rather than replacing it. The names are what every existing
 * consumer renders; the ids are what lets a caller remove one role without matching on its name.
 */
export type ProjectRoleRef = {
  id: string;
  name: string;
};

export type ProjectUserSummary = {
  id: string;
  username: string;
  email: string;
  profileIcon?: string;
  roles?: GlobalUserRole[];
  projectRoles: ProjectRole[];
  /** Undefined when the payload did not carry ids, which is not the same as holding no roles. */
  projectRoleRefs?: ProjectRoleRef[];
};

export type ProjectUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profileIcon?: string;
  roles: GlobalUserRole[];
  projectRoles: ProjectRole[];
  /** Undefined when the payload did not carry ids, which is not the same as holding no roles. */
  projectRoleRefs?: ProjectRoleRef[];
  enabled: boolean;
};

/** The single user responsible for a project, or a candidate for that role. */
export type ProjectManager = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AdminProject = {
  id: string;
  name: string;
  description: string;
  /** `null` when no project manager is assigned. */
  manager: ProjectManager | null;
  sources: ProjectSource[];
  users: ProjectUserSummary[];
};

export type AdminProjectDetails = Omit<AdminProject, "users"> & {
  users: ProjectUser[];
};

/** Compact shape returned by the project-manager-scoped listing. */
export type ManagedProject = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
};

export type ProjectSummary = Pick<AdminProject, "id" | "name">;

export type CreateProjectRequest = {
  name: string;
  description?: string;
};

export type UpdateProjectRequest = {
  name?: string;
  description?: string;
};

export type AssignProjectUsersRequest = {
  userIds: string[];
};

export type DeleteProjectResponse = {
  id: string;
  deleted: boolean;
};

type BackendProjectSource = {
  id: string;
  name: string;
  type: string;
  status: string;
};

type BackendProjectUserSummary = {
  id: string;
  username: string;
  email: string | null;
};

type BackendProjectUser = BackendProjectUserSummary & {
  firstName: string;
  lastName: string;
  roles: string[];
  projectRoles: string[];
  projectRoleRefs?: ProjectRoleRef[];
  enabled: boolean;
};

type BackendProjectManager = {
  id: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
};

type BackendManagedProject = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type BackendAdminProject = {
  id: string;
  name: string;
  description: string | null;
  manager: BackendProjectManager | null;
  sources: BackendProjectSource[];
  users: BackendProjectUserSummary[];
};

type BackendAdminProjectDetails = Omit<BackendAdminProject, "users"> & {
  users: BackendProjectUser[];
};

type BackendCurrentUserProject = {
  id?: string;
  projectId?: string;
  name?: string;
};

type BackendCurrentUser = {
  projectIds?: string[];
  projects?: BackendCurrentUserProject[];
};

function toProjectSource(source: BackendProjectSource): ProjectSource {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    status: source.status,
  };
}

function toProjectUserSummary(user: BackendProjectUserSummary): ProjectUserSummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? "",
    projectRoles: [],
  };
}

function toProjectUser(user: BackendProjectUser): ProjectUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    projectRoles: user.projectRoles,
    projectRoleRefs: user.projectRoleRefs,
    enabled: user.enabled,
  };
}

function toProjectManager(
  manager: BackendProjectManager | null | undefined,
): ProjectManager | null {
  if (!manager) return null;

  return {
    id: manager.id,
    username: manager.username,
    email: manager.email ?? "",
    firstName: manager.firstName,
    lastName: manager.lastName,
  };
}

function toManagedProject(project: BackendManagedProject): ManagedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    memberCount: project.memberCount,
  };
}

function toAdminProject(project: BackendAdminProject): AdminProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    manager: toProjectManager(project.manager),
    sources: project.sources.map(toProjectSource),
    users: project.users.map(toProjectUserSummary),
  };
}

function toAdminProjectDetails(project: BackendAdminProjectDetails): AdminProjectDetails {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    manager: toProjectManager(project.manager),
    sources: project.sources.map(toProjectSource),
    users: project.users.map(toProjectUser),
  };
}

function toBackendProjectRequest(request: CreateProjectRequest | UpdateProjectRequest) {
  return {
    name: request.name,
    description: request.description,
  };
}

function toFallbackProject(id: string, name?: string): AdminProject {
  return {
    id,
    name: name ?? `Project ${id.slice(0, 8)}`,
    description: "",
    manager: null,
    sources: [],
    users: [],
  };
}
async function getProjectsFromCurrentUser(): Promise<AdminProject[]> {
  const user = await apiClient.fetch<BackendCurrentUser>("/api/v1/users/me");
  const projectIds = user.projectIds ?? [];
  const projects = user.projects ?? [];

  const namedProjects = projects.reduce<AdminProject[]>((acc, project) => {
    const id = project.id ?? project.projectId;
    if (!id) return acc;

    acc.push(toFallbackProject(id, project.name));
    return acc;
  }, []);

  const namedProjectIds = new Set(namedProjects.map((project) => project.id));
  const fallbackProjects = projectIds
    .filter((projectId) => !namedProjectIds.has(projectId))
    .map((projectId) => toFallbackProject(projectId));

  return [...namedProjects, ...fallbackProjects];
}

async function fetchAdminProjects(): Promise<AdminProject[]> {
  const projects = await apiClient.fetch<BackendAdminProject[]>("/api/v1/admin/projects");

  return projects.map(toAdminProject);
}

/**
 * Project CRUD, membership and manager assignment.
 * Admin-only endpoints throw ApiError 403 for non-admin callers.
 * Falls back to user-scoped endpoints for PM-level operations.
 */
export const projectService = {
  async getProjects(): Promise<AdminProject[]> {
    try {
      return await fetchAdminProjects();
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        return getProjectsFromCurrentUser();
      }

      throw error;
    }
  },

  async getProjectById(projectId: string): Promise<AdminProjectDetails> {
    const project = await apiClient.fetch<BackendAdminProjectDetails>(
      `/api/v1/admin/projects/${projectId}`,
    );

    return toAdminProjectDetails(project);
  },

  /**
   * Fetches one project's details — metadata, connected sources and assigned
   * users — through the project-scoped endpoint any project member may reach.
   *
   * Unlike `getProjectById` (which hits the ADMIN-only `/admin/projects/{id}`),
   * this uses `/projects/{id}`, authorized for the assigned manager and members
   * as well. It is how PM/member flows obtain a project's `sources`, which the
   * ADMIN-only listing never exposes to them.
   */
  async getAccessibleProject(projectId: string): Promise<AdminProjectDetails> {
    const project = await apiClient.fetch<BackendAdminProjectDetails>(
      `/api/v1/projects/${projectId}`,
    );

    return toAdminProjectDetails(project);
  },

  async createProject(request: CreateProjectRequest): Promise<AdminProjectDetails> {
    const project = await apiClient.fetch<BackendAdminProjectDetails>("/api/v1/admin/projects", {
      method: "POST",
      body: JSON.stringify(toBackendProjectRequest(request)),
    });

    return toAdminProjectDetails(project);
  },

  async updateProject(
    projectId: string,
    request: UpdateProjectRequest,
  ): Promise<AdminProjectDetails> {
    const project = await apiClient.fetch<BackendAdminProjectDetails>(
      `/api/v1/admin/projects/${projectId}`,
      {
        method: "PATCH",
        body: JSON.stringify(toBackendProjectRequest(request)),
      },
    );

    return toAdminProjectDetails(project);
  },

  async deleteProject(projectId: string): Promise<DeleteProjectResponse> {
    return apiClient.fetch<DeleteProjectResponse>(`/api/v1/admin/projects/${projectId}`, {
      method: "DELETE",
    });
  },

  async getProjectUsers(projectId: string): Promise<ProjectUser[]> {
    const users = await apiClient.fetch<BackendProjectUser[]>(
      `/api/v1/admin/projects/${projectId}/users`,
    );

    return users.map(toProjectUser);
  },

  async assignUsersToProject(
    projectId: string,
    request: AssignProjectUsersRequest,
  ): Promise<ProjectUser[]> {
    const users = await apiClient.fetch<BackendProjectUser[]>(
      `/api/v1/admin/projects/${projectId}/users`,
      {
        method: "POST",
        body: JSON.stringify({ userIds: request.userIds }),
      },
    );

    return users.map(toProjectUser);
  },

  async removeUserFromProject(projectId: string, userId: string): Promise<void> {
    await apiClient.fetch<void>(`/api/v1/admin/projects/${projectId}/users/${userId}`, {
      method: "DELETE",
    });
  },

  /**
   * Returns the projects the current user is allowed to manage.
   *
   * Admins get every project, project managers only the ones they are the
   * assigned manager of. Requires the PM or ADMIN role.
   */
  async getManagedProjects(): Promise<ManagedProject[]> {
    const projects = await apiClient.fetch<BackendManagedProject[]>("/api/v1/projects/managed");

    return projects.map(toManagedProject);
  },

  /** Returns the users that may be assigned as a project manager. Admin-only. */
  async getManagerCandidates(): Promise<ProjectManager[]> {
    const candidates = await apiClient.fetch<BackendProjectManager[]>(
      "/api/v1/admin/projects/candidates/managers",
    );

    return candidates.flatMap((candidate) => {
      const manager = toProjectManager(candidate);
      return manager ? [manager] : [];
    });
  },

  /**
   * Assigns the project manager, replacing any existing assignment.
   *
   * A project has at most one manager, so this overwrites rather than appends.
   * Admin-only.
   */
  async setProjectManager(projectId: string, managerUserId: string): Promise<AdminProjectDetails> {
    const project = await apiClient.fetch<BackendAdminProjectDetails>(
      `/api/v1/admin/projects/${projectId}/manager`,
      {
        method: "PUT",
        body: JSON.stringify({ managerUserId }),
      },
    );

    return toAdminProjectDetails(project);
  },

  /** Removes the manager assignment from a project. Admin-only. */
  async clearProjectManager(projectId: string): Promise<void> {
    await apiClient.fetch<void>(`/api/v1/admin/projects/${projectId}/manager`, {
      method: "DELETE",
    });
  },
};
