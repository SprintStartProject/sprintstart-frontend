import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

/** How often an open, visible panel re-reads its data on its own. */
const DEFAULT_INTERVAL_MS = 30_000;
/** Smallest gap between two loads, whatever triggered them. */
const DEFAULT_MIN_INTERVAL_MS = 10_000;

export interface UseLiveFetchOptions {
  /** Polling cadence while the tab is visible. `0` polls only on focus. */
  intervalMs?: number;
  /**
   * Throttle floor. Alt-tabbing repeatedly fires a focus event each time, and
   * without this each one would be a request.
   */
  minIntervalMs?: number;
  /** Skip loading entirely, e.g. before a project has been selected. */
  enabled?: boolean;
}

export interface UseLiveFetchResult<T> {
  data: T | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  /** True while refreshing data that is already on screen. */
  revalidating: boolean;
  error: boolean;
  /** Reload now, ignoring the throttle. For an explicit user action. */
  refresh: () => void;
}

/**
 * Loads data and keeps it current without the user reloading the page.
 *
 * The difference to {@link import("./useFetch").useFetch} is what happens on a
 * *re*-load: the data already on screen stays there and only `revalidating`
 * flips, so a panel that refreshes itself every 30 seconds doesn't blink
 * through a spinner every 30 seconds. For the same reason a failed background
 * reload does not raise `error` — the last good data is a better thing to show
 * than an error state, and the next attempt is seconds away. Only the first
 * load, which has nothing to fall back on, reports failure.
 *
 * Reloads are triggered by `deps` changing, by the tab regaining focus or
 * visibility, and by an interval while the tab is visible. Hidden tabs are left
 * alone: nobody is reading them, and polling them costs the backend real work
 * for nothing.
 */
export function useLiveFetch<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: UseLiveFetchOptions = {},
): UseLiveFetchResult<T> {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState(false);

  // Callers pass a fresh closure every render; the timers and listeners below
  // outlive a render, so they have to reach the current one through a ref.
  const loaderRef = useRef(loader);
  // Declared before the loading effect on purpose: effects run in declaration
  // order, so the ref is current by the time that one calls through it.
  useEffect(() => {
    loaderRef.current = loader;
  });

  // Bumped whenever `deps` change. A load that was already running when they
  // did belongs to the previous inputs — the project switcher is the case that
  // matters — and its result must not be applied.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const lastLoadAt = useRef(0);
  // Identifies each load. A superseded one must not clear `inFlight` on its way
  // out — the load that replaced it is still running behind it.
  const loadSeq = useRef(0);

  const load = useCallback(async (isFirstLoad: boolean) => {
    if (inFlight.current) return;

    inFlight.current = true;
    lastLoadAt.current = Date.now();
    const startedAt = generation.current;
    const myLoad = ++loadSeq.current;
    const releaseIfMine = () => {
      if (loadSeq.current === myLoad) inFlight.current = false;
    };

    // Yielding first keeps every state update below out of the caller's
    // synchronous frame. The deps effect calls straight into here, and a
    // setState in an effect's own frame is a cascading render.
    await Promise.resolve();
    if (generation.current !== startedAt) {
      // The deps changed before this even reached the network — no request at
      // all is the right outcome, not a request whose answer gets discarded.
      releaseIfMine();
      return;
    }

    if (isFirstLoad) {
      setLoading(true);
      // Cleared rather than kept: after switching projects the previous
      // project's questions on screen would be wrong, not merely stale.
      setData(null);
      setError(false);
    } else {
      setRevalidating(true);
    }

    try {
      const result = await loaderRef.current();
      if (generation.current !== startedAt) return;
      setData(result);
      setError(false);
    } catch {
      if (generation.current !== startedAt) return;
      if (isFirstLoad) setError(true);
    } finally {
      releaseIfMine();
      if (generation.current === startedAt) {
        setLoading(false);
        setRevalidating(false);
      }
    }
  }, []);

  const revalidate = useCallback(() => {
    if (Date.now() - lastLoadAt.current < minIntervalMs) return;
    void load(false);
  }, [load, minIntervalMs]);

  const refresh = useCallback(() => {
    lastLoadAt.current = 0;
    void load(false);
  }, [load]);

  useEffect(() => {
    generation.current += 1;
    // Reset before loading: a call still running belongs to the previous deps,
    // and it must not block the one that replaces it.
    inFlight.current = false;
    if (!enabled) return;
    // The lint rule guards against cascading renders from a setState in the
    // effect's own frame. This one isn't: `load` yields before it touches any
    // state, so every update happens in a later microtask. Fetching on a
    // dependency change is the "subscribe to an external system" case the rule
    // itself describes as what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
    // `loader` is intentionally excluded: callers pass a fresh closure each
    // render, so `deps` is the real re-run trigger. This is the standard
    // forwarded-deps pattern for custom data-fetching hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, load]);

  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, revalidate]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") revalidate();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, revalidate]);

  // Derived rather than stored: a disabled hook never loads, so reporting it
  // as loading would leave a caller spinning forever on a wait that isn't
  // happening.
  return { data, loading: enabled && loading, revalidating, error, refresh };
}
