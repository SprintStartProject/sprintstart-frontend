import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { projectService } from "../../../services/projectService";
import { applyProjectToUsers } from "./pageRules";
import type { AdminProjectDetails, AdminUser, ProjectOverview } from "../types";

type Args = {
  setUsers: Dispatch<SetStateAction<AdminUser[]>>;
  setProjects: Dispatch<SetStateAction<ProjectOverview[]>>;
  setSelectedUser: Dispatch<SetStateAction<AdminUser | null>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectOverview | null>>;
  /** Reloads the global project switcher. */
  reloadProjects: () => Promise<void> | void;
};

/** What a drawer's edits change on the page: the lists, the open selection and the switcher. */
export function useAdminSync({
  setUsers,
  setProjects,
  setSelectedUser,
  setSelectedProject,
  reloadProjects,
}: Args) {
  const handleProjectCreated = useCallback(() => {
    void projectService.getProjects().then(setProjects);
    // Keep the global project switcher in sync with the new project.
    void reloadProjects();
  }, [reloadProjects, setProjects]);

  const handleProjectDeleted = useCallback(
    (projectId: string) => {
      setProjects((projects) => projects.filter((project) => project.id !== projectId));
      setSelectedProject(null);
      // The deleted project may have been the globally selected one; the provider heals the
      // selection when it reloads.
      void reloadProjects();
    },
    [reloadProjects, setProjects, setSelectedProject],
  );

  const handleProjectUpdated = useCallback(
    (updated: AdminProjectDetails) => {
      setProjects((projects) =>
        projects.map((project) => (project.id === updated.id ? updated : project)),
      );
      setUsers((users) => applyProjectToUsers(users, updated));
      setSelectedProject((current) => (current?.id === updated.id ? updated : current));
    },
    [setProjects, setSelectedProject, setUsers],
  );

  const handleUserUpdated = useCallback(
    (updated: AdminUser) => {
      setUsers((users) => users.map((user) => (user.id === updated.id ? updated : user)));
      setSelectedUser((current) => (current?.id === updated.id ? updated : current));
    },
    [setSelectedUser, setUsers],
  );

  return { handleProjectCreated, handleProjectDeleted, handleProjectUpdated, handleUserUpdated };
}
