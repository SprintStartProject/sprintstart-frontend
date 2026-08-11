import { describe, it, expect } from "vitest";
import { findActivePhaseIndex, isPhaseOpen } from "../../../../src/features/onboarding/activePhase";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
  StepStatus,
} from "../../../../src/features/onboarding/types";

function makeStep(status: StepStatus): OnboardingStepEndpoint {
  return {
    id: `step-${status}-${Math.random()}`,
    phaseId: "phase",
    position: 0,
    title: "Step",
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

function makePhase(
  id: string,
  steps: StepStatus[],
  check: { required: boolean; passed: boolean },
): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: 0,
    title: id,
    description: "",
    locked: false,
    unlockReason: null,
    checkSummary: {
      required: check.required,
      questionCount: check.required ? 3 : 0,
      passed: check.passed,
      latestAttemptId: null,
      latestAttemptAt: null,
    },
    steps: steps.map(makeStep),
  };
}

function makePath(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path", userId: "user", createdAt: "2026-07-30T10:00:00Z", phases };
}

const done = { required: false, passed: false };
const openCheck = { required: true, passed: false };
const passedCheck = { required: true, passed: true };

describe("isPhaseOpen", () => {
  it("is open while any step is unfinished", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "IN_PROGRESS"], done))).toBe(true);
  });

  it("is open when every step is done but the knowledge check is not passed", () => {
    // The case that used to send users past the check they were sitting in front of.
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "SKIPPED"], openCheck))).toBe(true);
  });

  it("is closed when every step is done and the check is passed", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "SKIPPED"], passedCheck))).toBe(false);
  });

  it("is closed when every step is done and there is no check", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED"], done))).toBe(false);
  });
});

describe("findActivePhaseIndex", () => {
  it("picks the first phase that still has an open step", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], passedCheck),
      makePhase("two", ["WAITING"], done),
      makePhase("three", ["WAITING"], done),
    ]);

    expect(findActivePhaseIndex(path)).toBe(1);
  });

  it("stays on the phase whose knowledge check is still open", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], passedCheck),
      makePhase("two", ["FINISHED", "FINISHED"], openCheck),
      makePhase("three", ["WAITING"], done),
    ]);

    // Going by steps alone would jump to phase three, which is locked behind that check.
    expect(findActivePhaseIndex(path)).toBe(1);
  });

  it("falls back to the last phase when the whole journey is done", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], passedCheck),
      makePhase("two", ["FINISHED"], passedCheck),
    ]);

    expect(findActivePhaseIndex(path)).toBe(1);
  });
});
