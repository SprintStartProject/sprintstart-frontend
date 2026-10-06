/**
 * Whether the chosen indexed-date window is inverted (start after end).
 *
 * The filter popover flags it in place and the composer refuses to submit on it: the backend
 * validates the range anyway, so blocking here turns a round-trip and a validation error into a
 * correction beside the fields that caused it.
 *
 * Its own module rather than a second export beside the filter components — the fast-refresh
 * lint rule wants component files to export components only.
 */
export function isFilterRangeInvalid(from: string, to: string): boolean {
  return Boolean(from && to && from > to);
}
