import { describe, it, expect } from "vitest";
import {
  currentStage,
  deriveCardStates,
  isCardDone,
  readBoardStructure,
  setDependency,
  pruneStructure,
  restack,
  writeBoardStructure,
  type BoardStructure,
} from "../../../../src/features/board/layout/boardStructure";
import type {
  BoardCard,
  ChecklistContent,
  PathStepContent,
} from "../../../../src/features/board/types";

const EMPTY: BoardStructure = { cards: {}, groupStages: {} };

function checklist(id: string, items: { text: string; done: boolean }[]): BoardCard {
  const content: ChecklistContent = {
    kind: "CHECKLIST",
    title: id,
    items: items.map((item, index) => ({ id: `${id}-${index}`, ...item })),
  };

  return { id, kind: "CHECKLIST", owner: "HIRE", position: 0, placedAt: null, content };
}

function pathStep(id: string, tasks: { finished: boolean }[]): BoardCard {
  const content: PathStepContent = {
    kind: "PATH_STEP",
    stepId: "step-1",
    phaseTitle: null,
    title: null,
    description: null,
    status: null,
    isAiAssisted: true,
    expectedOutcomes: [],
    tasks: tasks.map((task, index) => ({
      id: `${id}-${index}`,
      stepId: "step-1",
      position: index,
      title: `task ${index}`,
      description: "",
      finished: task.finished,
    })),
    resources: [],
    reason: null,
  };

  return { id, kind: "PATH_STEP", owner: "AI", position: 0, placedAt: null, content };
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

/** Dependencies as the hire's own controls write them. */
const after = (...ids: string[]) => ids.map((id) => ({ id, source: "HIRE" as const }));

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

  it("ignores a hand-set done on a card that cannot report — there is no tick to undo it with", () => {
    expect(isCardDone(note("a"), structure({ a: { markedDone: true } }))).toBe(false);
  });

  it("counts a fully ticked path step as done", () => {
    const card = pathStep("a", [{ finished: true }, { finished: true }]);

    expect(isCardDone(card, EMPTY)).toBe(true);
  });

  it("does not call a path step with no tasks done, ticked or not", () => {
    const card = pathStep("a", []);

    expect(isCardDone(card, EMPTY)).toBe(false);
    expect(isCardDone(card, structure({ a: { markedDone: true } }))).toBe(false);
  });

  it("ignores a hand-set done on a path step that has tasks to report", () => {
    const card = pathStep("a", [{ finished: false }]);

    expect(isCardDone(card, structure({ a: { markedDone: true } }))).toBe(false);
  });
});

