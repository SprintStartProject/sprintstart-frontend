/**
 * The subtitle: what is known, never one figure standing for all of it.
 *
 * Counts are named by *how* they were established precisely so they cannot be read as a single
 * score. When everything is settled there is nothing left to count, so it says so instead.
 */
export function summarise({
  observed,
  declared,
  outstanding,
}: {
  observed: number;
  declared: number;
  outstanding: number;
}): string {
  if (outstanding === 0) {
    return "Nothing outstanding";
  }

  const settled = [
    observed > 0 ? `${observed} confirmed` : null,
    declared > 0 ? `${declared} you told us about` : null,
  ].filter(Boolean);

  return [`${outstanding} still to do`, ...settled].join(" · ");
}
