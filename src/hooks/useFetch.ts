import { useEffect, useState, type DependencyList } from "react";

/** State produced by {@link useFetch}. */
export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

/**
 * Loads data with an async function on mount and whenever `deps` change,
 * tracking loading/error state so callers don't re-implement the same
 * `useState` + `useEffect` boilerplate.
 *
 * `error` is a boolean flag — the `loader` is responsible for logging the
 * underlying cause (the service layer already logs and falls back to mock
 * data). Results from a superseded call are ignored, so a fast-changing
 * dependency (e.g. a route param) can never apply stale data.
 */
export function useFetch<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await loader();
        if (active) setData(result);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
    // `loader` is intentionally excluded: callers pass a fresh closure each
    // render, so `deps` is the real re-run trigger. This is the standard
    // forwarded-deps pattern for custom data-fetching hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
