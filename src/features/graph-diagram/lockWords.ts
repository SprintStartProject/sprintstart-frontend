/**
 * How this product talks about one thing standing in front of another.
 *
 * There is one relation — X cannot start until Y is finished — and a hire meets it on three
 * surfaces in one afternoon: as an arrow on the Blueprint their PM drew, as a line on a board card,
 * and as an arrow again in the picture of their own run. It was described in three different
 * vocabularies, each reasonable on its own: "must be finished before", "waits on", "after". Three
 * words for one thing is three things, as far as somebody learning the product is concerned.
 *
 * So the sentences live here, once. Not because wording is fiddly to repeat, but because the moment
 * one surface reworded its own copy the product would be quietly teaching two ideas again.
 */

/** The sentence a legend uses to say what an arrow means. */
export const LOCK_SENTENCE =
  "An arrow is a lock: what it points at stays closed until the other is finished.";

/** What a card or node says about the one thing standing in front of it. */
export function lockedAfter(name: string): string {
  return `After: ${name}`;
}

/** Said of a lock the team wrote, which the hire does not get to take off. */
export function teamLockSaid(name: string | null): string {
  return `Your team put this after ${name ?? "another card"}. It stays.`;
}

/** Said of a sequence the buddy proposed, which the hire may change. */
export function buddyLockSaid(name: string): string {
  return `Your buddy put this after ${name}. You can change it.`;
}

/**
 * What finishing this one would open up, or null when it would open nothing.
 *
 * Counts only what this card alone is holding — the same rule the "start here" line follows. A card
 * that would still be blocked by something else afterwards has not been freed by finishing this
 * one, and counting it would make the sentence promise more than the work delivers.
 */
export function unblocksSaid(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "Finishing this frees 1 card" : `Finishing this frees ${count} cards`;
}
