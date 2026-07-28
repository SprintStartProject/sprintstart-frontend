import { useCallback, useEffect, useRef, useState } from "react";
import { getJiraCredentialsOfUser } from "../../../services/sources/jiraService";
import type { JiraCredentialsDto } from "../../../services/sources/jiraService";

type UseJiraCredentialsResult = {
  credentials: JiraCredentialsDto[];
  loaded: boolean;
  error: string | null;
  isRefreshing: boolean;
  /** Reloads the credential list for the current user. No-op when no email. */
  reload: () => Promise<void>;
};

/**
 * Loads the stored Jira credentials of a single user.
 *
 * Unlike GitHub PATs (which are global — see
 * {@link useGithubTokens}), Jira credentials are keyed per user
 * (`(userEmail, tokenName)`), so this hook takes the owner's email and there is
 * no "list all credentials" endpoint. When `userEmail` is undefined the hook
 * settles into a loaded-empty state instead of fetching, so the UI can show its
 * empty/notice state rather than a spinner.
 *
 * Refresh-safety mirrors {@link useGithubTokens}: each `reload` aborts any
 * in-flight request and tracks a monotonic request id, so a slow stale fetch
 * can never overwrite a newer result. An unmount aborts the pending request and
 * late resolutions are ignored via the mounted ref.
 */
export function useJiraCredentials(
  userEmail: string | undefined,
): UseJiraCredentialsResult {
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
    // Bump the request id first so any earlier in-flight fetch is treated as
    // stale even on the no-email short-circuit.
    const id = ++requestIdRef.current;
    inflightRef.current?.abort();

    if (!userEmail) {
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
      const list = await getJiraCredentialsOfUser(userEmail, controller.signal);
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
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Jira credentials.",
        );
      }
    } finally {
      if (id === requestIdRef.current && mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [userEmail]);

  // Reload whenever the user changes. Deferred to a microtask so the
  // synchronous setState inside `reload` doesn't fire during the effect body
  // (react-hooks/set-state-in-effect), mirroring useGithubTokens.
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  return { credentials, loaded, error, isRefreshing, reload };
}
