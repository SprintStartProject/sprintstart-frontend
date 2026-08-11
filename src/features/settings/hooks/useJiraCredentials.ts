import { useCallback, useEffect, useRef, useState } from "react";
import { getMyJiraCredentials } from "../../../services/sources/jiraService";
import type { JiraCredentialsDto } from "../../../services/sources/jiraService";

type UseJiraCredentialsResult = {
  credentials: JiraCredentialsDto[];
  loaded: boolean;
  error: string | null;
  isRefreshing: boolean;
  /** Reloads the authenticated user's credential list. */
  reload: () => Promise<void>;
};

/**
 * Loads the Jira credentials owned by the authenticated user.
 *
 * When disabled, the hook settles into a loaded-empty state without fetching.
 * Reloads abort any in-flight request so stale data cannot win a race.
 */
export function useJiraCredentials(enabled = true): UseJiraCredentialsResult {
  const [credentials, setCredentials] = useState<JiraCredentialsDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const requestIdRef = useRef(0);
  const inflightRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inflightRef.current?.abort();
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++requestIdRef.current;
    inflightRef.current?.abort();

    if (!enabled) {
      if (mountedRef.current) {
        setCredentials([]);
        setLoaded(true);
        setError(null);
        setIsRefreshing(false);
      }
      return;
    }

    const controller = new AbortController();
    inflightRef.current = controller;

    setIsRefreshing(true);
    try {
      const list = await getMyJiraCredentials(controller.signal);
      if (id === requestIdRef.current && mountedRef.current) {
        setCredentials(list);
        setLoaded(true);
        setError(null);
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      if (id === requestIdRef.current && mountedRef.current) {
        setLoaded(true);
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load Jira credentials.",
        );
      }
    } finally {
      if (id === requestIdRef.current && mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  return { credentials, loaded, error, isRefreshing, reload };
}
