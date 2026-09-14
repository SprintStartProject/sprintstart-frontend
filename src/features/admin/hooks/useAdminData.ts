import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUserService } from "../../../services/adminUserService";
import { projectService } from "../../../services/projectService";
import { queryKeys } from "../../../services/queryKeys";
import { enrichUsersWithProjectNames, getAvailableProjects } from "../data";
import { useGithubTokens } from "../../settings/hooks/useGithubTokens";
import type { AdminUser, LoadingState, ProjectOverview } from "../types";

type AdminOverview = {
  users: AdminUser[];
  projects: ProjectOverview[];
};

const EMPTY_USERS: AdminUser[] = [];
const EMPTY_PROJECTS: ProjectOverview[] = [];

type UseAdminDataResult = {
  users: AdminUser[];
  setUsers: (update: SetStateAction<AdminUser[]>) => void;
  projects: ProjectOverview[];
  setProjects: (update: SetStateAction<ProjectOverview[]>) => void;
  selectedUser: AdminUser | null;
  setSelectedUser: Dispatch<SetStateAction<AdminUser | null>>;
  selectedProject: ProjectOverview | null;
  setSelectedProject: Dispatch<SetStateAction<ProjectOverview | null>>;
  loadingState: LoadingState;
  errorMessage: string;
  isRefreshing: boolean;
  refreshAdminData: () => Promise<void>;
  tokenNames: string[];
  tokensLoaded: boolean;
  loadTokenNames: () => Promise<void>;
};

/**
 * Users and projects load together and stay together: a project update
 * patches the handful of affected users' `projects` field directly (see
 * `AdminPage.handleProjectUpdated`) without touching their `projectIds`, so a
 * derivation re-run from `projectIds` on every render would immediately
 * overwrite that patch with stale data. One cache entry, mutated ad hoc via
 * `setUsers`/`setProjects`, is what the original hand-rolled state did and
 * what this preserves.
 */
export function useAdminData(): UseAdminDataResult {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.admin.overview();

  const { data, status, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<AdminOverview> => {
      const [nextUsers, nextProjects] = await Promise.all([
        adminUserService.getUsers(),
        projectService.getProjects(),
      ]);
      const nextProjectSummaries = getAvailableProjects(nextProjects);

      return {
        users: enrichUsersWithProjectNames(nextUsers, nextProjectSummaries),
        projects: nextProjects,
      };
    },
  });

  const users = data?.users ?? EMPTY_USERS;
  const projects = data?.projects ?? EMPTY_PROJECTS;

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectOverview | null>(null);

  // Re-resolves the drawer's selection against a fresh load, the same way the
  // old `loadAdminData` did inline on every successful fetch — a stale
  // reference from before a refresh should not go on being shown. Deferred to
  // a microtask so these setState calls don't run synchronously in the effect
  // body (React's cascading-render guard).
  useEffect(() => {
    if (!data) return;
    void Promise.resolve().then(() => {
      setSelectedUser((current) =>
        current ? (data.users.find((user) => user.id === current.id) ?? current) : null,
      );
      setSelectedProject((current) =>
        current ? (data.projects.find((project) => project.id === current.id) ?? current) : null,
      );
    });
  }, [data]);

  const setUsers = useCallback(
    (update: SetStateAction<AdminUser[]>) => {
      queryClient.setQueryData(queryKey, (prev: AdminOverview | undefined) => {
        if (!prev) return prev;
        const nextUsers = typeof update === "function" ? update(prev.users) : update;
        return { ...prev, users: nextUsers };
      });

      // The dashboard's user overview widget reads the raw `admin.users()` query
      // independently of this overview. Removed rather than patched: a project
      // update only touches these users' `projects` field here, not their
      // authoritative `projectIds`, so copying this overview's value over would
      // leave that query's assignment data wrong.
      queryClient.removeQueries({ queryKey: queryKeys.admin.users() });
    },
    [queryClient, queryKey],
  );

  const setProjects = useCallback(
    (update: SetStateAction<ProjectOverview[]>) => {
      queryClient.setQueryData(queryKey, (prev: AdminOverview | undefined) => {
        if (!prev) return prev;
        const nextProjects = typeof update === "function" ? update(prev.projects) : update;
        return { ...prev, projects: nextProjects };
      });
    },
    [queryClient, queryKey],
  );

  // Shares its cache entry with the user-settings PAT list — see
  // `useGithubTokens` — so visiting either section saves the other the round trip.
  const { tokenNames, tokensLoaded, loadTokenNames } = useGithubTokens();

  const loadingState: LoadingState = status === "pending" ? "loading" : status;

  return {
    users,
    setUsers,
    projects,
    setProjects,
    selectedUser,
    setSelectedUser,
    selectedProject,
    setSelectedProject,
    loadingState,
    errorMessage: error
      ? error instanceof Error
        ? error.message
        : "Admin data could not be loaded."
      : "",
    // Excludes the very first load, which `loadingState` already covers with
    // its own full-page state — this is only for a refresh of data already on
    // screen (or another attempt after an error).
    isRefreshing: isFetching && status !== "pending",
    refreshAdminData: async () => {
      await refetch();
    },
    tokenNames,
    tokensLoaded,
    loadTokenNames,
  };
}
