/**
 * Date-range helpers for the Knowledge Base "Updated" filter (last activity: the last content
 * change, or the import date for an artifact that never changed).
 *
 * The backend filters last activity (`lastChangedAt`, else `ingestedAt`)
 * by whole days — `from` inclusive from the start of its day,
 * `to` inclusive to the end of its day — and it cuts those days in UTC. Everything here therefore
 * reasons in UTC calendar days and speaks `yyyy-MM-dd`, the only shape the endpoint accepts.
 */

/** A range as it lives in the URL and the request; either end may be open. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/** A relative preset. It is resolved to absolute dates when picked (see {@link resolvePreset}). */
export interface DateRangePreset {
  id: string;
  label: string;
  /** Calendar days covered, today included. */
  days: number;
}

/** The presets the filter offers, shortest first. */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `value` is a real calendar date in `yyyy-MM-dd` form. `2026-02-30` is well-formed but
 * not a date, and the backend would reject it, so the round trip through `Date` is the check.
 */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/**
 * Today as the server counts days (UTC). Not the local date: for a reader west of UTC the local
 * date can be a day behind, and a `to` of that date would end before "now" and hide the newest
 * artifacts. The UTC day containing now always contains now.
 */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** `iso` moved by `days` calendar days (negative for the past). */
export function shiftIsoDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Resolves a preset to absolute dates at the moment it is picked. Absolute on purpose: the URL
 * records `from=2026-09-18&to=2026-09-24`, so a link shared today shows the same window next week
 * instead of silently sliding along with the calendar.
 */
export function resolvePreset(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const to = todayUtc(now);
  return { from: shiftIsoDate(to, -(preset.days - 1)), to };
}

/** The preset a range is exactly equal to *today*, if any. */
export function matchPreset(range: DateRange, now: Date = new Date()): DateRangePreset | null {
  if (!range.from || !range.to) return null;
  return (
    DATE_RANGE_PRESETS.find((preset) => {
      const resolved = resolvePreset(preset, now);
      return resolved.from === range.from && resolved.to === range.to;
    }) ?? null
  );
}

/**
 * Brings a range into the shape the backend accepts: invalid ends are dropped, and reversed ends
 * are swapped — the backend answers `from > to` with a 400, and a reversed pair is far more likely
 * a slip than a request for nothing.
 */
export function normalizeDateRange(range: DateRange): DateRange {
  const from = isIsoDate(range.from) ? range.from : null;
  const to = isIsoDate(range.to) ? range.to : null;
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

const DISPLAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  // The dates are UTC calendar days; formatting them in the local zone would show the day before
  // for every reader west of UTC.
  timeZone: "UTC",
});

/** `yyyy-MM-dd` for display, in the same style the artifact cards print their dates. */
export function formatIsoDate(iso: string): string {
  return DISPLAY_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

/** Words an active range for its chip: "Updated Sep 1, 2026 – Sep 24, 2026", "Updated since …". */
export function describeDateRange(range: DateRange): string | null {
  const { from, to } = range;
  if (from && to) {
    return from === to
      ? `Updated ${formatIsoDate(from)}`
      : `Updated ${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  }
  if (from) return `Updated since ${formatIsoDate(from)}`;
  if (to) return `Updated until ${formatIsoDate(to)}`;
  return null;
}
