import type { BoardCard } from "../types";
import { groupOf, type BoardGroup } from "./boardGroups";
import { currentStage, stageOrder, type BoardStage, type CardState } from "./boardStructure";
import type { CardMarks } from "../marks/cardMarks";
import { HIGHLIGHT_COLORS, type HighlightColor } from "../marks/highlightColors";
import { labelFor, type MarkLabels } from "../marks/markLabels";

/**
 * The sentinel for "no area", so a section list can offer loose cards without inventing an id that
 * could collide with a real group's.
 */
export const LOOSE_SECTION = "__loose__";

/**
 * The sentinel for "just what I should be doing".
 *
 * A section rather than a mode, which is the whole reason it can exist beside the areas at all. The
 * board's other cuts are places — an area, the unfiled cards — and "what is due now" is a place too
 * as far as the hire is concerned: it is the tab you open to start, and the one you leave when you
 * want the whole board back. As a mode it was a switch somewhere else on the page that quietly
 * emptied the board; as a tab it is one of the things you can be looking at, and the bar says which.
 */
export const FOCUS_SECTION = "__focus__";

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

/**
 * The prefix for "everything I marked in this colour".
 *
 * The one cut on this bar that is not a *place*. An area is where a card sits and the focus section
 * is when it is due; a highlight is the hire having said, inside a card, that this bit is the point
 * — which is a sharper statement than either, and until now it was one the board stored and never
 * used. Naming a colour meant nothing while nothing could be done with the name; this is the thing
 * that can be done with it.
 */
const MARK_PREFIX = "__mark__:";

/** The section id for one highlight colour. */
export function markSection(color: HighlightColor): string {
  return `${MARK_PREFIX}${color}`;
}

/** The colour a section id names, or null when it names something else. */
export function markSectionColor(sectionId: string | null): HighlightColor | null {
  if (!sectionId?.startsWith(MARK_PREFIX)) return null;
  const color = sectionId.slice(MARK_PREFIX.length);

  return HIGHLIGHT_COLORS.find((known) => known === color) ?? null;
}

/** The cards carrying at least one highlight in this colour. */
function markedIn(cards: BoardCard[], marks: CardMarks, color: HighlightColor): BoardCard[] {
  return cards.filter((card) => (marks[card.id] ?? []).some((mark) => mark.color === color));
}

/** One section: an area, the loose cards, or the whole board. */
export type SectionSummary = {
  /** A group id, a sentinel, a `markSection` id, or null for "everything". */
  id: string | null;
  name: string;
  /** Set only on a highlight row, so the bar can draw it as a colour rather than as a place. */
  mark?: HighlightColor;
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
 * and the pane never disagree about what comes first. "All sections" leads; loose cards trail, because
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
  options: {
    focus?: boolean;
    pinnedIds?: ReadonlySet<string>;
    /** The hire's highlights, which add one row per colour they have actually used. */
    marks?: CardMarks;
    /** What they call each colour. A colour they have not named keeps the colour's own word. */
    markLabels?: MarkLabels;
  } = {},
): SectionSummary[] {
  const areas: SectionSummary[] = [];

  const seen = new Set<string>();
  for (const card of cards) {
    const group = groupOf(groups, card.id);
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);

    const members = cards.filter((member) => group.cardIds.includes(member.id));
    areas.push(count(group.id, group.name, members, states));
  }

  // An area with nothing in it is still an area somebody made and named. It gets a row so it can
  // be opened, so cards can be sent to it, and so that making one is not an act with no visible
  // result — the alternative is a name stored in a place nothing on the page draws. They trail the
  // areas that hold something, in the order they were made: an empty row is a destination, not a
  // part of the board anybody is reading.
  for (const group of groups) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    areas.push(count(group.id, group.name, [], states));
  }

  const loose = cards.filter((card) => groupOf(groups, card.id) === null);
  // Only worth a row once there is something for it to be the opposite of. On a board with no
  // areas, "Not in an area" is every card, under a name that describes what it is not.
  if (loose.length > 0 && areas.length > 0) {
    areas.push(count(LOOSE_SECTION, "Not in an area", loose, states));
  }

  // One row per colour the hire has actually marked something in, trailing the places. Only the
  // colours in use: four rows on a board with three yellow marks would be three empty promises and
  // a tab bar that is mostly about a feature nobody used.
  const marked: SectionSummary[] = [];
  if (options.marks) {
    for (const color of HIGHLIGHT_COLORS) {
      const members = markedIn(cards, options.marks, color);
      if (members.length === 0) continue;

      marked.push({
        ...count(markSection(color), labelFor(options.markLabels ?? {}, color), members, states),
        mark: color,
      });
    }
  }

  // "All sections", not "Everything": the row this bar sits in also carries the control that
  // decides how much of a section is shown, and two neighbouring controls both offering
  // "Everything" for two different things is the board asking to be misread.
  const summaries: SectionSummary[] = [
    count(null, "All sections", cards, states),
    ...areas,
    ...marked,
  ];

  if (!options.focus) return summaries;

  // Focus leads, because it is where somebody who has just opened the board should start, and a
  // first tab is the one thing a bar says without being read.
  const focused = focusCards(cards, states, options.pinnedIds ?? new Set());

  return focused.length > 0
    ? [count(FOCUS_SECTION, "Focus", focused, states), ...summaries]
    : summaries;
}

/**
 * The cards the focus section holds: what is due and not finished, plus anything pinned.
 *
 * A pin is the hire saying *this one matters to me now*, whatever stage it sits in, and a view that
 * dropped it would be the board arguing with them. Blocked cards stay: knowing that the thing you
 * were about to start is waiting on something else is exactly what this view is for.
 */
function focusCards(
  cards: BoardCard[],
  states: Map<string, CardState>,
  pinnedIds: ReadonlySet<string>,
): BoardCard[] {
  const stage = currentStage(states);

  return cards.filter((card) => {
    if (pinnedIds.has(card.id)) return true;
    const state = states.get(card.id);

    return state !== undefined && state.stage === stage && state.status !== "DONE";
  });
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

/**
 * The cards a rail selection shows: everything, what is due, one area's cards, or the unfiled ones.
 *
 * The focus selection needs to know what is done and what is pinned, which an area never does — so
 * those arrive together in `focus`, and a caller with no process layer simply omits them and gets
 * the board's other sections unchanged.
 */
export function cardsInSection(
  cards: BoardCard[],
  groups: BoardGroup[],
  sectionId: string | null,
  focus?: { states: Map<string, CardState>; pinnedIds: ReadonlySet<string> },
  marks?: CardMarks,
): BoardCard[] {
  if (sectionId === null) return cards;
  if (sectionId === FOCUS_SECTION) {
    return focus ? focusCards(cards, focus.states, focus.pinnedIds) : cards;
  }

  const color = markSectionColor(sectionId);
  // Without the marks this cut cannot be made, and showing everything would be the bar claiming to
  // have narrowed to a colour and then not doing it. Nothing is the honest answer.
  if (color) return marks ? markedIn(cards, marks, color) : [];
  if (sectionId === LOOSE_SECTION) return cards.filter((card) => groupOf(groups, card.id) === null);

  return cards.filter((card) => groupOf(groups, card.id)?.id === sectionId);
}
