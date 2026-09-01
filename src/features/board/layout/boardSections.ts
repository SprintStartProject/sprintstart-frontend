import type { BoardCard } from "../types";
import { groupOf, type BoardGroup } from "./boardGroups";
import { stageOrder, type BoardStage, type CardState } from "./boardStructure";

/**
 * The sentinel for "no area", so a section list can offer loose cards without inventing an id that
 * could collide with a real group's.
 */
export const LOOSE_SECTION = "__loose__";

/**
 * The sentinel for "everything".
 *
 * The board's own idea of "no section selected" is `null`, which the shared tab machinery cannot
 * carry — `SegmentedTabs` and `useSwipeableTabs` are both keyed by string. Converted at the edges,
 * so nothing in between has to know both representations; exported because the page builds the
 * swipe order from the same values the bar renders, and two spellings of "everything" would make a
 * swipe onto that tab a swipe onto nothing.
 */
export const ALL_SECTIONS = "__all__";

/** One section: an area, the loose cards, or the whole board. */
export type SectionSummary = {
  /** A group id, {@link LOOSE_SECTION}, or null for "everything". */
  id: string | null;
  name: string;
  /** The stage its cards sit in, or null when they disagree or there is no structure yet. */
  stage: BoardStage | null;
  total: number;
  done: number;
  blocked: number;
};

/** The section values, left to right: the order a swipe walks through. */
export function sectionTabOrder(sections: SectionSummary[]): string[] {
  return sections.map((section) => section.id ?? ALL_SECTIONS);
}

/**
 * The rail's rows, in the order the board itself puts them in.
 *
 * Areas are ordered by where their earliest card sits, exactly as the grid orders them, so the rail
 * and the pane never disagree about what comes first. "Everything" leads; loose cards trail, because
 * an area somebody named is a decision and an unfiled card is the absence of one.
 *
 * A section's stage is the *earliest* stage among its cards rather than a majority or a stored
 * value. An area holding one card due now and eleven due later is an area with something due now,
 * and rounding that away is exactly the information the rail exists to surface.
 */
export function summariseSections(
  cards: BoardCard[],
  groups: BoardGroup[],
  states: Map<string, CardState>,
): SectionSummary[] {
  const summaries: SectionSummary[] = [count(null, "Everything", cards, states)];

  const seen = new Set<string>();
  for (const card of cards) {
    const group = groupOf(groups, card.id);
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);

    const members = cards.filter((member) => group.cardIds.includes(member.id));
    summaries.push(count(group.id, group.name, members, states));
  }

  const loose = cards.filter((card) => groupOf(groups, card.id) === null);
  if (loose.length > 0 && summaries.length > 1) {
    summaries.push(count(LOOSE_SECTION, "Not in an area", loose, states));
  }

  return summaries;
}

/** One row's counts and stage, from the cards that belong to it. */
function count(
  id: string | null,
  name: string,
  cards: BoardCard[],
  states: Map<string, CardState>,
): SectionSummary {
  let done = 0;
  let blocked = 0;
  let stage: BoardStage | null = null;

  for (const card of cards) {
    const state = states.get(card.id);
    if (!state) continue;
    if (state.status === "DONE") done += 1;
    if (state.status === "BLOCKED") blocked += 1;
    if (stage === null || stageOrder(state.stage) < stageOrder(stage)) stage = state.stage;
  }

  return { id, name, stage, total: cards.length, done, blocked };
}

/** The cards a rail selection shows: everything, one area's cards, or the unfiled ones. */
export function cardsInSection(
  cards: BoardCard[],
  groups: BoardGroup[],
  sectionId: string | null,
): BoardCard[] {
  if (sectionId === null) return cards;
  if (sectionId === LOOSE_SECTION) return cards.filter((card) => groupOf(groups, card.id) === null);

  return cards.filter((card) => groupOf(groups, card.id)?.id === sectionId);
}
