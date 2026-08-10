import { useCallback, useEffect, useState } from "react";
import { adminUserService } from "../../../services/adminUserService";
import { projectService } from "../../../services/projectService";
import { getGithubPatNames } from "../../../services/sources/githubService";
import { enrichUsersWithProjectNames, getAvailableProjects } from "../data";
import type { AdminUser, LoadingState, ProjectOverview } from "../types";

export function useAdminData() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<ProjectOverview[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectOverview | null>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tokenNames, setTokenNames] = useState<string[]>([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      const [nextUsers, nextProjects] = await Promise.all([
        adminUserService.getUsers(),
        projectService.getProjects(),
      ]);
      const nextProjectSummaries = getAvailableProjects(nextProjects);
      const nextEnrichedUsers = enrichUsersWithProjectNames(nextUsers, nextProjectSummaries);

      setUsers(nextEnrichedUsers);
      setProjects(nextProjects);
      setLoadingState("success");

      setSelectedUser((currentSelectedUser) => {
        if (!currentSelectedUser) return null;

        return (
          nextEnrichedUsers.find((user) => user.id === currentSelectedUser.id) ??
          currentSelectedUser
        );
      });

      setSelectedProject((currentSelectedProject) => {
        if (!currentSelectedProject) return null;

        return (
          nextProjects.find((project) => project.id === currentSelectedProject.id) ??
          currentSelectedProject
        );
      });
    } catch (error) {
      setLoadingState("error");
      setErrorMessage(error instanceof Error ? error.message : "Admin data could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAdminData);
  }, [loadAdminData]);

  const refreshAdminData = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadAdminData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAdminData]);

  const loadTokenNames = useCallback(async () => {
    try {
      const names = await getGithubPatNames();
      setTokenNames(names);
      setTokensLoaded(true);
    } catch {
      setTokensLoaded(true);
    }
  }, []);

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
    errorMessage,
    isRefreshing,
    refreshAdminData,
    tokenNames,
    tokensLoaded,
    loadTokenNames,
  };
}
