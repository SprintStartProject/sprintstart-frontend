import { describe, expect, it } from "vitest";
import {
  actualMinutesOf,
  blankStepRequest,
  currentPhase,
  focusOf,
  listPlacement,
  minutesOverEstimate,
  rowTone,
  sameBlockers,
  stagesOf,
  withBlocker,
  withoutBlocker,
} from "../../../../../../src/features/team-management/components/detail/journey/journeyRules";
import { phaseItems } from "../../../../../../src/features/onboarding/journey";
import type {
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../../../../../../src/features/onboarding/types";

function step(over: Partial<OnboardingStepEndpoint>): OnboardingStepEndpoint {
  return {
    id: "s",
    phaseId: "p1",
    position: 0,
    title: "Step",
    description: "",
    type: "TASK",
    estimatedMinutes: 30,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    blockerIds: [],
    ...over,
  };
}

function phase(id: string, steps: OnboardingStepEndpoint[], over = {}): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: 0,
    title: id,
    description: "",
    locked: false,
    steps,
    questions: [],
    blockerIds: [],
    ...over,
  };
}

const a = step({ id: "a", position: 0, status: "FINISHED" });
const b = step({ id: "b", position: 1, blockerIds: ["a"] });
const c = step({ id: "c", position: 2, blockerIds: ["b"] });
const d = step({ id: "d", position: 3, blockerIds: ["a"] });
const chain = phase("p1", [a, b, c, d]);

const item = (id: string, source = chain) => phaseItems(source).find((entry) => entry.id === id)!;

describe("actualMinutesOf", () => {
  it("is the time between start and end, at least a minute", () => {
    const took = step({ startedAt: "2026-01-01T10:00:00Z", completedAt: "2026-01-01T10:45:00Z" });
    const quick = step({ startedAt: "2026-01-01T10:00:00Z", completedAt: "2026-01-01T10:00:05Z" });

    expect(actualMinutesOf(item("x", phase("p", [{ ...took, id: "x" }])))).toBe(45);
    expect(actualMinutesOf(item("x", phase("p", [{ ...quick, id: "x" }])))).toBe(1);
  });

  it("is none for a step without both times, and for a question", () => {
    const open = step({ id: "x", startedAt: "2026-01-01T10:00:00Z" });
    expect(actualMinutesOf(item("x", phase("p", [open])))).toBeNull();
    expect(
      actualMinutesOf(item("x", phase("p", [step({ id: "x", completedAt: "t" })]))),
    ).toBeNull();

    const question = {
      kind: "question",
      id: "q",
      title: "Q",
      blockerIds: [],
      graphX: null,
      graphY: null,
      position: 0,
      question: {},
    } as unknown as Parameters<typeof actualMinutesOf>[0];
    expect(actualMinutesOf(question)).toBeNull();
  });
});

describe("minutesOverEstimate", () => {
  const timed = (estimate: number, minutes: number) =>
    item(
      "x",
      phase("p", [
        step({
          id: "x",
          estimatedMinutes: estimate,
          startedAt: "2026-01-01T10:00:00Z",
          completedAt: new Date(Date.parse("2026-01-01T10:00:00Z") + minutes * 60000).toISOString(),
        }),
      ]),
    );

  it("is positive over the estimate and negative under it", () => {
    expect(minutesOverEstimate(timed(30, 45))).toBe(15);
    expect(minutesOverEstimate(timed(30, 20))).toBe(-10);
    expect(minutesOverEstimate(timed(30, 30))).toBe(0);
  });

  it("is none without an estimate or without timing", () => {
    expect(minutesOverEstimate(timed(0, 20))).toBeNull();
    expect(minutesOverEstimate(item("a"))).toBeNull();
  });
});

describe("stagesOf", () => {
  it("groups the items by how deep they sit in the dependencies", () => {
    expect(stagesOf(chain).map((stage) => stage.map((entry) => entry.id))).toEqual([
      ["a"],
      ["b", "d"],
      ["c"],
    ]);
  });

  it("is empty for a phase with nothing in it", () => {
    expect(stagesOf(phase("empty", []))).toEqual([]);
  });
});

