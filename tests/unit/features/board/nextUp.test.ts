import { describe, expect, it } from "vitest";

import { nextUp } from "../../../../src/features/board/layout/nextUp";
import type { CardState } from "../../../../src/features/board/layout/boardStructure";
import type { BoardCard } from "../../../../src/features/board/types";

function note(id: string, text: string): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text },
  };
}

function state(over: Partial<CardState> = {}): CardState {
  return {
    status: "OPEN",
    stage: "NOW",
    blockedBy: [],
    predecessorId: null,
    predecessorSource: null,
    progress: null,
    ...over,
  };
}

/** Eight is the fold threshold; below it the board says nothing. */
const crowded = { crowded: true };

describe("the one card to start with", () => {
  it("says nothing on a board somebody can read at a glance", () => {
    const cards = [note("c1", "one"), note("c2", "two")];
    const states = new Map(cards.map((card) => [card.id, state()]));

    expect(nextUp(cards, states, { crowded: false })).toBeNull();
  });

  it("says nothing when there is nothing to do", () => {
    const cards = [note("c1", "one"), note("c2", "two")];
    const states = new Map([
      ["c1", state({ status: "DONE" })],
      ["c2", state({ status: "BLOCKED", blockedBy: [note("c9", "waiting on this")] })],
    ]);

    expect(nextUp(cards, states, crowded)).toBeNull();
  });

  it("still answers when exactly one card is open", () => {
    // The tempting guard is to stay quiet here — a line pointing at the only thing you can do looks
    // like it is pointing at itself. On a crowded board it is the opposite: nineteen cards waiting
    // on the twentieth is the single most useful moment to say which one it is.
    const first = note("c1", "first");
    const cards = [first, note("c2", "waits")];
    const states = new Map([
      ["c1", state()],
      ["c2", state({ status: "BLOCKED", blockedBy: [first] })],
    ]);

    expect(nextUp(cards, states, crowded)?.card.id).toBe("c1");
  });

  it("takes the first card in the hire's own order that they can actually do", () => {
    const cards = [note("c1", "blocked"), note("c2", "open"), note("c3", "also open")];
    const states = new Map([
      ["c1", state({ status: "BLOCKED", blockedBy: [note("c9", "waiting on this")] })],
      ["c2", state()],
      ["c3", state()],
    ]);

    expect(nextUp(cards, states, crowded)?.card.id).toBe("c2");
  });

  it("does not send anybody to something they put aside", () => {
    // LATER is the hire or their PM having said "not yet"; starting there would point at a card
    // somebody has already decided about.
    const cards = [note("c1", "later"), note("c2", "now")];
    const states = new Map([
      ["c1", state({ stage: "LATER" })],
      ["c2", state({ stage: "NOW" })],
    ]);

    expect(nextUp(cards, states, crowded)?.card.id).toBe("c2");
  });

  it("counts only the cards this one alone is holding up", () => {
    const first = note("c1", "first");
    const other = note("c9", "something else");
    const cards = [first, note("c2", "waits on c1"), note("c3", "waits on both"), other];
    const states = new Map([
      ["c1", state()],
      ["c2", state({ status: "BLOCKED", blockedBy: [first] })],
      ["c3", state({ status: "BLOCKED", blockedBy: [first, other] })],
      ["c9", state({ status: "DONE" })],
    ]);

    // c3 would still be blocked afterwards, so finishing c1 does not free it — counting it would
    // make the line promise more than doing the work delivers.
    expect(nextUp(cards, states, crowded)?.unblocks).toBe(1);
  });

  it("says nothing about waiting when nothing is", () => {
    const cards = [note("c1", "one"), note("c2", "two")];
    const states = new Map(cards.map((card) => [card.id, state()]));

    expect(nextUp(cards, states, crowded)?.unblocks).toBe(0);
  });
});
