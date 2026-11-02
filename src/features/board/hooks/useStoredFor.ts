import { useState } from "react";

/**
 * A value read from local storage once per key, and read again whenever the key changes.
 *
 * Derived during render rather than in an effect, the way `SlidingTabPanel` derives its direction:
 * the state has to be right on the render that first shows the board, and reading a key back out of
 * storage is an idempotent read with nothing to synchronise. Local storage is not reactive, so a
 * `storedFor` that changes when the stored arrangement is replaced is what refreshes it.
 *
 * @param storedFor - What the value is stored under: this board, at this revision of its storage.
 * @param read - Reads it back out of storage.
 * @param initial - What it is before the first read.
 */
export function useStoredFor<T>(storedFor: string, read: () => T, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [readFor, setReadFor] = useState<string | null>(null);

  if (storedFor !== readFor) {
    setReadFor(storedFor);
    setValue(read());
  }

  return [value, setValue] as const;
}
