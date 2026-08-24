// Shared display formatters for the knowledge-gaps feature.

/**
 * Formats an ISO timestamp as an approximate "time ago" string
 * (e.g. "just now", "12 minutes ago", "3 hours ago", "5 days ago").
 *
 * Everything reads as an age, including today. "Today" answered the wrong
 * question after an ingestion run: a PM watching one finish wants to know
 * whether it was minutes or hours ago, and "Today" says neither.
 */
export function formatRelativeDate(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  // Past a day, switch to calendar days so this agrees with the absolute date
  // shown on the detail view rather than drifting by the time of day.
  const days = daysSince(iso);
  if (days <= 1) return "yesterday";
  if (days < 30) return plural(days, "day");

  return plural(Math.floor(days / 30), "month");
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * Whole calendar days between the given ISO timestamp and today.
 */
export function daysSince(iso: string): number {
  const now = new Date();
  const then = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.round((startToday.getTime() - startThen.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formats an ISO timestamp as an absolute date and time to the minute
 * (e.g. "05 Jul 2026, 14:32"), for places where the exact moment matters.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats an ISO timestamp as an absolute date (e.g. "05 Jul 2026") for the
 * detail view, where the exact day matters.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
