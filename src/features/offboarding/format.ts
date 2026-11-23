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
