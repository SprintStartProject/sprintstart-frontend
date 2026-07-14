import { useCallback, useEffect, useMemo, useState } from "react";
import {
  projectService,
  type AdminProject,
} from "../../services/projectService";

const PROJECT_SELECTION_STORAGE_KEY = "sprintstart:selected-project-id";

type UseProjectSelectionOptions = {
  enabled?: boolean;
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
      const nextProjects = await projectService.getProjects();
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
  }, [enabled]);

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
