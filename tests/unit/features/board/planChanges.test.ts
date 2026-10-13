import { describe, it, expect } from "vitest";
import {
  countPlanChanges,
  revertedDocument,
  revertedOrder,
  sameOrder,
  type PlanSnapshot,
} from "../../../../src/features/board/layout/planChanges";
import type { BoardDocument } from "../../../../src/features/board/sync/boardDocument";

function doc(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    cards: {},
    groupStages: {},
    groups: [],
    collapsedCardIds: [],
    pinnedCardIds: [],
    sizes: {},
    origins: {},
    marks: {},
    markLabels: {},
    ...overrides,
  };
}

const start: PlanSnapshot = { document: doc(), order: ["a", "b", "c", "d"] };

describe("countPlanChanges", () => {
  it("is zero when nothing changed", () => {
    expect(countPlanChanges(start, doc(), ["a", "b", "c", "d"])).toBe(0);
  });

  it("counts one card moved to the top as one change, not every card it pushed down", () => {
    expect(countPlanChanges(start, doc(), ["d", "a", "b", "c"])).toBe(1);
  });

  it("counts a card once however much about it changed", () => {
    const after = doc({
      cards: { b: { dependsOn: [{ id: "a", source: "HIRE" }] } },
      pinnedCardIds: ["b"],
    });

    expect(countPlanChanges(start, after, ["a", "b", "c", "d"])).toBe(1);
  });

  it("counts a new area and the card put into it", () => {
    const after = doc({
      groups: [{ id: "g", name: "Setup", cardIds: ["c"], collapsed: false }],
    });

    expect(countPlanChanges(start, after, ["a", "b", "c", "d"])).toBe(2);
  });
});

describe("reverting a plan", () => {
  it("puts the arrangement back and keeps marks made since", () => {
    const before: PlanSnapshot = { document: doc({ pinnedCardIds: ["a"] }), order: ["a"] };
    const current = doc({
      pinnedCardIds: [],
      marks: { a: [{ text: "keep", color: "yellow" }] },
    });

    const reverted = revertedDocument(before, current);

    expect(reverted.pinnedCardIds).toEqual(["a"]);
    expect(reverted.marks).toEqual(current.marks);
  });

  it("restores the old order and keeps cards that arrived since at the end", () => {
    expect(revertedOrder(start, ["d", "c", "e", "b"])).toEqual(["b", "c", "d", "e"]);
  });

  it("knows when the order did not change", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
  });
});
