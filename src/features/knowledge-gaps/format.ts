// Shared display formatters for the knowledge-gaps feature.

/**
 * Formats an ISO timestamp as a short, approximate "time ago" string
 * (e.g. "Today", "Yesterday", "5d ago", "3mo ago") for list/overview UIs.
 */
export function formatRelativeDate(iso: string): string {
  // Compare calendar days (not elapsed 24h windows) so this agrees with the
  // absolute date shown on the detail view.
  const days = daysSince(iso);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
