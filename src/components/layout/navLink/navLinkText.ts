type EntryStatus = {
  busy: boolean;
  busyLabel?: string;
  count: number;
  countLabel?: (count: number) => string;
  needsAttention: boolean;
  attentionLabel?: string;
};

/**
 * One marker language for the whole sidebar: an entry with work waiting behind it has an amber icon
 * that stirs every few seconds, whether what is waiting is countable or not.
 *
 * Derived rather than asked of the caller so the two cannot come apart. A number in the trailing slot
 * already means "there is something here" — an entry that shows one and stays grey is the same entry
 * disagreeing with itself, and every caller passing a count would otherwise have to remember to raise
 * the flag as well.
 */
export function needsAttentionOf(hasAttentionMarker: boolean, count: number): boolean {
  return hasAttentionMarker || count > 0;
}

/** What an entry's count is called, for a screen reader and the folded tooltip. */
export function countText(count: number, countLabel?: (count: number) => string): string {
  return countLabel?.(count) ?? `${count} waiting`;
}

/**
 * The second line of the folded rail's tooltip: busy, else the count, else the attention note, else
 * nothing. One status at a time, in that order of importance.
 */
export function statusDetail(status: EntryStatus): string | null {
  if (status.busy) return status.busyLabel ?? "In progress";
  if (status.count > 0) return countText(status.count, status.countLabel);
  if (status.needsAttention) return status.attentionLabel ?? "Needs attention";
  return null;
}
