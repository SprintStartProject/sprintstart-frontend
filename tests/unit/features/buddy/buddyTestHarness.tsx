/* eslint-disable react-refresh/only-export-components -- a test harness deliberately mixes
   stub factories and one wrapper component in a single test-only file. */
import type { ReactNode } from "react";
import { AuthContext, type AuthContextType } from "../../../../src/context/AuthContext";
import {
  ToastContext,
  type ToastContextType,
  type ToastVariant,
} from "../../../../src/context/ToastContext";
import {
  ProjectContext,
  type ProjectContextValue,
} from "../../../../src/features/projects/ProjectContext";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import type { UserProfile } from "../../../../src/services/types";

/**
 * The three providers [BuddyProvider] reads above the session — auth (whose profile scopes the
 * persisted team preference), the project context (which team mode is bound to), and toasts
 * (which carry the audible fallback). Stubs, overridable per test.
 */
export const TEST_USER_ID = "user-1";

export function createAuthValue(profileId: string | null = TEST_USER_ID): AuthContextType {
  const profile = profileId === null ? null : ({ id: profileId } as unknown as UserProfile);

  return {
    status: profile ? "authenticated" : "unauthenticated",
    profile,
    login: async () => {},
    logout: async () => {},
    refetchProfile: async () => {},
  };
}

export function createProjectValue(
  overrides: Partial<ProjectContextValue> = {},
): ProjectContextValue {
  return {
    projects: [],
    selectedProject: null,
    selectedProjectId: "",
    hasSelectedProject: false,
    canManageSelected: false,
    isSwitcherEnabled: true,
    isLoading: false,
    errorMessage: null,
    setSelectedProjectId: () => {},
    reloadProjects: async () => {},
    ...overrides,
  };
}

export type RecordedToast = { variant: ToastVariant; message: string };

/** A toast context value that records what the provider would have shown. */
export function recordingToast() {
  const shown: RecordedToast[] = [];
  const value: ToastContextType = {
    toasts: [],
    show: (variant, message) => {
      shown.push({ variant, message });
      return `toast-${shown.length}`;
    },
    info: (message) => value.show("info", message),
    success: (message) => value.show("success", message),
    warning: (message) => value.show("warning", message),
    error: (message) => value.show("error", message),
    dismiss: () => {},
    dismissAll: () => {},
  };

  return { value, shown };
}

export function BuddyTestProviders({
  children,
  profileId = TEST_USER_ID,
  projectValue,
  toastValue,
}: {
  children: ReactNode;
  profileId?: string | null;
  projectValue?: ProjectContextValue;
  toastValue?: ToastContextType;
}) {
  return (
    <AuthContext.Provider value={createAuthValue(profileId)}>
      <ProjectContext.Provider value={projectValue ?? createProjectValue()}>
        {toastValue ? (
          <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
        ) : (
          children
        )}
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
}

/**
 * The full wrapper for anything that reads the one buddy session — the three provider stubs
 * above plus [BuddyProvider] itself, which is what publishes the session.
 */
export function BuddyProviderWithStubs({ children }: { children: ReactNode }) {
  return (
    <BuddyTestProviders>
      <BuddyProvider>{children}</BuddyProvider>
    </BuddyTestProviders>
  );
}
