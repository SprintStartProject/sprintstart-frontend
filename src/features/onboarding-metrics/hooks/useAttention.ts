import { useCallback, useEffect, useState } from "react";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import type { ProjectAttention } from "../types";

type UseAttentionResult = {
  attention: ProjectAttention | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Loads a project's attention list — who is waiting on a review or stalling — for
 * the PM/HR/ADMIN dashboard.
 *
 * The list is composed from the same metrics derivation as everything else on the
 * dashboard, so it stays consistent with the hire's own view. It is a read-only
 * list: acting on it means talking to the person, not clicking something here.
 *
 * @param projectId The selected project, or empty string when none is chosen.
 */
export function useAttention(projectId: string): UseAttentionResult {
  const [attention, setAttention] = useState<ProjectAttention | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setAttention(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setAttention(await onboardingMetricsService.fetchAttention(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the attention list.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Deferred through a microtask so the first setState isn't synchronous in
    // the effect body (React 19 cascading-render guard).
    void (async () => {
      await reload();
    })();
  }, [reload]);

  return { attention, isLoading, error, reload };
}
