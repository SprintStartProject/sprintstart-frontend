import { useMemo } from "react";
import { useSwipeableTabs } from "../../../hooks/useHorizontalWheelNavigation";
import type { BoardCard } from "../types";
import { ALL_SECTIONS, sectionTabOrder, summariseSections } from "../layout/boardSections";
import type { BoardGroup } from "../layout/boardGroups";
import type { CardState } from "../layout/boardStructure";
import { FOLD_THRESHOLD } from "../layout/foldThreshold";
import { useCardMarks } from "../marks/useCardMarks";

type Params = {
  allCards: BoardCard[];
  groups: BoardGroup[];
  states: Map<string, CardState>;
  pinnedIds: ReadonlySet<string>;
  /** The section the hire chose; null is everything. It may name one that no longer exists. */
  sectionId: string | null;
  setSectionId: (sectionId: string | null) => void;
};

/**
 * The board's sections -- areas, the focus view and a row per highlight colour -- and which of them
 * is open.
 *
 * The colours are split from the rest. A colour is not a part of the board the way an area is -- it
 * is something the hire drew on a card while reading -- so it does not belong in the bar that says
 * which part of the board is open. The colours are switches and live in the rail; the bar keeps the
 * areas, the stages and the rest, which are all places a card *is*.
 */
export function useBoardSections(params: Params) {
  const { allCards, groups, states, pinnedIds, sectionId, setSectionId } = params;
  // The highlights, for the colour cuts. Read from the same provider the cards themselves draw from,
  // so a row's count and the cards behind it cannot disagree.
  const { marks: cardMarks, labels: markLabels } = useCardMarks();

  const sections = useMemo(
    () =>
      summariseSections(allCards, groups, states, {
        // The focus tab is for a board somebody can get lost on. Below the fold threshold every card
        // is already in front of them, and a tab offering a subset of six is a choice made for its
        // own sake.
        focus: allCards.length > FOLD_THRESHOLD,
        pinnedIds,
        marks: cardMarks,
        markLabels,
      }),
    [allCards, groups, pinnedIds, states, cardMarks, markLabels],
  );
  const markSections = useMemo(() => sections.filter((section) => section.mark), [sections]);
  const tabSections = useMemo(() => sections.filter((section) => !section.mark), [sections]);

  /**
   * Whether the board has been divided into anything worth navigating. One section called
   * "Everything" is a table of contents for a book with one chapter, so an undivided board gets no
   * bar at all.
   */
  const hasSectionTabs = tabSections.length > 1;

  /**
   * The section actually being shown, which is not always the one that was chosen.
   *
   * A colour row exists only while something is marked in that colour, so rubbing out the last green
   * highlight takes the green dot off the rail -- and the board would go on filtering by a colour
   * with no control left to switch it off. An area behaves the same way when it is dissolved from
   * somewhere other than this page. A section id that no longer names a section means everything.
   */
  const shownSectionId = useMemo(
    () =>
      sectionId !== null && !sections.some((section) => section.id === sectionId)
        ? null
        : sectionId,
    [sectionId, sections],
  );

  // The sections as the tab machinery sees them: a fixed left-to-right order, and a string for the
  // current one. Built from the same array the bar renders, so a swipe and a tap walk the same list.
  const sectionOrder = useMemo(() => sectionTabOrder(tabSections), [tabSections]);
  const sectionValue = shownSectionId ?? ALL_SECTIONS;
  const sectionIndex = Math.max(sectionOrder.indexOf(sectionValue), 0);

  /**
   * Two-finger swipe between the sections, the same gesture every other tabbed page in the app
   * answers to. Off on an undivided board, and off while a colour is being shown: the colours are
   * not in this order, so a swipe from one would land on whichever tab happens to be first.
   */
  const swipeRef = useSwipeableTabs<string, HTMLElement>({
    order: sectionOrder,
    value: sectionValue,
    onChange: (value) => setSectionId(value === ALL_SECTIONS ? null : value),
    enabled: hasSectionTabs && sectionOrder.includes(sectionValue),
  });

  return {
    sections,
    markSections,
    tabSections,
    hasSectionTabs,
    shownSectionId,
    sectionValue,
    sectionIndex,
    swipeRef,
    cardMarks,
  };
}
