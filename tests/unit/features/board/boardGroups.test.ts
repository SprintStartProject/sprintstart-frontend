import { describe, it, expect, beforeEach } from "vitest";
import {
  assignToGroup,
  dissolveGroup,
  newBoardGroup,
  readBoardGroups,
  writeBoardGroups,
  type BoardGroup,
} from "../../../../src/features/board/layout/boardGroups";

const group = (id: string, name: string, cardIds: string[]): BoardGroup => ({
  id,
  name,
  cardIds,
  collapsed: false,
});

describe("the areas a board remembers", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps what it was given", () => {
    writeBoardGroups("b1", [group("g1", "Week one", ["a", "b"])]);

    expect(readBoardGroups("b1").map((read) => read.name)).toEqual(["Week one"]);
  });

  it("folds the stage-split team areas an older version wrote back into one", () => {
    // The stage used to live on the area, so a team's blueprints arrived as three areas and three
    // tab stops. Fixed at the source — but a board generated before the fix still has them.
    writeBoardGroups("b1", [
      group("g1", "From your team — Now", ["a"]),
      group("g2", "From your team — Next", ["b"]),
      group("g3", "From your team — Later", ["c"]),
      group("g4", "Week one", ["d"]),
    ]);

    const read = readBoardGroups("b1");

    expect(read.map((area) => area.name)).toEqual(["From your team", "Week one"]);
    expect(read[0].cardIds).toEqual(["a", "b", "c"]);
    // The first one's place and id survive, so the board's order does not jump on the next visit.
    expect(read[0].id).toBe("g1");
  });

  it("folds two areas that ended up with the same name", () => {
    writeBoardGroups("b1", [
      group("g1", "From your team", ["a"]),
      group("g2", "From your team", ["a", "b"]),
    ]);

    // Two tabs with one word on them are indistinguishable, whatever put them there. A card that
    // is in both is still one card.
    expect(readBoardGroups("b1")).toEqual([group("g1", "From your team", ["a", "b"])]);
  });

  it("leaves an area the hire named themselves alone", () => {
    writeBoardGroups("b1", [group("g1", "From your team — my copy", ["a"])]);

    // Only the three names the generator could have written are folded. Anything else is somebody
    // naming their own area, and renaming that would be the board editing their words.
    expect(readBoardGroups("b1")[0].name).toBe("From your team — my copy");
  });
});

describe("moving a card between areas", () => {
  it("keeps an area that has just lost its last card", () => {
    const kept = assignToGroup([group("g1", "Paperwork", ["a"])], "a", null);

    // It used to be dropped, which was right while the only way to make an area was to put a card
    // in one. Now that an area can be made empty and named first, "empty" cannot mean "delete me":
    // dragging the last card out to look at it elsewhere would take the name with it.
    expect(kept).toEqual([group("g1", "Paperwork", [])]);
  });

  it("takes a card out of the area it was in", () => {
    const moved = assignToGroup(
      [group("g1", "Week one", ["a"]), group("g2", "Week two", [])],
      "a",
      "g2",
    );

    expect(moved.map((area) => area.cardIds)).toEqual([[], ["a"]]);
  });

  it("removes an area only when somebody dissolves it", () => {
    expect(dissolveGroup([group("g1", "Paperwork", [])], "g1")).toEqual([]);
  });

  it("makes a new area empty, and named after the ones already there", () => {
    const created = newBoardGroup([group("g1", "Week one", ["a"])]);

    expect(created.cardIds).toEqual([]);
    expect(created.name).toBe("Area 2");
  });
});
