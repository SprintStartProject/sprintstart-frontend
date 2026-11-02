import { useMemo, useState } from "react";
import type { BoardCard } from "../types";
import { assignToGroup, groupOf, type BoardGroup } from "../layout/boardGroups";
import { markSectionColor, markedIn } from "../layout/boardSections";
import type { CardState } from "../layout/boardStructure";
import { buildStacks, type CardStack } from "../layout/cardStacks";
import type { CardMarks } from "../marks/cardMarks";

/** Every pile's root id -- what "open all of them" means. */
function allRootIds(stacks: Map<string, { rootId: string }>): Set<string> {
  return new Set([...stacks.values()].map((stack) => stack.rootId));
}

type Params = {
  allCards: BoardCard[];
  groups: BoardGroup[];
  saveGroups: (next: BoardGroup[]) => void;
  states: Map<string, CardState>;
  pinnedIds: ReadonlySet<string>;
  isArranging: boolean;
  /** The section being shown, so a pile holding the colour being shown is held open. */
  shownSectionId: string | null;
  cardMarks: CardMarks;
  /** Records "this card goes under that one", in the board's structure. */
  stackOnto: (cardId: string, targetId: string | null, carry?: readonly string[]) => void;
};

/**
 * The piles on this board, and which of them are spread out.
 *
 * A pile is cards the hire put one under another with the "Pile" control. It is drawn as its top
 * card with the others fanned beneath, and opens on a click. A pile only forms inside one area, so
 * piling a card under one in another area takes it into that area too.
 *
 * Which piles are open is kept for the visit rather than stored: opening one is looking into it, not
 * rearranging the board.
 */
export function useBoardPiles(params: Params) {
  const { allCards, groups, states, pinnedIds, isArranging, shownSectionId, cardMarks } = params;
  const stacks = useMemo(
    () => buildStacks(allCards, states, (cardId) => groupOf(groups, cardId)?.id ?? null, pinnedIds),
    [allCards, groups, pinnedIds, states],
  );
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(new Set());

  /** Every pile spread out while the board is being arranged, so each card can be moved. */
  const openStackIds = useMemo(
    () => (isArranging ? allRootIds(stacks) : expandedStackIds),
    [expandedStackIds, isArranging, stacks],
  );

  /**
   * Piles opened because the colour picked on the right is on a card inside them.
   *
   * A closed pile shows only its top card, so filtering by a colour that sits on the second card
   * showed nothing at all -- the filter's count said there was one, and the board said there was
   * none. Such a pile is spread out for as long as the colour is picked.
   */
  const heldOpenByMarks = useMemo(
    () => pilesHoldingColour(stacks, allCards, cardMarks, shownSectionId),
    [allCards, cardMarks, shownSectionId, stacks],
  );
  const visibleStackIds = useMemo(
    () =>
      heldOpenByMarks.size === 0 ? openStackIds : new Set([...openStackIds, ...heldOpenByMarks]),
    [heldOpenByMarks, openStackIds],
  );

  function toggleStack(rootId: string) {
    setExpandedStackIds((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);

      return next;
    });
  }

  /**
   * The grid's open-and-close, minus the piles the colour filter holds open: folding one of those
   * from outside it would only hide the highlight the filter is there to show.
   */
  function toggleVisibleStack(rootId: string) {
    if (heldOpenByMarks.has(rootId) && !openStackIds.has(rootId)) return;
    toggleStack(rootId);
  }

  /**
   * Piles a card under another one, and into that card's area so the two can lie together.
   *
   * `carry` is a whole closed pile being moved -- every card of it goes along, area included.
   */
  function handleStackOnto(cardId: string, targetId: string | null, carry?: readonly string[]) {
    params.stackOnto(cardId, targetId, carry);
    if (!targetId) return;

    const area = groupOf(groups, targetId)?.id ?? null;
    let next = groups;
    for (const id of carry ?? [cardId]) {
      if ((groupOf(next, id)?.id ?? null) !== area) next = assignToGroup(next, id, area);
    }
    if (next !== groups) params.saveGroups(next);
  }

  return {
    stacks,
    visibleStackIds,
    toggleVisibleStack,
    handleStackOnto,
    /** Spreads every pile out. */
    openAllPiles: () => setExpandedStackIds(allRootIds(stacks)),
  };
}

function pilesHoldingColour(
  stacks: Map<string, CardStack>,
  allCards: BoardCard[],
  cardMarks: CardMarks,
  shownSectionId: string | null,
): Set<string> {
  const color = markSectionColor(shownSectionId);
  if (!color) return new Set<string>();

  const hits = new Set(markedIn(allCards, cardMarks, color).map((card) => card.id));
  const roots = new Set<string>();
  for (const stack of stacks.values()) {
    if (stack.memberIds.some((id) => hits.has(id))) roots.add(stack.rootId);
  }
  return roots;
}
