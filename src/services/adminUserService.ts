import { apiClient } from "./apiClient";

type BackendPermissionGroup = "ADMIN" | "HR" | "PM" | "USER";

type BackendProjectRole = {
  id: string;
  name: string;
};

type BackendUserResponse = {
  id: string;
  authId: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  projectRoles?: BackendProjectRole[];
  projectIds?: string[];
  roles?: BackendPermissionGroup[];
  permissionGroup: BackendPermissionGroup;
  enabled: boolean;
  profileIcon: string | null;
  hasCompletedOnboarding: boolean;
};

export type RoleType = "primary" | "secondary";

export type UserRole = {
  id: string;
  name: string;
  description: string;
  type: RoleType;
};

export type RoleAssignment = {
  id: string;
  type: RoleType;
};

export type ProjectSummary = {
  id: string;
  name: string;
};

export type UserProfile = {
  id: string;
  authId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  permissionGroup: string;
  projects: ProjectSummary[];
  projectIds: string[];
  enabled: boolean;
  profileIcon: string;
  hasCompletedOnboarding: boolean;
};

export type AdminUser = {
  id: string;
  authId?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  permissionGroup: string;
  projects: ProjectSummary[];
  projectIds: string[];
  enabled: boolean;
  profileIcon: string;
  hasCompletedOnboarding: boolean;
};

export type UpdateAdminUserRequest = {
  email?: string;
  firstName?: string;
  lastName?: string;
  permissionGroup?: string;
  projectsId?: string[];
};

export type UpdateAdminUserRolesRequest = {
  roles: RoleAssignment[];
};

export type UpdateAdminUserEnabledRequest = {
  enabled: boolean;
};

export type DeleteAdminUserResponse = {
  id: string;
  deleted: boolean;
};

export type AvailableRole = {
  id: string;
  name: string;
  description: string;
};

