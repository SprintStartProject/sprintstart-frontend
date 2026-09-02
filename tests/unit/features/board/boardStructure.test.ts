import { describe, it, expect } from "vitest";
import {
  currentStage,
  deriveCardStates,
  isCardDone,
  readBoardStructure,
  setDependency,
  pruneStructure,
  writeBoardStructure,
  type BoardStructure,
} from "../../../../src/features/board/layout/boardStructure";
import type { BoardCard, ChecklistContent } from "../../../../src/features/board/types";

const EMPTY: BoardStructure = { cards: {}, groupStages: {} };

function checklist(id: string, items: { text: string; done: boolean }[]): BoardCard {
  const content: ChecklistContent = {
    kind: "CHECKLIST",
    title: id,
    items: items.map((item, index) => ({ id: `${id}-${index}`, ...item })),
  };

  return { id, kind: "CHECKLIST", owner: "HIRE", position: 0, placedAt: null, content };
}

function note(id: string): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text: "something" },
  };
}

function structure(cards: BoardStructure["cards"]): BoardStructure {
  return { cards, groupStages: {} };
}

describe("isCardDone", () => {
  it("counts a fully ticked checklist as done", () => {
    const card = checklist("a", [{ text: "one", done: true }]);

    expect(isCardDone(card, EMPTY)).toBe(true);
  });

  it("does not count an empty checklist as done", () => {
    // Zero of zero is a list nobody has written yet. Calling it finished would let a blank card
    // unblock everything behind it.
    expect(isCardDone(checklist("a", []), EMPTY)).toBe(false);
  });

  it("ignores a hand-set done on a card that reports its own progress", () => {
    const card = checklist("a", [{ text: "one", done: false }]);

    expect(isCardDone(card, structure({ a: { markedDone: true } }))).toBe(false);
  });

  it("honours a hand-set done on a card that cannot report", () => {
    expect(isCardDone(note("a"), structure({ a: { markedDone: true } }))).toBe(true);
  });
});

describe("deriveCardStates", () => {
  it("blocks a card whose predecessor is unfinished, and names it", () => {
    const first = checklist("first", [{ text: "one", done: false }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({ second: { dependsOn: ["first"] } }),
    );

    expect(states.get("second")?.status).toBe("BLOCKED");
    expect(states.get("second")?.blockedBy.map((card) => card.id)).toEqual(["first"]);
  });

  it("unblocks a card once its predecessor is finished, keeping the sequence visible", () => {
    const first = checklist("first", [{ text: "one", done: true }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({ second: { dependsOn: ["first"] } }),
    );

    expect(states.get("second")?.status).toBe("OPEN");
    // The block is gone; the arrangement is not, or the picker would forget it.
    expect(states.get("second")?.predecessorId).toBe("first");
  });

  it("ignores a dependency on a card that has left the board", () => {
    const only = checklist("only", [{ text: "one", done: false }]);

    const states = deriveCardStates([only], structure({ only: { dependsOn: ["dismissed"] } }));

    expect(states.get("only")?.status).toBe("OPEN");
  });

  it("defaults an unsequenced card to the first stage", () => {
    const states = deriveCardStates([note("a")], EMPTY);

    expect(states.get("a")?.stage).toBe("NOW");
  });
});

describe("currentStage", () => {
  it("moves on once everything in a stage is finished", () => {
    const done = checklist("done", [{ text: "one", done: true }]);
    const later = checklist("later", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [done, later],
      structure({ done: { stage: "NOW" }, later: { stage: "LATER" } }),
    );

    expect(currentStage(states)).toBe("LATER");
  });

  it("stays on a stage whose only open card is blocked", () => {
    // Blocked is not finished. A hire waiting on something is still in that stage.
    const first = checklist("first", [{ text: "one", done: false }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({
        first: { stage: "NOW" },
        second: { stage: "NOW", dependsOn: ["first"] },
      }),
    );

    expect(currentStage(states)).toBe("NOW");
  });
});

describe("setDependency", () => {
  it("refuses an edge that would close a loop", () => {
    const chained = setDependency(EMPTY, "b", "a", true);
    const looped = setDependency(chained, "a", "b", true);

    expect(looped.cards.a?.dependsOn ?? []).toEqual([]);
  });

  it("refuses to make a card wait on itself", () => {
    expect(setDependency(EMPTY, "a", "a", true).cards.a?.dependsOn ?? []).toEqual([]);
  });

  it("removes an edge when asked to", () => {
    const chained = setDependency(EMPTY, "b", "a", true);

    expect(setDependency(chained, "b", "a", false).cards.b?.dependsOn).toEqual([]);
  });
});

describe("pruneStructure", () => {
  it("forgets cards that are gone, and edges pointing at them", () => {
    const stored = structure({
      kept: { stage: "LATER", dependsOn: ["gone"] },
      gone: { stage: "NOW" },
    });

    const pruned = pruneStructure(stored, new Set(["kept"]));

    expect(Object.keys(pruned.cards)).toEqual(["kept"]);
    expect(pruned.cards.kept.dependsOn).toEqual([]);
  });
});

describe("storage", () => {
  it("round-trips a structure", () => {
    const stored = structure({ a: { stage: "LATER", dependsOn: ["b"], markedDone: true } });
    writeBoardStructure("board-1", stored);

    expect(readBoardStructure("board-1")).toEqual(stored);
  });

  it("returns nothing rather than throwing on rubbish in storage", () => {
    window.localStorage.setItem("sprintstart:board-structure:board-2", "{not json");

    expect(readBoardStructure("board-2")).toEqual(EMPTY);
  });

  it("reads a stage written before there were two of them as 'not now'", () => {
    window.localStorage.setItem(
      "sprintstart:board-structure:board-4",
      JSON.stringify({
        version: 1,
        structure: { cards: { a: { stage: "NEXT" } }, groupStages: { g1: "NEXT" } },
      }),
    );

    // Dropping it would fall back to the default, `NOW` — so every card somebody deliberately
    // deferred would arrive on top of the pile, which is the worst of the available answers.
    expect(readBoardStructure("board-4")).toEqual({
      cards: { a: { stage: "LATER" } },
      groupStages: { g1: "LATER" },
    });
  });

  it("drops entries it does not recognise instead of trusting them", () => {
    window.localStorage.setItem(
      "sprintstart:board-structure:board-3",
      JSON.stringify({
        version: 1,
        structure: { cards: { a: { stage: "YESTERDAY", dependsOn: [7] } }, groupStages: {} },
      }),
    );

    expect(readBoardStructure("board-3")).toEqual(structure({ a: { dependsOn: [] } }));
  });
});
