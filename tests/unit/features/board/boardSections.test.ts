import { describe, it, expect } from "vitest";
import {
  cardsInSection,
  FOCUS_SECTION,
  LOOSE_SECTION,
  markSection,
  markSectionColor,
  summariseSections,
} from "../../../../src/features/board/layout/boardSections";
import {
  deriveCardStates,
  type BoardStructure,
  type CardState,
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

describe("an area with nothing in it", () => {
  const cards = [card("a"), card("b")];
  const states = () => deriveCardStates(cards, structure({ a: "NOW", b: "NOW" }));

  it("gets a row, so it can be opened and sent cards", () => {
    const sections = summariseSections(cards, [group("g1", "Paperwork", [])], states());

    expect(sections.map((section) => section.name)).toContain("Paperwork");
  });

  it("counts nothing", () => {
    const [, paperwork] = summariseSections(cards, [group("g1", "Paperwork", [])], states());

    expect([paperwork.total, paperwork.done, paperwork.blocked]).toEqual([0, 0, 0]);
  });

  it("trails the areas that hold something", () => {
    const sections = summariseSections(
      cards,
      [group("g1", "Paperwork", []), group("g2", "Week one", ["a"])],
      states(),
    );

    // An empty row is a destination, not a part of the board anybody is reading.
    expect(sections.map((section) => section.name)).toEqual([
      "All sections",
      "Week one",
      "Paperwork",
      "Not in an area",
    ]);
  });
});

describe("cutting the board by what was highlighted", () => {
  const cards = [note("c1"), note("c2"), note("c3")];
  const states = new Map(cards.map((card) => [card.id, openState()]));
  const marks = {
    c1: [{ text: "ask about this", color: "green" as const }],
    c2: [
      { text: "and this", color: "green" as const },
      { text: "something else", color: "yellow" as const },
    ],
  };

  it("offers a row only for the colours actually used", () => {
    const rows = summariseSections(cards, [], states, { marks });

    // Four rows for three green marks would be three empty promises and a bar mostly about a
    // feature nobody used.
    expect(rows.filter((row) => row.mark).map((row) => row.mark)).toEqual(["yellow", "green"]);
  });

  it("calls a colour what the hire calls it", () => {
    const rows = summariseSections(cards, [], states, {
      marks,
      markLabels: { green: "ask about" },
    });

    expect(rows.find((row) => row.mark === "green")?.name).toBe("ask about");
    // A colour they have not named keeps the colour's own word rather than going blank.
    expect(rows.find((row) => row.mark === "yellow")?.name).toBe("Yellow");
  });

  it("counts the cards carrying that colour, not the marks", () => {
    const rows = summariseSections(cards, [], states, { marks });

    expect(rows.find((row) => row.mark === "green")?.total).toBe(2);
    expect(rows.find((row) => row.mark === "yellow")?.total).toBe(1);
  });

  it("says nothing about highlights when it was not given any", () => {
    expect(summariseSections(cards, [], states, {}).some((row) => row.mark)).toBe(false);
  });

  it("narrows to the cards carrying that colour", () => {
    const shown = cardsInSection(cards, [], markSection("green"), undefined, marks);

    expect(shown.map((card) => card.id)).toEqual(["c1", "c2"]);
  });

  it("shows nothing rather than everything when the marks are missing", () => {
    // Showing everything would be the bar claiming to have narrowed to a colour and then not
    // doing it.
    expect(cardsInSection(cards, [], markSection("green"))).toEqual([]);
  });

  it("reads a colour back out of a section id, and refuses one it does not know", () => {
    expect(markSectionColor(markSection("pink"))).toBe("pink");
    expect(markSectionColor("__mark__:chartreuse")).toBeNull();
    expect(markSectionColor(LOOSE_SECTION)).toBeNull();
    expect(markSectionColor(null)).toBeNull();
  });
});

function note(id: string): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text: id },
  };
}

function openState(): CardState {
  return {
    status: "OPEN",
    stage: "NOW",
    blockedBy: [],
    predecessorId: null,
    predecessorSource: null,
    progress: null,
  };
}
