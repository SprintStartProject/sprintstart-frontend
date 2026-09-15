import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/useAuth";
import { userService } from "../../services/userService";
import { queryKeys } from "../../services/queryKeys";
import type { UserProfile } from "../../services/types";

/**
 * Loads the current user's profile and exposes an `updateProfile` action that
 * also refreshes the global {@link AuthProvider} profile (so the sidebar /
 * avatar update immediately). Shared by the settings profile section and the
 * legacy profile layout so behaviour stays identical.
 *
 * Keyed by `profile.id` from {@link useAuth}, which the app already has by the
 * time a settings page is reachable — this hook does not duplicate that fetch,
 * it just asks the shared cache for the richer read.
 */
export function useProfile() {
  const { profile: authProfile, refetchProfile } = useAuth();
  const queryClient = useQueryClient();
  const userId = authProfile?.id ?? "";

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.profile.mine(userId),
    queryFn: () => userService.getProfile(),
    enabled: Boolean(userId),
  });

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      // Backend requires projectIds on PATCH requests even when the
      // caller isn't changing them — send the current list through.
      const payload = {
        ...updates,
        projectIds: profile?.projectIds ?? [],
      };
      const updatedProfile = await userService.updateProfile(payload);
      queryClient.setQueryData(queryKeys.profile.mine(userId), updatedProfile);
      await refetchProfile();
    } catch (error) {
      console.error("Failed to update profile", error);
      throw error;
    }
  };

  return {
    profile: profile ?? null,
    isLoading: Boolean(userId) && isLoading,
    error: isError ? "Failed to load profile data." : null,
    updateProfile,
  };
}