describe("blankStepRequest", () => {
  it("makes a blank task of half an hour at the asked place", () => {
    expect(
      blankStepRequest(chain, {
        position: 2,
        waitsOn: ["a"],
        unlocks: ["c"],
        graphX: 5,
        graphY: 6,
      }),
    ).toEqual({
      step: {
        position: 2,
        title: "New step",
        description: "",
        type: "TASK",
        estimatedMinutes: 30,
        expectedOutcome: "",
      },
      waitsOn: ["a"],
      unlocks: ["c"],
      graphX: 5,
      graphY: 6,
    });
  });

  it("never puts the step beyond the end of the phase", () => {
    expect(blankStepRequest(chain, { position: 99, waitsOn: [], unlocks: [] }).step.position).toBe(
      4,
    );
  });
});

describe("listPlacement", () => {
  it("puts a step after an item, in between it and what waited on it", () => {
    expect(listPlacement(chain, item("a"))).toEqual({
      position: 1,
      waitsOn: ["a"],
      unlocks: ["b", "d"],
    });
    expect(listPlacement(chain, item("c"))).toEqual({ position: 3, waitsOn: ["c"], unlocks: [] });
  });

  it("puts a step at the end after everything nothing else waits on", () => {
    expect(listPlacement(chain, null)).toEqual({ position: 4, waitsOn: ["c", "d"], unlocks: [] });
  });

  it("starts an empty phase", () => {
    expect(listPlacement(phase("empty", []), null)).toEqual({
      position: 0,
      waitsOn: [],
      unlocks: [],
    });
  });
});

describe("blockers", () => {
  it("adds one once, and takes one away", () => {
    expect(withBlocker(["a"], "b")).toEqual(["a", "b"]);
    const same = ["a"];
    expect(withBlocker(same, "a")).toBe(same);
    expect(withoutBlocker(["a", "b"], "a")).toEqual(["b"]);
    expect(withoutBlocker(["a"], "x")).toEqual(["a"]);
  });

  it("compares lists in order", () => {
    expect(sameBlockers(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameBlockers(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameBlockers(["a"], ["a", "b"])).toBe(false);
    expect(sameBlockers([], [])).toBe(true);
  });
});

describe("focusOf", () => {
  it("names the phase and the item the member is at", () => {
    expect(focusOf({ kind: "step", phase: { id: "p1" }, step: { id: "s1" } } as never)).toEqual({
      focusPhaseId: "p1",
      nextItemId: "s1",
    });
    expect(
      focusOf({ kind: "question", phase: { id: "p2" }, question: { id: "q1" } } as never),
    ).toEqual({ focusPhaseId: "p2", nextItemId: "q1" });
  });

  it("names nothing when nothing is next", () => {
    const none = { focusPhaseId: null, nextItemId: null };
    expect(focusOf(null)).toEqual(none);
    expect(focusOf({ kind: "done" } as never)).toEqual(none);
  });
});

describe("currentPhase", () => {
  const done = phase("done", [step({ id: "x", status: "FINISHED" })], { position: 0 });
  const open = phase("open", [step({ id: "y" })], { position: 1 });
  const later = phase("later", [step({ id: "z" })], { position: 2 });
  const phases = [done, open, later];

  it("prefers the one picked, then the one the member is at, then the first not done", () => {
    expect(currentPhase(phases, "later", "open")).toBe(later);
    expect(currentPhase(phases, null, "later")).toBe(later);
    expect(currentPhase(phases, null, null)).toBe(open);
    expect(currentPhase(phases, "gone", "gone")).toBe(open);
  });

  it("falls back to the first when every phase is done", () => {
    expect(currentPhase([done], null, null)).toBe(done);
  });

  it("is none without phases", () => {
    expect(currentPhase([], null, null)).toBeUndefined();
  });
});

describe("rowTone", () => {
  it("tells the four kinds of row apart", () => {
    const tones = [
      rowTone(true, false, false),
      rowTone(false, true, true),
      rowTone(false, true, false),
      rowTone(false, false, true),
      rowTone(false, false, false),
    ];
    expect(new Set(tones).size).toBe(5);
    expect(tones[0]).toContain("shadow-lg");
    expect(tones[1]).toContain("question-solid");
    expect(tones[2]).toContain("question-border");
    expect(tones[3]).toContain("app-brand ");
    expect(tones[4]).toContain("border-transparent");
  });

  it("lets a step being named win over everything", () => {
    expect(rowTone(true, true, true)).toBe(rowTone(true, false, false));
  });
});
