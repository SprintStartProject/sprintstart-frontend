import { apiClient } from "../apiClient";
import type { ProjectRole } from "./featureTypes";
import { mockProjectRoles } from "./mockData";

/**
 * Lists all project roles.
 *
 * **Never throws.** When the request fails, it returns the roles of the mock users instead. The
 * caller cannot tell this from a success; see the mock fallbacks in `docs/testing_strategy.md` §8.
 */
export async function getProjectRoles(): Promise<ProjectRole[]> {
  try {
    const response = await apiClient.fetch<{ projectRoles?: ProjectRole[] } | ProjectRole[]>(
      "/api/v1/projectRoles",
    );

    return Array.isArray(response) ? response : (response.projectRoles ?? []);
  } catch {
    return mockProjectRoles;
  }
}

/**
 * Creates a project role.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function createProjectRole(name: string, description: string): Promise<ProjectRole> {
  return await apiClient.fetch<ProjectRole>("/api/v1/projectRoles", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
    }),
  });
}

/**
 * Gives a user a project role.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function assignProjectRoleToUser(userId: string, roleId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/users/${userId}/project-roles`, {
    method: "POST",
    body: JSON.stringify({
      roleId: roleId,
    }),
  });
}

/**
 * Takes a project role away from a user.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function unassignProjectRoleFromUser(userId: string, roleId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/users/${userId}/project-roles/${roleId}`, {
    method: "DELETE",
  });
}

/**
 * Deletes a project role.
 *
 * No mock fallback: a failure reaches the caller, which says so.
 *
 * @throws ApiError when the backend refuses or cannot be reached.
 */
export async function deleteProjectRole(roleId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/projectRoles/${roleId}`, {
    method: "DELETE",
  });
}
