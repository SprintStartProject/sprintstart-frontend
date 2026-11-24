import { describe, expect, it } from "vitest";
import {
  describeCuts,
  selectShownCards,
  type Cuts,
} from "../../../../src/features/board/layout/boardCuts";
import type { BoardCard } from "../../../../src/features/board/types";

function card(id: string, owner: "HIRE" | "AI" = "HIRE"): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner,
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text: id },
  };
}

const ALL = [card("a"), card("b", "AI"), card("c"), card("d", "AI")];

function cuts(over: Partial<Cuts> = {}): Cuts {
  return {
    allCards: ALL,
    stacks: new Map(),
    visibleStackIds: new Set(),
    pathPlace: null,
    phases: null,
    cardOrigins: {},
    filter: "all",
    groups: [],
    shownSectionId: null,
    states: new Map(),
    pinnedIds: new Set(),
    cardMarks: {},
    ...over,
  };
}

const ids = (cards: BoardCard[]) => cards.map((c) => c.id);

describe("selectShownCards", () => {
  it("shows every card when nothing cuts the board", () => {
    expect(ids(selectShownCards(cuts()))).toEqual(["a", "b", "c", "d"]);
  });

  it("cuts by who put a card there", () => {
    expect(ids(selectShownCards(cuts({ filter: "buddy" })))).toEqual(["b", "d"]);
    expect(ids(selectShownCards(cuts({ filter: "mine" })))).toEqual(["a", "c"]);
  });

  it("cuts by area", () => {
    const groups = [{ id: "g1", name: "Paperwork", cardIds: ["a", "d"], collapsed: false }];

    expect(ids(selectShownCards(cuts({ groups, shownSectionId: "g1" })))).toEqual(["a", "d"]);
  });

  it("cuts by the phase the board was opened for, by where each card was kept", () => {
    const cardOrigins = {
      a: { url: "/onboarding?phase=ph1", label: "Phase one" },
      c: { url: "/onboarding?phase=ph2", label: "Phase two" },
    };

    expect(ids(selectShownCards(cuts({ pathPlace: "ph1", cardOrigins })))).toEqual(["a"]);
  });

  it("applies the cuts one inside the other", () => {
    const groups = [{ id: "g1", name: "Paperwork", cardIds: ["a", "b"], collapsed: false }];

    expect(ids(selectShownCards(cuts({ groups, shownSectionId: "g1", filter: "buddy" })))).toEqual([
      "b",
    ]);
  });

  it("lifts pinned cards to the top and leaves the rest in order", () => {
    expect(ids(selectShownCards(cuts({ pinnedIds: new Set(["c", "d"]) })))).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
  });

  it("does not change the order when nothing is pinned", () => {
    expect(ids(selectShownCards(cuts({ pinnedIds: new Set() })))).toEqual(["a", "b", "c", "d"]);
  });

  it("counts a pile as pinned when any card in it is", () => {
    const stacks = new Map([
      [
        "c",
        {
          rootId: "c",
          memberIds: ["c", "x"],
          topId: "c",
          remaining: 2,
          total: 2,
          members: new Map(),
        },
      ],
    ]);

    const shown = selectShownCards(cuts({ stacks, pinnedIds: new Set(["x"]) }));

    expect(ids(shown)[0]).toBe("c");
  });
});

describe("describeCuts", () => {
  const sections = [
    { id: "g1", name: "Paperwork", total: 2, done: 0, blocked: 0 },
  ] as unknown as Parameters<typeof describeCuts>[1]["sections"];
  const none = { pathPlaceTitle: null, shownSectionId: null, sections };

  it("names nothing when nothing is cut", () => {
    expect(describeCuts(cuts(), none)).toEqual([]);
  });

  it("names the phase the board was opened for, or says it is one phase", () => {
    expect(
      describeCuts(cuts({ pathPlace: "ph1" }), { ...none, pathPlaceTitle: "Phase one" }),
    ).toEqual(["From “Phase one”"]);
    expect(describeCuts(cuts({ pathPlace: "ph1" }), none)).toEqual(["From one phase"]);
  });

  it("names the filter the way its control does", () => {
    expect(describeCuts(cuts({ filter: "buddy" }), none)).toHaveLength(1);
    expect(describeCuts(cuts({ filter: "all" }), none)).toEqual([]);
  });

  it("names the open section, if it still exists", () => {
    expect(describeCuts(cuts(), { ...none, shownSectionId: "g1" })).toEqual(["Paperwork"]);
    expect(describeCuts(cuts(), { ...none, shownSectionId: "gone" })).toEqual([]);
  });

  it("names the cuts in the order they are applied", () => {
    const names = describeCuts(cuts({ pathPlace: "ph1", filter: "mine" }), {
      pathPlaceTitle: "Phase one",
      shownSectionId: "g1",
      sections,
    });

    expect(names[0]).toBe("From “Phase one”");
    expect(names[names.length - 1]).toBe("Paperwork");
    expect(names).toHaveLength(3);
  });

  it("counts the cards hidden under piles", () => {
    const stacks = new Map([
      [
        "a",
        {
          rootId: "a",
          memberIds: ["a", "b"],
          topId: "a",
          remaining: 2,
          total: 2,
          members: new Map(),
        },
      ],
    ]);

    expect(describeCuts(cuts({ stacks }), none)).toEqual(["1 under other cards in piles"]);
    expect(describeCuts(cuts({ stacks, visibleStackIds: new Set(["a"]) }), none)).toEqual([]);
  });
});
