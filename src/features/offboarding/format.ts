/** A score from 0 to 1 as a percentage. */
export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** The share of each kind of evidence the leaving people hold, such as `commits 50% · reviews 75%`. */
export function describeBreakdown(breakdown: Record<string, number>): string {
  return Object.entries(breakdown)
    .map(([source, share]) => `${source} ${percent(share)}`)
    .join(" · ");
}

/** A moment as a short calendar day, such as `1 Nov 2026`. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
