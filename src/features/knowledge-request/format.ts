// Display formatters for the knowledge-request (buddy growth loop) feature.

/**
 * How long a question has waited on a person, from its creation to now, as a
 * short human string ("just now", "3h", "2d"). The inbox orders longest-first,
 * so this is the number a PM triages on.
 */
export function formatWaiting(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Whether a question has waited a day or more — the threshold at which a PM should feel it. Kept
 * here (a module function) rather than inline in a component so `Date.now()` isn't called during
 * render, which the purity lint rejects.
 */
export function hasWaitedADay(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() >= 24 * 60 * 60 * 1000;
}

/** An absolute date + time to the minute, for where the exact moment matters. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
