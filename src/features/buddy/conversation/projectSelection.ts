/**
 * The slice of the global project context the buddy needs to keep team mode honest: team mode
 * is bound to the globally selected project, and only exists while this user manages it. Passed
 * in by [BuddyProvider] rather than read here, so the hook stays testable without a provider
 * above it.
 */
export type ProjectSelectionSlice = {
  selectedProjectId: string;
  hasSelectedProject: boolean;
  canManageSelected: boolean;
  isLoading: boolean;
  setSelectedProjectId: (projectId: string) => void;
};
