import { useEffect, useRef, useState } from "react";

/**
 * Shortest gap between two checks triggered by navigation or by returning to
 * the tab.
 *
 * Without this, clicking quickly through the app would fire the request on
 * every single view. Kept short because a badge turning *on* depends on it:
 * the thing being counted is created on somebody else's device, so a caller
 * cannot learn about it any sooner than its next check.
 *
 * A changed key and a bumped nonce always refetch regardless, since the answer
 * demonstrably changed.
 */
export const MIN_REFRESH_INTERVAL_MS = 5_000;

type RateLimitedReadOptions = {
  /**
   * What the answer is *about* — a project id, typically. A change forces a
   * refetch past the rate limit, and a null key means there is nothing to read.
   */
  key: string | null | undefined;
  /** Whether the caller is allowed to see this at all. */
  enabled: boolean;
  /**
   * Changing this asks for a recheck — callers pass the current route, so
   * switching views refreshes. Rate-limited by {@link MIN_REFRESH_INTERVAL_MS}.
   */
  refreshKey?: string;
  /**
   * Bumped when the caller knows the answer changed (they acted on the very
   * thing being counted). Forces an immediate refetch, like a key change.
   */
  nonce?: number;
};

/**
 * A small read whose answer decorates the shell of the app — a badge, a count,
 * a dot — kept fresh without a subscription and without hammering the backend.
 *
 * Extracted from `usePmAttentionFlag`, which solved this once for the PM
 * dashboard marker. None of the mechanism is specific to that marker, and the
 * pieces that look like ceremony are each a fix for something that actually
 * happened — copying them to serve a second badge is how the two drift apart.
 *
 * Errors are swallowed to [fallback]: a badge is not worth surfacing an error
 * for, and staying quiet beats claiming there is nothing to do.
 *
 * @param read The request. Re-read from a ref, so callers need not memoise it.
 * @param fallback What to report before the first answer, while disabled, and
 * when the read fails.
 */
export function useRateLimitedRead<T>(
  read: () => Promise<T>,
  fallback: T,
  { key, enabled, refreshKey, nonce = 0 }: RateLimitedReadOptions,
): T {
  const [value, setValue] = useState<T>(fallback);
  // Bumped on tab focus. Unlike `nonce` this only *asks* for a check and still
  // respects the rate limit, since nothing is known to have changed.
  const [revalidateNonce, setRevalidateNonce] = useState(0);
  const lastFetch = useRef<{ key: string | null; nonce: number; at: number }>({
    key: null,
    nonce: -1,
    at: 0,
  });

  // Held in a ref rather than a dependency: `read` is a closure the caller
  // rebuilds every render, so depending on it would refetch on every render and
  // make the rate limit the only thing standing between us and a request loop.
  //
  // Synced in an effect rather than assigned during render, and declared
  // *before* the fetch below: effects run in declaration order, so by the time
  // the fetch effect reads the ref it already holds this render's closure.
  const readRef = useRef(read);

  useEffect(() => {
    readRef.current = read;
  });

  const isActive = Boolean(enabled && key);

  // Coming back to the tab is the strongest hint that time has passed and the
  // answer may be stale. Costs nothing while the tab sits in the background,
  // unlike a timer, and covers the common "I was in Slack for ten minutes"
  // case that navigation alone never catches.
  useEffect(() => {
    if (!isActive) return;

    const recheck = () => {
      if (document.visibilityState === "visible") {
        setRevalidateNonce((current) => current + 1);
      }
    };

    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !key) return;

    const previous = lastFetch.current;
    // A changed key or a just-handled item is a real change of answer, so
    // neither waits for the rate limit.
    const isForced = previous.key !== key || previous.nonce !== nonce;

    if (!isForced && Date.now() - previous.at < MIN_REFRESH_INTERVAL_MS) {
      return;
    }

    // Claim the slot up front so two effects cannot race into the same request,
    // but remember what to restore if this one never lands.
    const releasedSlot = previous;
    lastFetch.current = { key, nonce, at: Date.now() };

    let active = true;
    let applied = false;

    const run = async () => {
      try {
        const next = await readRef.current();
        if (!active) return;

        applied = true;
        setValue(next);
      } catch {
        if (!active) return;
        applied = true;
        setValue(fallback);
      }
    };

    void run();

    return () => {
      active = false;

      // Hand the slot back when this effect is torn down before its result
      // applied. Without this, React StrictMode's double-invoke discards the
      // first request and then finds the second one rate limited, so the answer
      // never arrives at all -- and the same happens in production whenever a
      // view changes mid-request.
      if (!applied) {
        lastFetch.current = releasedSlot;
      }
    };
    // `fallback` is deliberately absent: it is a constant for any given caller,
    // and depending on it would refetch whenever somebody passed a fresh object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isActive, refreshKey, nonce, revalidateNonce]);

  // Gated on read rather than reset in the effect: somebody who cannot see the
  // thing, or a session with no key, must never be shown a stale answer, and
  // this keeps that rule out of the async path entirely.
  return isActive ? value : fallback;
}
