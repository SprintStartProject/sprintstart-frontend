/**
 * Formatting for the metrics readout. Durations read as plain elapsed time; a
 * missing moment reads as "—", never as zero — an unreached milestone is not a
 * milestone reached instantly.
 */

/** "5h" / "3d" / "2d 4h" from a count of hours; null → "—". */
export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

/** A short absolute date ("14 Jul") for a moment; null → "—". */
export function formatMoment(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Whole hours between now and a past timestamp; null when the timestamp is null. */
export function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

/** "today" / "yesterday" / "3 days ago" from a count of days. */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
