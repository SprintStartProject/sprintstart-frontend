/**
 * The board's order, and the one operation that changes it.
 *
 * A reorder replaces the whole order rather than describing a move, which makes *which list* it is
 * computed over the only thing that matters. Expressed over the cards on screen it silently drops
 * everything the current view is hiding; expressed over all of them it is always complete.
 *
 * That used to force a mode: arranging began by clearing the filter and the section so that the
 * shown order and the whole order were the same list. The narrowing was never the problem, though —
 * computing a *position* from a narrowed list was. Naming the card to land next to costs nothing
 * and is exact, so this takes a target id rather than an index and can be handed the full order
 * whatever the hire happens to be looking at.
 */

/**
 * The order that results from putting `movedId` where `targetId` currently is.
 *
 * `ids` is the whole board's order. `targetId` is a card the person can see — the one they dropped
 * on, or the neighbour above the one they stepped past — so however many hidden cards lie between
 * the two, the moved card lands exactly where it was aimed.
 *
 * An id the order does not know, or a card asked to move onto itself, leaves the order alone: the
 * order is the board's own, and guessing at a move nobody can name is worse than not moving.
 */
export function moveTo(ids: string[], movedId: string, targetId: string): string[] {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return ids;

  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, movedId);

  return next;
}
