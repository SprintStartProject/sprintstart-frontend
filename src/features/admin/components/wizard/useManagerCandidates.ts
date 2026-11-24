import { useCallback, useEffect, useState } from "react";
import { projectService, type ProjectManager } from "../../../../services/projectService";

type ManagerCandidates = {
  candidates: ProjectManager[];
  /**
   * Starts true so the manager picker reads "Loading candidates..." on first paint instead of
   * flashing "No candidates available" before the fetch begins.
   */
  isLoading: boolean;
  error: string;
};

/** Loads the people who can manage the new project each time the wizard opens. */
export function useManagerCandidates(isOpen: boolean): ManagerCandidates {
  const [candidates, setCandidates] = useState<ProjectManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setCandidates(await projectService.getManagerCandidates());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Manager candidates could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Deferred so the fetch is not a synchronous state update inside the
    // effect body, which `react-hooks/set-state-in-effect` rejects.
    void Promise.resolve().then(load);
  }, [isOpen, load]);

  return { candidates, isLoading, error };
}
