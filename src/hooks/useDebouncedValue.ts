import { useEffect, useState } from "react";

/**
 * Returns `value` once it has stopped changing for `delayMs` milliseconds.
 *
 * Meant for inputs whose every intermediate state would otherwise cost a request — a search box
 * that queries the server, for example. The caller keeps rendering the live value (so the field
 * never lags behind the keyboard) and hands only the settled one to the expensive consumer.
 *
 * The first render returns `value` unchanged: there is nothing to wait for before anything has
 * been typed, and a deep-linked value must not be held back by a needless delay.
 *
 * @param value The live value, e.g. the current text of an input.
 * @param delayMs How long `value` must stay unchanged before it is returned.
 * @returns The last value that stayed unchanged for `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
