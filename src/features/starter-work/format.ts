// Shared display formatters for the starter-work feature.

/**
 * Formats an ISO timestamp as an approximate "time ago" string
 * (e.g. "just now", "12 minutes ago", "3 hours ago", "5 days ago").
 *
 * Used for "updated X ago" on a task's orientation — a PM deciding whether a guide is still worth
 * trusting cares about its age, not its exact minute.
 */
export function formatRelativeDate(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  const now = new Date();
  const then = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const days = Math.round((startToday.getTime() - startThen.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 1) return "yesterday";
  if (days < 30) return plural(days, "day");

  return plural(Math.floor(days / 30), "month");
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}