function getAvailableRolesFromUsers(users: AdminUser[]): AvailableRole[] {
  const roleMap = new Map<string, AvailableRole>();

  users.forEach((user) => {
    user.roles.forEach((role) => {
      if (!roleMap.has(role.id)) {
        roleMap.set(role.id, {
          id: role.id,
          name: role.name,
          description: role.description,
        });
      }
    });
  });

  return Array.from(roleMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function toPermissionGroupLabel(permissionGroup: string): string {
  switch (permissionGroup.trim().toUpperCase()) {
    case "PM":
    case "PROJECT_MANAGER":
    case "PROJECT MANAGER":
      return "Project Manager";
    case "HR":
      return "HR";
    case "ADMIN":
      return "Admin";
    case "USER":
    default:
      return "User";
  }
}

function toBackendPermissionGroup(
  permissionGroup: string,
): BackendPermissionGroup {
  switch (permissionGroup.trim().toUpperCase()) {
    case "ADMIN":
      return "ADMIN";
    case "HR":
      return "HR";
    case "PM":
    case "PROJECT_MANAGER":
    case "PROJECT MANAGER":
      return "PM";
    case "USER":
    default:
      return "USER";
  }
}

function toUserRolesFromProjectRoles(
  projectRoles: BackendProjectRole[] = [],
): UserRole[] {
  return projectRoles.map((role) => ({
    id: role.id,
    name: role.name,
    description: "",
    type: "primary",
  }));
}

function toAdminUser(user: BackendUserResponse): AdminUser {
  return {
    id: user.id,
    authId: user.authId,
    username: user.username,
    email: user.email ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    roles: toUserRolesFromProjectRoles(user.projectRoles),
    permissionGroup: toPermissionGroupLabel(user.permissionGroup),
    projects: [],
    projectIds: user.projectIds ?? [],
    enabled: user.enabled,
    profileIcon: user.profileIcon ?? "",
    hasCompletedOnboarding: user.hasCompletedOnboarding,
  };
}

function toUserProfile(user: BackendUserResponse): UserProfile {
  return {
    ...toAdminUser(user),
    authId: user.authId,
  };
}

function toBackendUpdateRequest(request: UpdateAdminUserRequest) {
  return {
    ...request,
    permissionGroup: request.permissionGroup
      ? toBackendPermissionGroup(request.permissionGroup)
      : undefined,
  };
}

export const adminUserService = {
  /**
   * GET /api/v1/users/me
   *
   * Returns the currently authenticated user.
   * This is a combined response containing Keycloak-owned data and
   * SprintStart-owned data.
   */
  async getCurrentUser(): Promise<UserProfile> {
    const user = await apiClient.fetch<BackendUserResponse>("/api/v1/users/me");
    return toUserProfile(user);
  },

  /**
   * GET /api/v1/admin/users
   *
   * Returns all users visible for admin user management.
   */
  async getUsers(): Promise<AdminUser[]> {
    const users = await apiClient.fetch<BackendUserResponse[]>(
      "/api/v1/admin/users",
    );
    return users.map(toAdminUser);
  },

  /**
   * GET /api/v1/admin/users/{id}
   *
   * Returns detailed information for a specific user.
   */
  async getUserById(userId: string): Promise<AdminUser> {
    const user = await apiClient.fetch<BackendUserResponse>(
      `/api/v1/admin/users/${userId}`,
    );
    return toAdminUser(user);
  },

  /**
   * PATCH /api/v1/admin/users/{id}
   *
   * Updates admin-editable user fields through the SprintStart backend.
   * The backend may forward Keycloak-owned changes to Keycloak.
   *
   * Password fields are intentionally excluded.
   *
   * Request body:
   * {
   *   email?: "max.mustermann@example.com",
   *   firstName?: "Max",
   *   lastName?: "Mustermann",
   *   permissionGroup?: "USER"
   * }
   */
  async updateUser(
    userId: string,
    request: UpdateAdminUserRequest,
  ): Promise<AdminUser> {
    const updatedUser = await apiClient.fetch<BackendUserResponse>(
      `/api/v1/admin/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toBackendUpdateRequest(request)),
      },
    );

    return toAdminUser(updatedUser);
  },

  /**
   * PATCH /api/v1/admin/users/{id}/roles
   *
   * Updates SprintStart-owned project-related working areas.
   *
   * Request body:
   * {
   *   roles: [
   *     { id: "role-backend-developer", type: "primary" },
   *     { id: "role-frontend-developer", type: "secondary" }
   *   ]
   * }
   */
  async updateUserRoles(
    userId: string,
    request: UpdateAdminUserRolesRequest,
  ): Promise<AdminUser> {
    await apiClient.fetch<void>(`/api/v1/admin/users/${userId}/roles`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return adminUserService.getUserById(userId);
  },

  /**
   * PATCH /api/v1/admin/users/{id}/enabled
   *
   * Enables or disables a user account through the SprintStart backend.
   * The backend may forward the change to Keycloak.
   *
   * Request body:
   * {
   *   enabled: false
   * }
   */
  async updateUserEnabled(
    userId: string,
    request: UpdateAdminUserEnabledRequest,
  ): Promise<AdminUser> {
    const updatedUser = await apiClient.fetch<BackendUserResponse>(
      `/api/v1/admin/users/${userId}/enabled`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );

    return toAdminUser(updatedUser);
  },

  /**
   * DELETE /api/v1/admin/users/{id}
   *
   * Permanently deletes a user account through the SprintStart backend.
   * Account activation/deactivation should use:
   * PATCH /api/v1/admin/users/{id}/enabled
   */
  async deleteUser(userId: string): Promise<DeleteAdminUserResponse> {
    return apiClient.fetch<DeleteAdminUserResponse>(
      `/api/v1/admin/users/${userId}`,
      {
        method: "DELETE",
      },
    );
  },

  /**
   * Frontend helper only.
   *
   * There is no separate endpoint for this. The role options are derived from
   * the roles that are already present in GET /api/v1/admin/users.
   */
  getAvailableRolesFromUsers,
};
