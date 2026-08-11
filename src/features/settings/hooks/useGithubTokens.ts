import { useCallback, useEffect, useRef, useState } from "react";
import { getGithubPatNames } from "../../../services/sources/githubService";

type UseGithubTokensResult = {
  tokenNames: string[];
  tokensLoaded: boolean;
  tokensError: string | null;
  isRefreshing: boolean;
  /** Reloads the token list from the server. Aborts any in-flight request first. */
  loadTokenNames: () => Promise<void>;
};

/**
 * Loads the list of stored GitHub PAT names.
 *
 * Mirrors the slice in `useAdminData` so the user-settings PAT UI behaves
 * identically to the Access Management panel (same global tokens, no backend
 * change). Mutations (add/rotate/delete) are performed by the calling
 * components via `githubService` directly; this hook only owns the list state
 * and its refresh lifecycle.
 *
 * Refresh-safety: each `loadTokenNames` call aborts any in-flight request and
 * tracks a monotonic request id, so a slow stale fetch can never overwrite
 * the result of a newer one (e.g. when the user clicks Refresh while an add
 * is in flight). An unmount aborts any pending request and ignores late
 * resolutions via the mounted ref.
 */
export function useGithubTokens(): UseGithubTokensResult {
  const [tokenNames, setTokenNames] = useState<string[]>([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
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

  const loadTokenNames = useCallback(async () => {
    const id = ++requestIdRef.current;
    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;

    setIsRefreshing(true);
    try {
      const names = await getGithubPatNames(controller.signal);
      if (id === requestIdRef.current && mountedRef.current) {
        setTokenNames(names);
        setTokensLoaded(true);
        setTokensError(null);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (id === requestIdRef.current && mountedRef.current) {
        setTokensLoaded(true);
        setTokensError(error instanceof Error ? error.message : "Failed to load tokens.");
      }
    } finally {
      if (id === requestIdRef.current && mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Initial load. Deferred to a microtask so the synchronous setState
  // inside `loadTokenNames` doesn't fire during the effect body (which
  // triggers the react-hooks/set-state-in-effect lint rule and can cause
  // cascading renders).
  useEffect(() => {
    void Promise.resolve().then(loadTokenNames);
  }, [loadTokenNames]);

  return { tokenNames, tokensLoaded, tokensError, isRefreshing, loadTokenNames };
}
