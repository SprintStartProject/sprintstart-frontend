import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_PREFERENCES,
  readBoardPreferences,
  writeBoardPreferences,
} from "../../../../src/features/board/layout/boardPreferences";
import {
  readBoardGroups,
  writeBoardGroups,
} from "../../../../src/features/board/layout/boardGroups";

describe("how a hire wants their board to look", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips a choice", () => {
    writeBoardPreferences("b1", { density: "compact", toolsHidden: true });

    expect(readBoardPreferences("b1")).toEqual({ density: "compact", toolsHidden: true });
  });

  it("keeps boards apart, because two projects are two boards", () => {
    writeBoardPreferences("b1", { density: "compact", toolsHidden: false });

    expect(readBoardPreferences("b2")).toEqual(DEFAULT_PREFERENCES);
  });

  it("falls back to the defaults rather than trusting rubbish in storage", () => {
    window.localStorage.setItem("sprintstart:board-preferences:b3", "{not json");
    expect(readBoardPreferences("b3")).toEqual(DEFAULT_PREFERENCES);

    window.localStorage.setItem(
      "sprintstart:board-preferences:b4",
      JSON.stringify({ version: 1, preferences: { density: "enormous", toolsHidden: "yes" } }),
    );

    expect(readBoardPreferences("b4")).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("the colour a hire paints an area", () => {
  beforeEach(() => window.localStorage.clear());

  it("stays with the area", () => {
    writeBoardGroups("b1", [
      { id: "g1", name: "Week one", cardIds: ["a"], collapsed: false, accent: "purple" },
    ]);

    expect(readBoardGroups("b1")[0].accent).toBe("purple");
  });

  it("drops a colour that is not one of the four, so storage cannot paint nonsense", () => {
    window.localStorage.setItem(
      "sprintstart:board-groups:b2",
      JSON.stringify({
        version: 1,
        groups: [{ id: "g1", name: "Week one", cardIds: ["a"], collapsed: false, accent: "red" }],
      }),
    );

    // Red means something fixed everywhere else in the app; an area cannot borrow it.
    expect(readBoardGroups("b2")[0].accent).toBeUndefined();
  });
});
