import { apiClient } from "./apiClient";
import type { ProjectSummary } from "./projectService";
import type { UserProfile } from "./types";

type BackendUserProfile = Omit<UserProfile, "projectRoles" | "projectIds"> & {
  projectRoles?: UserProfile["projectRoles"];
  projectIds?: string[];
};

function toUserProfile(profile: BackendUserProfile): UserProfile {
  return {
    ...profile,
    projectRoles: profile.projectRoles ?? [],
    projectIds: profile.projectIds ?? [],
  };
}

/**
 * Service managing user authentication, profile retrieval, and updates.
 * Now integrated with Keycloak via the central apiClient.
 */
export const userService = {
  /**
   * Legacy login method. In Keycloak mode, authentication is handled by the SSO flow.
   * This method is kept for type compatibility but should be bypassed by the AuthProvider.
   */
  login(): Promise<UserProfile> {
    throw new Error("Direct login is disabled. Please use the SSO flow.");
  },

  /**
   * Retrieves the profile of the currently authenticated user from the backend.
   * The backend resolves the user based on the JWT subject.
   *
   * @returns Promise resolving to UserProfile.
   * @throws Error if the user is not found or unauthorized.
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      const profile = await apiClient.fetch<BackendUserProfile>("/api/v1/users/me");
      return toUserProfile(profile);
    } catch (error) {
      console.error("Failed to retrieve profile", error);
      return null;
    }
  },

  /**
   * Updates specific fields of the user's profile on the backend.
   *
   * @param profile - Partial profile object containing fields to update.
   * @returns Promise resolving to the updated UserProfile.
   */
  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    // Workaround: Map 'projectIds' to 'projectsId' since the backend incorrectly expects it
    // and treats it as mandatory even for PATCH requests.
    const payload: Record<string, unknown> = { ...profile };
    if (payload.projectIds !== undefined) {
      payload.projectsId = payload.projectIds;
      delete payload.projectIds;
    }

    const updatedProfile = await apiClient.fetch<BackendUserProfile>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return toUserProfile(updatedProfile);
  },

  /**
   * Legacy logout method. In Keycloak mode, use the Keycloak instance to logout.
   */
  logout(): Promise<void> {
    return Promise.resolve();
  },

  /**
   * GET /api/v1/users/me/projects
   *
   * Returns the projects the authenticated user is assigned to. Available to
   * any authenticated user (unlike GET /api/v1/admin/projects, which is
   * ADMIN-only), so PM/HR flows that need a project id -- e.g. connecting a
   * GitHub repository -- can be scoped to the current user's own projects.
   */
  async getMyProjects(): Promise<ProjectSummary[]> {
    return apiClient.fetch<ProjectSummary[]>("/api/v1/users/me/projects");
  },
};
