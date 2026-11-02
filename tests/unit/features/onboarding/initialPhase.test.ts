import { describe, expect, it } from "vitest";
import { initialPhaseId } from "../../../../src/features/onboarding/initialPhase";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
  StepStatus,
} from "../../../../src/features/onboarding/types";

function step(id: string, phaseId: string, status: StepStatus): OnboardingStepEndpoint {
  return {
    id,
    phaseId,
    position: 1,
    title: id,
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
  };
}

function phase(id: string, position: number, steps: OnboardingStepEndpoint[]) {
  return {
    id,
    pathId: "path",
    position,
    title: id,
    description: "",
    steps,
    questions: [],
    locked: false,
  } as OnboardingPhaseEndpoint;
}

function pathOf(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path", userId: "u", createdAt: "2026-01-01T00:00:00Z", phases };
}

const done = phase("done", 1, [step("d1", "done", "FINISHED")]);
const open = phase("open", 2, [step("o1", "open", "WAITING")]);
const other = phase("other", 3, [step("x1", "other", "WAITING")]);

describe("initialPhaseId", () => {
  it("opens the phase the visit named, over everything else", () => {
    const phases = [done, open, other];

    expect(initialPhaseId(pathOf(phases), phases, "o1", "other")).toBe("other");
  });

  it("ignores a named phase that is not on the path", () => {
    const phases = [done, open];

    expect(initialPhaseId(pathOf(phases), phases, undefined, "gone")).toBe("open");
  });

  it("opens the phase holding the item the visit was sent for", () => {
    const phases = [done, open, other];

    expect(initialPhaseId(pathOf(phases), phases, "x1", undefined)).toBe("other");
  });

  it("falls through when the item is not on the path", () => {
    const phases = [done, open];

    expect(initialPhaseId(pathOf(phases), phases, "gone", undefined)).toBe("open");
  });

  it("opens the phase with the next thing to do", () => {
    const phases = [done, open];

    expect(initialPhaseId(pathOf(phases), phases, undefined, undefined)).toBe("open");
  });

  it("opens the first of the phases to choose between", () => {
    const phases = [done, open, other];

    expect(initialPhaseId(pathOf(phases), phases, undefined, undefined)).toBe("open");
  });

  it("opens the last phase when everything is done", () => {
    const second = phase("second", 2, [step("s1", "second", "FINISHED")]);
    const phases = [done, second];

    expect(initialPhaseId(pathOf(phases), phases, undefined, undefined)).toBe("second");
  });

  it("opens the first phase that is not done when nothing can be started", () => {
    const locked = { ...open, locked: true } as OnboardingPhaseEndpoint;
    const phases = [done, locked];

    expect(initialPhaseId(pathOf(phases), phases, undefined, undefined)).toBe("open");
  });

  it("has no phase for an empty path", () => {
    expect(initialPhaseId(pathOf([]), [], undefined, undefined)).toBe("");
  });
});
