// Shared display formatters for the FAQ feature.
// Per-feature, matching the knowledge-gaps and chatbot features, rather than a
// shared date module the app doesn't have.

/**
 * Formats an ISO timestamp as an approximate "time ago" string
 * (e.g. "just now", "12 minutes ago", "3 hours ago", "5 days ago").
 *
 * A recurring question's exact minute is never the point — what a PM reads off
 * it is whether the topic is still alive — but the hours matter right after
 * someone asks something, which is exactly when they might be looking.
 */
export function formatAskedAt(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  // Past a day, compare calendar days rather than elapsed 24h windows, so two
  // questions asked on the same afternoon read the same.
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
