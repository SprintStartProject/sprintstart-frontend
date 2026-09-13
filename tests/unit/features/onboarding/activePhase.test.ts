import { describe, it, expect } from "vitest";
import { findActivePhaseIndex, isPhaseOpen } from "../../../../src/features/onboarding/activePhase";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
  QuestionStatus,
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

function makeQuestion(status: QuestionStatus): OnboardingQuestionEndpoint {
  return {
    id: `q-${status}-${Math.random()}`,
    phaseId: "phase",
    position: 0,
    type: "MULTIPLE_CHOICE",
    question: "Q",
    status,
  };
}

function makePhase(
  id: string,
  steps: StepStatus[],
  questions: QuestionStatus[],
): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: 0,
    title: id,
    description: "",
    locked: false,
    steps: steps.map(makeStep),
    questions: questions.map(makeQuestion),
  };
}

function makePath(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path", userId: "user", createdAt: "2026-07-30T10:00:00Z", phases };
}

describe("isPhaseOpen", () => {
  it("is open while any step is unfinished", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "IN_PROGRESS"], []))).toBe(true);
  });

  it("is open when every step is done but a question is not passed", () => {
    // The case that used to send users past the check they were sitting in front of.
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "SKIPPED"], ["OPEN"]))).toBe(true);
  });

  it("is closed when every step is done and every question is passed", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED", "SKIPPED"], ["PASSED"]))).toBe(false);
  });

  it("is closed when every step is done and there are no questions", () => {
    expect(isPhaseOpen(makePhase("p", ["FINISHED"], []))).toBe(false);
  });
});

describe("findActivePhaseIndex", () => {
  it("picks the first phase that still has an open step", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], ["PASSED"]),
      makePhase("two", ["WAITING"], []),
      makePhase("three", ["WAITING"], []),
    ]);

    expect(findActivePhaseIndex(path)).toBe(1);
  });

  it("stays on the phase whose question is still open", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], ["PASSED"]),
      makePhase("two", ["FINISHED", "FINISHED"], ["OPEN"]),
      makePhase("three", ["WAITING"], []),
    ]);

    // Going by steps alone would jump to phase three, which is locked behind that question.
    expect(findActivePhaseIndex(path)).toBe(1);
  });

  it("falls back to the last phase when the whole journey is done", () => {
    const path = makePath([
      makePhase("one", ["FINISHED"], ["PASSED"]),
      makePhase("two", ["FINISHED"], ["PASSED"]),
    ]);

    expect(findActivePhaseIndex(path)).toBe(1);
  });
});