describe("deriveCardStates", () => {
  it("reads a stored comes-after as a place in a pile, not as a block", () => {
    const first = checklist("first", [{ text: "one", done: false }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({ second: { dependsOn: after("first") } }),
    );

    expect(states.get("second")?.status).toBe("OPEN");
    expect(states.get("second")?.blockedBy).toEqual([]);
    expect(states.get("second")?.predecessorId).toBe("first");
  });

  it("unblocks a card once its predecessor is finished, keeping the sequence visible", () => {
    const first = checklist("first", [{ text: "one", done: true }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({ second: { dependsOn: after("first") } }),
    );

    expect(states.get("second")?.status).toBe("OPEN");
    // The block is gone; the arrangement is not, or the picker would forget it.
    expect(states.get("second")?.predecessorId).toBe("first");
  });

  it("ignores a dependency on a card that has left the board", () => {
    const only = checklist("only", [{ text: "one", done: false }]);

    const states = deriveCardStates([only], structure({ only: { dependsOn: after("dismissed") } }));

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

    const states = deriveCardStates([done, later], structure({}), (card) =>
      card.id === "later" ? "BEHIND" : "NOW",
    );

    expect(currentStage(states)).toBe("BEHIND");
  });

  it("stays on a stage whose only open card is blocked", () => {
    // Blocked is not finished. A hire waiting on something is still in that stage.
    const first = checklist("first", [{ text: "one", done: false }]);
    const second = checklist("second", [{ text: "two", done: false }]);

    const states = deriveCardStates(
      [first, second],
      structure({
        first: { stage: "NOW" },
        second: { stage: "NOW", dependsOn: after("first") },
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
      kept: { stage: "LATER", dependsOn: after("gone") },
      gone: { stage: "NOW" },
    });

    const pruned = pruneStructure(stored, new Set(["kept"]));

    expect(Object.keys(pruned.cards)).toEqual(["kept"]);
    expect(pruned.cards.kept.dependsOn).toEqual([]);
  });
});

describe("storage", () => {
  it("round-trips a structure", () => {
    const stored = structure({ a: { stage: "LATER", dependsOn: after("b"), markedDone: true } });
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

describe("who put a card behind another one", () => {
  it("reads a dependency written before there were sources as the hire's own", () => {
    window.localStorage.setItem(
      "sprintstart:board-structure:board-5",
      JSON.stringify({
        version: 1,
        structure: { cards: { b: { dependsOn: ["a"] } }, groupStages: {} },
      }),
    );

    // Never as the team's: guessing that way would retroactively lock every sequence a hire ever
    // dragged together, on boards where nobody can say where those sequences came from.
    expect(readBoardStructure("board-5")).toEqual(structure({ b: { dependsOn: after("a") } }));
  });

  it("round-trips a source it does know", () => {
    const stored = structure({ b: { dependsOn: [{ id: "a", source: "TEAM" }] } });
    writeBoardStructure("board-6", stored);

    expect(readBoardStructure("board-6")).toEqual(stored);
  });

  it("reads a source it does not know as the hire's own", () => {
    window.localStorage.setItem(
      "sprintstart:board-structure:board-7",
      JSON.stringify({
        version: 1,
        structure: { cards: { b: { dependsOn: [{ id: "a", source: "MANAGEMENT" }] } } },
      }),
    );

    expect(readBoardStructure("board-7")).toEqual(structure({ b: { dependsOn: after("a") } }));
  });

  it("says who set the predecessor it reports", () => {
    const first = note("first");
    const second = note("second");

    const states = deriveCardStates(
      [first, second],
      structure({ second: { dependsOn: [{ id: "first", source: "TEAM" }] } }),
    );

    expect(states.get("second")?.predecessorSource).toBe("TEAM");
    expect(states.get("first")?.predecessorSource).toBeNull();
  });

  it("keeps a rule the team wrote when something asks to remove it", () => {
    const ruled = structure({ b: { dependsOn: [{ id: "a", source: "TEAM" }] } });

    expect(setDependency(ruled, "b", "a", false).cards.b?.dependsOn).toEqual([
      { id: "a", source: "TEAM" },
    ]);
  });

  it("lets a buddy's link go, because a suggestion is not a rule", () => {
    const suggested = structure({ b: { dependsOn: [{ id: "a", source: "BUDDY" }] } });

    expect(setDependency(suggested, "b", "a", false).cards.b?.dependsOn).toEqual([]);
  });
});

describe("restack", () => {
  const ids = ["a", "b", "c", "d"];
  const under = (from: BoardStructure, id: string) => from.cards[id]?.dependsOn?.[0]?.id ?? null;

  it("leaves a neighbour's edge with whoever put it there", () => {
    // A team pile a ← b ← c; the hire takes b out. c closes the gap onto a, still the team's.
    const team = structure({
      b: { dependsOn: [{ id: "a", source: "TEAM" }] },
      c: { dependsOn: [{ id: "b", source: "TEAM" }] },
    });
    const next = restack(team, ids, "b", null);

    expect(next.cards.c?.dependsOn).toEqual([{ id: "a", source: "TEAM" }]);
    expect(next.cards.b?.dependsOn).toEqual([]);
    expect(restack(team, ids, "d", "a").cards.d?.dependsOn).toEqual([{ id: "a", source: "HIRE" }]);
    expect(restack(team, ids, "d", "a").cards.b?.dependsOn).toEqual([{ id: "d", source: "TEAM" }]);
  });

  it("puts a card directly under another, and what lay under that one under it", () => {
    let piled = restack(EMPTY, ids, "b", "a");
    piled = restack(piled, ids, "c", "a");

    expect(under(piled, "c")).toBe("a");
    expect(under(piled, "b")).toBe("c");
  });

  it("closes the gap when a card is taken out of the middle of a pile", () => {
    let piled = restack(EMPTY, ids, "b", "a");
    piled = restack(piled, ids, "c", "b");
    piled = restack(piled, ids, "b", null);

    expect(under(piled, "b")).toBeNull();
    expect(under(piled, "c")).toBe("a");
  });

  it("moves a card from one pile to another", () => {
    let piled = restack(EMPTY, ids, "b", "a");
    piled = restack(piled, ids, "b", "d");

    expect(under(piled, "b")).toBe("d");
  });
});
