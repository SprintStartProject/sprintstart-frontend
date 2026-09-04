import { useCallback, useEffect, useState } from "react";
import { starterWorkService } from "../../../services/starterWorkService";
import type { StarterWorkTask } from "../types";

type ReloadOptions = {
  /** Keep the existing cards visible while an action refreshes the pool in the background. */
  preserveContent?: boolean;
};

/**
 * Loads the live starter-work pool for the compact overview surface.
 *
 * Kept separate from the review hook because the two collections have different meanings:
 * unreviewed tasks are the PM's queue, while the pool also contains the tasks somebody already
 * vouched for. Callers can reload after a review, removal or manual promotion so both surfaces stay
 * in sync without coupling their local state.
 */
export function useStarterWorkPool() {
  const [pool, setPool] = useState<StarterWorkTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (options?: ReloadOptions) => {
    if (!options?.preserveContent) setIsLoading(true);
    setError(null);
    try {
      setPool(await starterWorkService.fetchPool());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the starter-work pool.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload]);

  return { pool, isLoading, error, reload };
}
