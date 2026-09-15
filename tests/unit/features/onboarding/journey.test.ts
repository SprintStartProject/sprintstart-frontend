import { describe, expect, it } from "vitest";
import {
  itemState,
  orderedPhaseItems,
  pathProgress,
  phaseItems,
  phaseState,
  waitingOn,
} from "../../../../src/features/onboarding/journey";
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

    expect(progress).toMatchObject({ completed: 2, total: 3, phasesDone: 1, remainingMinutes: 25 });
  });

  it("marks the phase the member is in", () => {
    const current = phase({ id: "p1", steps: [step({})] });

    expect(phaseState(current, "p1")).toBe("current");
    expect(phaseState({ ...current, locked: true }, null)).toBe("locked");
    expect(phaseState(phase({ steps: [step({ status: "FINISHED" })] }), null)).toBe("done");
  });
});
