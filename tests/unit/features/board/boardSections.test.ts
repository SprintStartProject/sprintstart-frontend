import { describe, it, expect } from "vitest";
import {
  cardsInSection,
  FOCUS_SECTION,
  LOOSE_SECTION,
  summariseSections,
} from "../../../../src/features/board/layout/boardSections";
import {
  deriveCardStates,
  type BoardStructure,
} from "../../../../src/features/board/layout/boardStructure";
import type { BoardGroup } from "../../../../src/features/board/layout/boardGroups";
import type { BoardCard } from "../../../../src/features/board/types";

function card(id: string, done = false): BoardCard {
  return {
    id,
    kind: "CHECKLIST",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "CHECKLIST", title: id, items: [{ id: `${id}-1`, text: "do it", done }] },
  };
}

function structure(stages: Record<string, "NOW" | "LATER">): BoardStructure {
  return {
    cards: Object.fromEntries(Object.entries(stages).map(([id, stage]) => [id, { stage }])),
    groupStages: {},
  };
}

const group = (id: string, name: string, cardIds: string[]): BoardGroup => ({
  id,
  name,
  cardIds,
  collapsed: false,
});

describe("the sections a board offers", () => {
  const cards = [card("a"), card("b"), card("c")];
  const states = () => deriveCardStates(cards, structure({ a: "NOW", b: "LATER", c: "LATER" }));

  it("offers no focus section unless it is asked for", () => {
    const sections = summariseSections(cards, [], states());

    expect(sections.map((section) => section.id)).toEqual([null]);
  });

  it("leads with focus, and counts only what is due in it", () => {
    const sections = summariseSections(cards, [], states(), { focus: true });

    expect(sections[0].id).toBe(FOCUS_SECTION);
    expect(sections[0].total).toBe(1);
  });

  it("does not call every card 'not in an area' on a board with no areas", () => {
    const sections = summariseSections(cards, [], states(), { focus: true });

    expect(sections.map((section) => section.id)).not.toContain(LOOSE_SECTION);
  });

  it("names the unfiled cards once there is an area to be outside of", () => {
    const sections = summariseSections(cards, [group("g1", "Week one", ["a"])], states());

    expect(sections.map((section) => section.name)).toEqual([
      "All sections",
      "Week one",
      "Not in an area",
    ]);
  });

  it("shows what is due and anything pinned, whatever stage it is in", () => {
    const shown = cardsInSection(cards, [], FOCUS_SECTION, {
      states: states(),
      pinnedIds: new Set(["c"]),
    });

    // A pin is the hire saying this one matters now; a view that dropped it would be the board
    // arguing with them.
    expect(shown.map((shownCard) => shownCard.id)).toEqual(["a", "c"]);
  });
});
