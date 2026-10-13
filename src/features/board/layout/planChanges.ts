import type { BoardDocument } from "../sync/boardDocument";

/**
 * What planning can change, as it stood when planning began: the arrangement and the card order.
 *
 * Origins, marks and their labels are left out on purpose. They are written while reading, not
 * while planning, and putting them back on Cancel would undo a highlight made somewhere else.
 */
export type PlanSnapshot = {
  document: BoardDocument;
  order: string[];
};

/** Everything a single card's place on the board is made of, as one comparable string. */
function cardShape(document: BoardDocument, order: readonly string[], cardId: string): string {
  const group = document.groups.find((candidate) => candidate.cardIds.includes(cardId));

  return JSON.stringify([
    document.cards[cardId] ?? null,
    document.pinnedCardIds.includes(cardId),
    document.collapsedCardIds.includes(cardId),
    document.sizes[cardId] ?? null,
    group?.id ?? null,
    order.includes(cardId),
  ]);
}

/**
 * The cards that were moved out of order, as the fewest moves that explain the new order.
 *
 * Comparing positions one by one would count every card a moved one pushed down: drag one card to
 * the top of ten and nine "changes" appear. The cards that kept their order relative to each other
 * are the longest run that still increases in the old order; everything else was moved.
 */
function movedCards(before: readonly string[], after: readonly string[]): Set<string> {
  const oldIndex = new Map(before.map((id, index) => [id, index]));
  const kept = after.filter((id) => oldIndex.has(id));
  const indices = kept.map((id) => oldIndex.get(id) ?? 0);

  // Longest increasing subsequence, O(n²) — a board is tens of cards, not thousands.
  const length = indices.map(() => 1);
  const previous = indices.map(() => -1);
  let best = -1;
  indices.forEach((value, i) => {
    for (let j = 0; j < i; j += 1) {
      if (indices[j] < value && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
    if (best === -1 || length[i] > length[best]) best = i;
  });

  const stayed = new Set<string>();
  for (let i = best; i !== -1; i = previous[i]) stayed.add(kept[i]);

  return new Set(kept.filter((id) => !stayed.has(id)));
}

/** An area as somebody would notice it changing: its name, its colour and whether it is folded. */
function areaShape(document: BoardDocument, groupId: string): string {
  const group = document.groups.find((candidate) => candidate.id === groupId);

  return group ? JSON.stringify([group.name, group.accent ?? null, group.collapsed]) : "";
}

/**
 * How many things planning has changed since it began: each card whose place differs, and each
 * area made, removed, renamed or recoloured.
 *
 * A card counts once however much about it changed — moved, piled and pinned is still one card
 * somebody touched.
 */
export function countPlanChanges(
  start: PlanSnapshot,
  document: BoardDocument,
  order: readonly string[],
): number {
  const moved = movedCards(start.order, order);
  const cardIds = new Set([...start.order, ...order]);

  let changes = 0;
  for (const cardId of cardIds) {
    if (
      moved.has(cardId) ||
      cardShape(start.document, start.order, cardId) !== cardShape(document, order, cardId)
    ) {
      changes += 1;
    }
  }

  const groupIds = new Set([
    ...start.document.groups.map((group) => group.id),
    ...document.groups.map((group) => group.id),
  ]);
  for (const groupId of groupIds) {
    if (areaShape(start.document, groupId) !== areaShape(document, groupId)) changes += 1;
  }

  return changes;
}

/**
 * The document to write back on Cancel: the arrangement from when planning began, with what
 * planning does not own (origins, marks, labels) kept as it is now.
 */
export function revertedDocument(start: PlanSnapshot, current: BoardDocument): BoardDocument {
  return {
    ...current,
    cards: start.document.cards,
    groupStages: start.document.groupStages,
    groups: start.document.groups,
    collapsedCardIds: start.document.collapsedCardIds,
    pinnedCardIds: start.document.pinnedCardIds,
    sizes: start.document.sizes,
  };
}

/**
 * The order to send back on Cancel: the old order for every card still on the board, and any card
 * that arrived since kept after them rather than dropped.
 */
export function revertedOrder(start: PlanSnapshot, current: readonly string[]): string[] {
  const present = new Set(current);
  const known = new Set(start.order);

  return [
    ...start.order.filter((id) => present.has(id)),
    ...current.filter((id) => !known.has(id)),
  ];
}

/** Whether two orders are the same, so Cancel does not send a reorder that changes nothing. */
export function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
