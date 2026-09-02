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

  it("keeps walking a run however long it is", () => {
    // The model was never the limit on chain length — the board's arrange mode was, by folding a
    // pair into a pile the moment it was made and taking the card you would chain next off the
    // screen with it. Nailed down here so the two cannot be confused again.
    const cards = [card("a"), card("b"), card("c"), card("d"), card("e")];
    const stacks = stacksOf(cards, chain("a", "b", "c", "d", "e"));

    expect(stacks.get("c")?.memberIds).toEqual(["a", "b", "c", "d", "e"]);
    expect(stacks.get("c")?.remaining).toBe(5);
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

describe("stacks and the areas they sit in", () => {
  /** Every card in the area its id is listed under. */
  function areas(map: Record<string, string[]>) {
    const byCard = new Map<string, string>();
    for (const [area, ids] of Object.entries(map)) for (const id of ids) byCard.set(id, area);

    return (cardId: string) => byCard.get(cardId) ?? null;
  }

  it("ends a run where the area changes", () => {
    const cards = [card("a"), card("b"), card("c")];
    const states = deriveCardStates(cards, chain("a", "b", "c"));

    // A pile is drawn in one place, and the layout files a block under exactly one area — a chain
    // running out of one area into another had two, and the grid drew it in both.
    const stacks = buildStacks(cards, states, areas({ week1: ["a", "b"], team: ["c"] }));

    expect(stacks.get("a")?.memberIds).toEqual(["a", "b"]);
    expect(stacks.get("c")).toBeUndefined();
  });

  it("carries what its members are called and what they are, because they will be folded away", () => {
    const cards = [card("a"), card("b")];
    const stacks = stacksOf(cards, chain("a", "b"));

    // By the time anything draws a closed pile, its members are gone from the card list — folding
    // them away is the point. The names have to travel with the pile or there is nothing left to
    // say about what is underneath but a number.
    expect(stacks.get("a")?.members.get("b")).toEqual({ name: "b", kind: "CHECKLIST" });
  });

  it("still stacks a chain that stays inside one area", () => {
    const cards = [card("a"), card("b")];
    const states = deriveCardStates(cards, chain("a", "b"));
    const stacks = buildStacks(cards, states, areas({ team: ["a", "b"] }));

    expect(stacks.get("a")?.memberIds).toEqual(["a", "b"]);
  });

  it("shows a pile whose top card is filtered away rather than none of it", () => {
    const cards = [card("a"), card("b")];
    const stacks = stacksOf(cards, chain("a", "b"));

    // The board hands this a filtered list — one source, one area. Keying on the top card alone
    // would take every member of the pile with it.
    const shown = collapseStacks([cards[1]], stacks, new Set());

    expect(shown.map((shownCard) => shownCard.id)).toEqual(["b"]);
  });
});
