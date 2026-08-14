// Shared display formatters for the FAQ feature.
// Per-feature, matching the knowledge-gaps and chatbot features, rather than a
// shared date module the app doesn't have.

/**
 * Formats an ISO timestamp as a short, approximate "time ago" string
 * (e.g. "Today", "Yesterday", "5d ago", "3mo ago").
 *
 * A recurring question's exact minute is never the point — what a PM reads off
 * it is whether the topic is still alive.
 */
export function formatAskedAt(iso: string): string {
  // Compare calendar days rather than elapsed 24h windows, so two questions
  // asked on the same afternoon both read as "Today".
  const now = new Date();
  const then = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const days = Math.round((startToday.getTime() - startThen.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
