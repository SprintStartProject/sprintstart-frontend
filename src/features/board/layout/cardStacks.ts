import { cardName } from "./cardNames";
import type { BoardCard, BoardCardKind } from "../types";
import type { CardState } from "./boardStructure";

/**
 * Cards that have to be worked in order, shown as one card with the rest behind it.
 *
 * Dependencies fixed the wrong half of the problem on their own. A chain of six told the hire
 * exactly what to do first — and still put six cards on the board, five of them greyed out and
 * unusable, which is *more* to look past than six ordinary cards, not less. The information was
 * right and the quantity was untouched.
 *
 * A stack is the same claim taking the room of one card. The top of it is the one card in the chain
 * that is actually theirs to do now; the rest are behind it, counted, one click away. Ticking the
 * top one off does not "advance" anything — the next card simply becomes the first that is not
 * done, which is the same rule stated once rather than a piece of state to keep in step.
 *
 * **Only unambiguous runs stack.** A card that two others wait on is a fork, and a fork is not a
 * sequence: those two are parallel work that happens to share a prerequisite, and stacking them
 * would claim an order nobody asserted. So a run ends where it branches, and the branches stay
 * ordinary cards with the ordinary blocked treatment.
 */
export type CardStack = {
  /**
   * The first card of the chain.
   *
   * The stack's identity, and deliberately not the top card: the top moves as work gets ticked off,
   * and keying "is this stack open" on something that moves would close the stack under the hire at
   * the moment they finished a card.
   */
  rootId: string;
  /** Every card in the chain, in the order they must be worked. */
  memberIds: string[];
  /** The card on top: the first that is not done, or the last one when they all are. */
  topId: string;
  /** How many are still to do, the top one included. */
  remaining: number;
  /**
   * What each member is called and what kind of card it is, keyed by id.
   *
   * Carried on the stack because by the time anything draws a closed pile, its members are *gone*
   * from the card list — folding them away is the whole point of {@link collapseStacks}. Without
   * this the only thing left to say about what is underneath is a number, which is exactly the
   * "there are two more" that made a pile something you had to open to find out whether it was
   * worth opening. The kind rides along for the glyph: a name with the right icon beside it is
   * recognisable a good deal faster than a name on its own.
   */
  members: ReadonlyMap<string, { name: string; kind: BoardCardKind }>;
};

/**
 * The stacks on a board, keyed by *every* member's id.
 *
 * Keyed by member rather than by root so a caller looking at one card can ask "is this in a stack,
 * and is it the top of it" in one lookup, which is the question the grid and the filter both have.
 *
 * A run of one is not a stack and is left out entirely — a single card with nothing behind it is a
 * card, and dressing it as a pile would be chrome asserting something the board does not know.
 *
 * **A run also ends at an area boundary**, which `areaOf` reports. A stack is drawn as one block in
 * one place, and the layout files a block under exactly one area and one stage — so a chain running
 * from a card in "Week one" into a card in "From your team" had no single place to be, and the grid
 * drew it in both: two piles, each labelled with the whole chain's length, each holding half of it.
 * Blueprints made that easy to hit, because a PM's "comes after" routinely points at a card that
 * ended up filed somewhere else. Breaking the run at the boundary keeps every pile whole, and the
 * cards on the far side keep the ordinary blocked treatment, which still says what they wait on.
 */
export function buildStacks(
  cards: BoardCard[],
  states: Map<string, CardState>,
  areaOf: (cardId: string) => string | null = () => null,
): Map<string, CardStack> {
  const byId = new Map(cards.map((card) => [card.id, card]));

  // Who waits on whom. A card may be waited on by several, which is exactly the fork this stops at.
  const successors = new Map<string, string[]>();
  for (const card of cards) {
    const predecessorId = states.get(card.id)?.predecessorId;
    if (!predecessorId || !byId.has(predecessorId)) continue;
    successors.set(predecessorId, [...(successors.get(predecessorId) ?? []), card.id]);
  }

  /** Whether one card may stand directly behind another: same run, and same place on the board. */
  const continues = (cardId: string, predecessorId: string) =>
    byId.has(predecessorId) &&
    (successors.get(predecessorId) ?? []).length === 1 &&
    areaOf(cardId) === areaOf(predecessorId);

  /** Whether a card begins a run rather than continuing somebody else's. */
  const startsRun = (cardId: string) => {
    const predecessorId = states.get(cardId)?.predecessorId;
    if (!predecessorId) return true;

    return !continues(cardId, predecessorId);
  };

  const stacks = new Map<string, CardStack>();

  for (const card of cards) {
    if (!startsRun(card.id)) continue;

    const memberIds = [card.id];
    // Walk while the run stays a run: exactly one card waits on the current one.
    for (;;) {
      const last = memberIds[memberIds.length - 1];
      const next = successors.get(last) ?? [];
      if (next.length !== 1 || !continues(next[0], last)) break;
      memberIds.push(next[0]);
    }

    if (memberIds.length < 2) continue;

    const firstOpen = memberIds.find((id) => states.get(id)?.status !== "DONE");
    const stack: CardStack = {
      rootId: card.id,
      memberIds,
      topId: firstOpen ?? memberIds[memberIds.length - 1],
      remaining: memberIds.filter((id) => states.get(id)?.status !== "DONE").length,
      members: new Map(
        memberIds.flatMap((id) => {
          const member = byId.get(id);

          return member
            ? [[id, { name: cardName(member), kind: member.content.kind }] as const]
            : [];
        }),
      ),
    };

    for (const memberId of memberIds) stacks.set(memberId, stack);
  }

  return stacks;
}

/**
 * The cards to render, with every collapsed stack standing in for its members.
 *
 * Walks the board's own order and emits each stack once, at the position of the first member it
 * meets — the same rule areas follow, so collapsing a stack never moves it. An open stack emits its
 * members consecutively and in working order, which is what makes "open it, look, close it again"
 * read as looking *into* something rather than as the board rearranging itself.
 *
 * A member of a *done* stack is emitted as the top card like any other, so a finished chain stays
 * visible as one ticked card rather than vanishing.
 */
export function collapseStacks(
  cards: BoardCard[],
  stacks: Map<string, CardStack>,
  expandedRootIds: ReadonlySet<string>,
): BoardCard[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const emitted = new Set<string>();
  const shown: BoardCard[] = [];

  for (const card of cards) {
    if (emitted.has(card.id)) continue;

    const stack = stacks.get(card.id);
    if (!stack) {
      shown.push(card);
      continue;
    }

    for (const memberId of stack.memberIds) emitted.add(memberId);

    if (expandedRootIds.has(stack.rootId)) {
      for (const memberId of stack.memberIds) {
        const member = byId.get(memberId);
        if (member) shown.push(member);
      }
      continue;
    }

    // The top card, or the first member that is actually here. A caller may hand this a filtered
    // board — "from your team", one area — and a pile whose top card was filtered out would
    // otherwise take every member with it and show nothing at all.
    const top = byId.get(stack.topId) ?? stack.memberIds.map((id) => byId.get(id)).find(Boolean);
    if (top) shown.push(top);
  }

  return shown;
}
