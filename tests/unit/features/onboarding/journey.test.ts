import { describe, expect, it } from "vitest";
import {
  itemState,
  orderedPhaseItems,
  pathProgress,
  phaseItems,
  phaseState,
  waitingOn,
} from "../../../../src/features/onboarding/journey";
import { resolveNextAction } from "../../../../src/features/onboarding/nextAction";
import type {
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/features/onboarding/types";

function step(overrides: Partial<OnboardingStepEndpoint>): OnboardingStepEndpoint {
  return {
    id: "s",
    phaseId: "p",
    position: 0,
    title: "Step",
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...overrides,
  };
}

function question(overrides: Partial<OnboardingQuestionEndpoint>): OnboardingQuestionEndpoint {
  return {
    id: "q",
    phaseId: "p",
    position: 0,
    type: "SHORT_TEXT",
    question: "Why?",
    status: "OPEN",
    ...overrides,
  };
}

function phase(overrides: Partial<OnboardingPhaseEndpoint>): OnboardingPhaseEndpoint {
  return {
    id: "p",
    pathId: "path",
    position: 0,
    title: "Phase",
    description: "",
    locked: false,
    steps: [],
    questions: [],
    ...overrides,
  };
}

describe("onboarding journey vocabulary", () => {
  it("reads the state of steps and questions", () => {
    const [done, active, locked, open, retry] = phaseItems(
      phase({
        steps: [
          step({ id: "done", status: "FINISHED" }),
          step({ id: "active", position: 1, status: "IN_PROGRESS" }),
          step({ id: "locked", position: 2, locked: true }),
          step({ id: "open", position: 3 }),
        ],
        questions: [question({ id: "retry", status: "RETRY" })],
      }),
    );

    expect(itemState(done, false)).toBe("done");
    expect(itemState(active, false)).toBe("active");
    expect(itemState(locked, false)).toBe("locked");
    expect(itemState(open, false)).toBe("open");
    expect(itemState(retry, false)).toBe("retry");
    expect(itemState(open, true)).toBe("locked");
  });

  it("puts a question between the steps it sits between in the graph", () => {
    const ordered = orderedPhaseItems(
      phase({
        steps: [step({ id: "first" }), step({ id: "last", position: 1, blockerIds: ["check"] })],
        questions: [question({ id: "check", blockerIds: ["first"] })],
      }),
    );

    expect(ordered.map((item) => item.id)).toEqual(["first", "check", "last"]);
  });

  it("names only the unfinished blockers of a locked item", () => {
    const items = phaseItems(
      phase({
        steps: [
          step({ id: "a", status: "FINISHED", title: "Clone" }),
          step({ id: "b", position: 1, title: "Install" }),
          step({ id: "c", position: 2, locked: true, blockerIds: ["a", "b"] }),
        ],
      }),
    );

    expect(waitingOn(items[2], items).map((item) => item.title)).toEqual(["Install"]);
  });

  it("counts steps and questions alike, and phases that are complete", () => {
    const progress = pathProgress({
      id: "path",
      userId: "u",
      createdAt: "",
      phases: [
        phase({
          id: "p1",
          steps: [step({ status: "FINISHED" })],
          questions: [question({ status: "PASSED" })],
        }),
        phase({ id: "p2", steps: [step({ id: "x", estimatedMinutes: 25 })] }),
      ],
    });

    expect(progress).toMatchObject({ completed: 2, total: 3, phasesDone: 1, stepsDone: 1 });
  });

  it("tells started, untouched, locked and finished phases apart", () => {
    expect(phaseState(phase({ steps: [step({ status: "IN_PROGRESS" })] }))).toBe("active");
    expect(phaseState(phase({ steps: [step({})] }))).toBe("open");
    expect(phaseState(phase({ locked: true, steps: [step({})] }))).toBe("locked");
    expect(phaseState(phase({ steps: [step({ status: "FINISHED" })] }))).toBe("done");
    // The backend unlocks whatever waits on an empty phase, so it counts as done.
    expect(phaseState(phase({}))).toBe("done");
  });
});

describe("resolveNextAction", () => {
  const path = (phases: OnboardingPhaseEndpoint[]) => ({
    id: "path",
    userId: "u",
    createdAt: "",
    phases,
  });

  it("stays in the phase the member is in, even when an earlier phase is open too", () => {
    const second = phase({ id: "p2", position: 1, steps: [step({ id: "a", phaseId: "p2" })] });
    const third = phase({
      id: "p3",
      position: 2,
      steps: [
        step({ id: "b", phaseId: "p3", status: "FINISHED", completedAt: "2026-09-15T10:00:00Z" }),
        step({ id: "c", phaseId: "p3", position: 1 }),
      ],
    });

    const next = resolveNextAction(path([second, third]));

    expect(next).toMatchObject({ kind: "step", step: { id: "c" } });
    expect(
      resolveNextAction(path([second, third]) as never, { preferPhaseId: "p2" }),
    ).toMatchObject({ kind: "step", step: { id: "a" } });
  });

  it("lets the member choose when several untouched phases open at once", () => {
    const done = phase({ id: "p1", steps: [step({ id: "x", status: "FINISHED" })] });
    const left = phase({ id: "p2", position: 1, steps: [step({ id: "a" })] });
    const right = phase({ id: "p3", position: 2, steps: [step({ id: "b" })] });

    const next = resolveNextAction(path([done, left, right]));

    expect(next.kind).toBe("choose");
    expect(next.kind === "choose" && next.phases.map((candidate) => candidate.id)).toEqual([
      "p2",
      "p3",
    ]);
  });

  it("goes straight on when only one phase is open", () => {
    const open = phase({ id: "p1", steps: [step({ id: "a" })] });
    const locked = phase({ id: "p2", position: 1, locked: true, steps: [step({ id: "b" })] });

    expect(resolveNextAction(path([open, locked]) as never)).toMatchObject({
      kind: "step",
      step: { id: "a" },
    });
  });
});
