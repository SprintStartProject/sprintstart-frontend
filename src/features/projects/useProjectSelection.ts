import { useCallback, useEffect, useMemo, useState } from "react";
import {
  projectService,
  type AdminProject,
} from "../../services/projectService";
import { userService } from "../../services/userService";

const PROJECT_SELECTION_STORAGE_KEY = "sprintstart:selected-project-id";

type UseProjectSelectionOptions = {
  enabled?: boolean;
  // GET /api/v1/admin/projects (the richer listing, including sources/users)
  // is ADMIN-only. Non-admins still need a project id to scope actions like
  // connecting a source, so they're routed to the self-service listing
  // instead -- projects come back with empty sources/users placeholders,
  // since only the admin-gated UI reads those fields.
  isAdmin?: boolean;
};

function readStoredProjectId(): string {
  try {
    return window.localStorage.getItem(PROJECT_SELECTION_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeProjectId(projectId: string) {
  try {
    if (projectId) {
      window.localStorage.setItem(PROJECT_SELECTION_STORAGE_KEY, projectId);
      return;
    }

    window.localStorage.removeItem(PROJECT_SELECTION_STORAGE_KEY);
  } catch {
    // Project selection is a convenience preference. Ignore storage failures.
  }
}

export function useProjectSelection({
  enabled = true,
  isAdmin = false,
}: UseProjectSelectionOptions = {}) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] =
    useState(readStoredProjectId);
  const [isLoading, setIsLoading] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setSelectedProjectId = useCallback((projectId: string) => {
    setSelectedProjectIdState(projectId);
    storeProjectId(projectId);
  }, []);

  const loadProjects = useCallback(async () => {
    if (!enabled) {
      setProjects([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextProjects = isAdmin
        ? await projectService.getProjects()
        : await userService.getMyProjects().then((projects) =>
            projects.map(
              (project): AdminProject => ({
                ...project,
                description: "",
                sources: [],
                users: [],
              }),
            ),
          );
      setProjects(nextProjects);

      setSelectedProjectIdState((currentProjectId) => {
        const hasCurrentProject = nextProjects.some(
          (project) => project.id === currentProjectId,
        );

        const nextProjectId = hasCurrentProject
          ? currentProjectId
          : (nextProjects[0]?.id ?? "");

        storeProjectId(nextProjectId);
        return nextProjectId;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Projects could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, isAdmin]);

  useEffect(() => {
    void Promise.resolve().then(() => loadProjects());
  }, [loadProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  return {
    projects,
    selectedProject,
    selectedProjectId,
    isLoading,
    errorMessage,
    setSelectedProjectId,
    reloadProjects: loadProjects,
  };
}
