import type { BuddySessionFilters } from "../types";

/**
 * Whether the chosen indexed-date window is inverted (start after end).
 *
 * The filter popover flags it in place and the composer refuses to submit on it: nothing
 * downstream checks the range any more, so blocking here keeps an inverted window from
 * silently matching nothing, and puts the correction beside the fields that caused it.
 *
 * Its own module rather than a second export beside the filter components — the fast-refresh
 * lint rule wants component files to export components only.
 */
export function isFilterRangeInvalid(from: string, to: string): boolean {
  return Boolean(from && to && from > to);
}

/**
 * Turns a `yyyy-mm-dd` value from a date input into the UTC instant at which that day starts
 * *in the user's timezone*.
 *
 * Sending the raw date makes the AI read it as midnight in the server's timezone, which shifts
 * the boundary by the offset between the two.
 */
export function localDayStart(date: string): string | undefined {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * The counterpart to {@link localDayStart}: the last millisecond of the day in the user's
 * timezone, so the chosen "to" day is included whole.
 *
 * Not clamped to the current time: nothing rejects a bound in the future any more, and today
 * has to stay inside the window.
 */
export function localDayEnd(date: string): string | undefined {
  const parsed = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Maps the composer's filter shape onto the wire shape the backend deserializes.
 *
 * The backend's `BuddySessionFilters` names its fields `source_systems`/`time_from`/`time_to`
 * on the wire, so that is what has to go out. The dates become UTC instants (`...Z`) for the
 * local start and end of the chosen days. A value that is not a date is left out rather than
 * sent. `undefined` for "nothing filtered": an empty object would be a filter object the
 * backend has to interpret; absent is the contract's own "no filters".
 */
export function toWireFilters(filters: BuddySessionFilters) {
  const timeFrom = filters.from ? localDayStart(filters.from) : undefined;
  const timeTo = filters.to ? localDayEnd(filters.to) : undefined;
  if (filters.sourceSystems.length === 0 && !timeFrom && !timeTo) return undefined;
  return {
    ...(filters.sourceSystems.length ? { source_systems: filters.sourceSystems } : {}),
    ...(timeFrom ? { time_from: timeFrom } : {}),
    ...(timeTo ? { time_to: timeTo } : {}),
  };
}
