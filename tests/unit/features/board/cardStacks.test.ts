import { describe, it, expect } from "vitest";
import { buildStacks, collapseStacks } from "../../../../src/features/board/layout/cardStacks";
import {
  deriveCardStates,
  type BoardStructure,
  type CardStructure,
} from "../../../../src/features/board/layout/boardStructure";
import type { BoardCard } from "../../../../src/features/board/types";

function card(id: string, done = false): BoardCard {
  return {
    id,
    kind: "CHECKLIST",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: {
      kind: "CHECKLIST",
      title: id,
      items: [{ id: `${id}-1`, text: "do it", done }],
    },
  };
}

/** A chain: each id waits on the one before it. */
function chain(...ids: string[]): BoardStructure {
  const cards: Record<string, CardStructure> = {};
  ids.forEach((id, index) => {
    if (index > 0) cards[id] = { dependsOn: [ids[index - 1]] };
  });

  return { cards, groupStages: {} };
}

function stacksOf(cards: BoardCard[], structure: BoardStructure) {
  return buildStacks(cards, deriveCardStates(cards, structure));
}

describe("buildStacks", () => {
  it("collects a run of dependent cards, in working order", () => {
    const cards = [card("a"), card("b"), card("c")];
    const stacks = stacksOf(cards, chain("a", "b", "c"));

    expect(stacks.get("b")?.memberIds).toEqual(["a", "b", "c"]);
    expect(stacks.get("b")?.rootId).toBe("a");
  });

  it("puts the first unfinished card on top", () => {
    const cards = [card("a", true), card("b", true), card("c")];
    const stacks = stacksOf(cards, chain("a", "b", "c"));

    expect(stacks.get("a")?.topId).toBe("c");
    expect(stacks.get("a")?.remaining).toBe(1);
  });

  it("keeps the last card on top once the whole run is finished", () => {
    // A finished chain stays visible as one ticked card rather than vanishing.
    const cards = [card("a", true), card("b", true)];
    const stacks = stacksOf(cards, chain("a", "b"));

    expect(stacks.get("a")?.topId).toBe("b");
    expect(stacks.get("a")?.remaining).toBe(0);
  });

  it("does not stack a single card", () => {
    expect(stacksOf([card("a")], { cards: {}, groupStages: {} }).size).toBe(0);
  });

  it("stops a run where it forks", () => {
    // Two cards waiting on the same one is parallel work sharing a prerequisite, not a sequence.
    const cards = [card("a"), card("b"), card("c")];
    const structure: BoardStructure = {
      cards: { b: { dependsOn: ["a"] }, c: { dependsOn: ["a"] } },
      groupStages: {},
    };

    expect(stacksOf(cards, structure).size).toBe(0);
  });

  it("stacks the run that leads into a fork, but not past it", () => {
    const cards = [card("a"), card("b"), card("c"), card("d")];
    const structure: BoardStructure = {
      cards: {
        b: { dependsOn: ["a"] },
        c: { dependsOn: ["b"] },
        d: { dependsOn: ["b"] },
      },
      groupStages: {},
    };
    const stacks = stacksOf(cards, structure);

    expect(stacks.get("a")?.memberIds).toEqual(["a", "b"]);
    expect(stacks.has("c")).toBe(false);
    expect(stacks.has("d")).toBe(false);
  });

  it("ignores a predecessor that has left the board", () => {
    const cards = [card("b"), card("c")];
    const stacks = stacksOf(cards, chain("gone", "b", "c"));

    expect(stacks.get("b")?.memberIds).toEqual(["b", "c"]);
  });
});

describe("collapseStacks", () => {
  it("shows one card for a closed stack, at the position of its first member", () => {
    const cards = [card("loose"), card("a"), card("b"), card("after")];
    const stacks = stacksOf(cards, chain("a", "b"));

    expect(collapseStacks(cards, stacks, new Set()).map((c) => c.id)).toEqual([
      "loose",
      "a",
      "after",
    ]);
  });

  it("shows an open stack's members consecutively, in working order", () => {
    const cards = [card("a"), card("b"), card("after")];
    const stacks = stacksOf(cards, chain("a", "b"));

    expect(collapseStacks(cards, stacks, new Set(["a"])).map((c) => c.id)).toEqual([
      "a",
      "b",
      "after",
    ]);
  });

  it("stands the first unfinished card in the stack's place", () => {
    const cards = [card("a", true), card("b")];
    const stacks = stacksOf(cards, chain("a", "b"));

    expect(collapseStacks(cards, stacks, new Set()).map((c) => c.id)).toEqual(["b"]);
  });

  it("leaves an unstacked board exactly as it was", () => {
    const cards = [card("a"), card("b")];

    expect(collapseStacks(cards, new Map(), new Set()).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
