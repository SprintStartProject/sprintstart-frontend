// Shared display formatters for the chatbot feature.

/**
 * Whole calendar days between the given ISO timestamp and today.
 * Returns 0 (today) for missing or unparseable dates so freshly-created chats
 * whose `createdAt` hasn't been populated yet don't produce NaN.
 */
export function daysSince(iso: string): number {
  if (!iso) return 0;

  const then = new Date(iso);
  if (isNaN(then.getTime())) return 0;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.round((startToday.getTime() - startThen.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Bucket label used to group chats in the sidebar ("Today", "Yesterday",
 * "This week", "Older"). Chats are grouped by calendar day so the grouping
 * agrees with the relative timestamp shown on each item.
 */
export function dateBucketLabel(iso: string): string {
  const days = daysSince(iso);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Older";
}

/**
 * Formats an ISO timestamp as a short, approximate "time ago" string
 * (e.g. "Today", "Yesterday", "5d ago", "3mo ago") for the chat sidebar.
 */
export function formatRelativeDate(iso: string): string {
  const days = daysSince(iso);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
