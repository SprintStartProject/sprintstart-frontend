import type { BoardCard } from "../types";
import type { CardMarks } from "../marks/cardMarks";
import { filterLabel, matchesFilter, type BoardFilter } from "./boardFilters";
import type { BoardGroup } from "./boardGroups";
import { cardsInSection, type SectionSummary } from "./boardSections";
import type { CardState } from "./boardStructure";
import type { CardOrigins } from "./cardOrigins";
import { collapseStacks, type CardStack } from "./cardStacks";
import { isCardAt, type PathPhases } from "./pathStages";

/** Everything the page cuts the board by. */
export type Cuts = {
  allCards: BoardCard[];
  stacks: Map<string, CardStack>;
  /** The piles that are spread out, whoever spread them. */
  visibleStackIds: ReadonlySet<string>;
  /** The phase the board was opened for, if any. */
  pathPlace: string | null;
  phases: PathPhases | null;
  cardOrigins: CardOrigins;
  filter: BoardFilter;
  groups: BoardGroup[];
  /** The section being shown; null is everything. */
  shownSectionId: string | null;
  states: Map<string, CardState>;
  pinnedIds: ReadonlySet<string>;
  cardMarks: CardMarks;
};

/**
 * The cards on screen: piles fold first, so every later cut sees one card where there is one pile;
 * then the phase the board was opened for -- the narrowest question anybody asks of the page, with
 * the other cuts still applying within it -- then the owner filter, then the section, then the focus
 * view.
 *
 * Pinned last and stably, so pinning one card lifts that card and disturbs nothing else. A display
 * sort, not a write: what gets sent on a reorder is what is on screen, so pinning and dragging
 * cannot disagree about where a card is. A pile counts as pinned when any card in it is, so a pinned
 * card does not stay buried at the bottom of the board because it happens to lie in a pile.
 */
export function selectShownCards(cuts: Cuts): BoardCard[] {
  const { stacks, pinnedIds } = cuts;
  const folded = collapseStacks(cuts.allCards, stacks, cuts.visibleStackIds);
  const place = cuts.pathPlace;
  const atPlace = place
    ? folded.filter((card) => isCardAt(card, place, cuts.phases, cuts.cardOrigins))
    : folded;
  const bySource = atPlace.filter((card) => matchesFilter(card, cuts.filter));
  const visible = cardsInSection(
    bySource,
    cuts.groups,
    cuts.shownSectionId,
    { states: cuts.states, pinnedIds },
    cuts.cardMarks,
  );

  const lifted = (cardId: string) =>
    pinnedIds.has(cardId) ||
    (stacks.get(cardId)?.memberIds.some((memberId) => pinnedIds.has(memberId)) ?? false);

  return [...visible].sort((a, b) => Number(lifted(b.id)) - Number(lifted(a.id)));
}

/**
 * Every cut currently taking cards off the screen, named the way its own control names it.
 *
 * In the order they are applied, so the line reads as the pipeline it describes. A cut that is set
 * but removing nothing -- a filter matching every card, a section holding all of them -- is left
 * out: the line exists to explain cards that are missing, and naming a control that took nothing
 * away would send the hire to reset something that was never the problem. Folded bands are
 * deliberately not listed: they say so where they happen, in a heading on the board.
 */
export function describeCuts(
  cuts: Pick<Cuts, "allCards" | "stacks" | "visibleStackIds" | "pathPlace" | "filter">,
  extra: {
    /** What the phase is called, for the line saying the board is narrowed to it. */
    pathPlaceTitle: string | null;
    shownSectionId: string | null;
    sections: SectionSummary[];
  },
): string[] {
  const names: string[] = [];

  const piled =
    cuts.allCards.length - collapseStacks(cuts.allCards, cuts.stacks, cuts.visibleStackIds).length;
  if (piled > 0) names.push(`${piled} under other cards in piles`);

  if (cuts.pathPlace) {
    names.push(extra.pathPlaceTitle ? `From “${extra.pathPlaceTitle}”` : "From one phase");
  }

  const cut = filterLabel(cuts.filter);
  if (cut) names.push(cut);

  if (extra.shownSectionId !== null) {
    const section = extra.sections.find((candidate) => candidate.id === extra.shownSectionId);
    if (section) names.push(section.name);
  }

  return names;
}
