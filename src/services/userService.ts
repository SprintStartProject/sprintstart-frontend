import { apiClient } from "./apiClient";
import type { UserProfile } from "./types";

type BackendUserProfile = Omit<UserProfile, "projectRoles"> & {
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

export const userService = {
  login(): Promise<UserProfile> {
    throw new Error("Direct login is disabled. Please use the SSO flow.");
  },

  async getProfile(): Promise<UserProfile | null> {
    try {
      const profile =
        await apiClient.fetch<BackendUserProfile>("/api/v1/users/me");
      return toUserProfile(profile);
    } catch (error) {
      console.error("Failed to retrieve profile", error);
      return null;
    }
  },

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const updatedProfile = await apiClient.fetch<BackendUserProfile>(
      "/api/v1/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(profile),
      },
    );

    return toUserProfile(updatedProfile);
  },

  logout(): Promise<void> {
    return Promise.resolve();
  },
};
