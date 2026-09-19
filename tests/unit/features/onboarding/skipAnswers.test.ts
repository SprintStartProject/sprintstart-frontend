import { describe, expect, it } from "vitest";
import { phaseItems } from "../../../../src/features/onboarding/journey.ts";
import {
  phaseHasUnseenSkipAnswer,
  unseenSkipAnswerCount,
  unseenSkipAnswerOf,
  withSkipAnswerSeen,
} from "../../../../src/features/onboarding/skipAnswers.ts";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepSkip,
} from "../../../../src/features/onboarding/types.ts";

function skip(over: Partial<OnboardingStepSkip>): OnboardingStepSkip {
  return {
    id: "skip-1",
    stepId: "step-1",
    reason: "Did it last week",
    accepted: null,
    reviewComment: null,
    reviewedAt: null,
    answerSeenAt: null,
    ...over,
  };
}

function phaseWith(stepSkip: OnboardingStepSkip | null): OnboardingPhaseEndpoint {
  return {
    id: "phase-1",
    pathId: "path-1",
    position: 0,
    title: "Setup",
    description: "",
    locked: false,
    questions: [],
    steps: [
      {
        id: "step-1",
        phaseId: "phase-1",
        position: 0,
        title: "Install",
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
        skip: stepSkip,
      },
    ],
  };
}

const itemOf = (phase: OnboardingPhaseEndpoint) => phaseItems(phase)[0];

describe("skip answers", () => {
  it("has no answer to show while the request is still waiting on the PM", () => {
    expect(unseenSkipAnswerOf(itemOf(phaseWith(skip({ accepted: null }))))).toBeNull();
  });

  it("names an approved and a declined answer until the member has seen it", () => {
    expect(unseenSkipAnswerOf(itemOf(phaseWith(skip({ accepted: true }))))).toBe("approved");
    expect(unseenSkipAnswerOf(itemOf(phaseWith(skip({ accepted: false }))))).toBe("declined");
    expect(
      unseenSkipAnswerOf(itemOf(phaseWith(skip({ accepted: true, answerSeenAt: "2026-09-18" })))),
    ).toBeNull();
  });

  it("marks the phase and counts across the path", () => {
    const answered = phaseWith(skip({ accepted: false }));

    expect(phaseHasUnseenSkipAnswer(answered)).toBe(true);
    expect(phaseHasUnseenSkipAnswer(phaseWith(null))).toBe(false);
    expect(unseenSkipAnswerCount([answered, phaseWith(null)])).toBe(1);
  });

  it("marks one answer seen without touching the rest of the path", () => {
    const path: OnboardingPathEndpoint = {
      id: "path-1",
      userId: "hire",
      createdAt: "",
      phases: [phaseWith(skip({ accepted: true }))],
    };

    const next = withSkipAnswerSeen(path, "skip-1", "2026-09-19T10:00:00Z");

    expect(next.phases[0].steps[0].skip?.answerSeenAt).toBe("2026-09-19T10:00:00Z");
    expect(path.phases[0].steps[0].skip?.answerSeenAt).toBeNull();
    expect(unseenSkipAnswerCount(next.phases)).toBe(0);
  });
});
