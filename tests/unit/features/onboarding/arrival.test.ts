import { describe, expect, it } from "vitest";
import { planArrival } from "../../../../src/features/onboarding/arrival";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/services/onboardingTypes";

function step(id: string, phaseId: string): OnboardingStepEndpoint {
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
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
  };
}

function question(id: string, phaseId: string): OnboardingQuestionEndpoint {
  return { id, phaseId, position: 2, type: "SHORT_TEXT", question: id, status: "OPEN" };
}

function phase(
  id: string,
  steps: OnboardingStepEndpoint[],
  questions: OnboardingQuestionEndpoint[] = [],
) {
  const built: OnboardingPhaseEndpoint = {
    id,
    pathId: "path",
    position: 1,
    title: id,
    description: "",
    steps,
    questions,
    locked: false,
  };
  return built;
}

const path: OnboardingPathEndpoint = {
  id: "path",
  userId: "u",
  createdAt: "2026-01-01T00:00:00Z",
  phases: [
    phase("p1", [step("a1", "p1")]),
    phase("p2", [step("b1", "p2")], [question("q1", "p2")]),
  ],
};

describe("planArrival", () => {
  it("asks for the chooser without looking at the path", () => {
    expect(planArrival({ kind: "choose", id: "" }, path, false)).toEqual({ type: "chooser" });
  });

  it("selects a linked phase that is on the path", () => {
    const plan = planArrival({ kind: "link-phase", id: "p2" }, path, false);

    expect(plan).toEqual({ type: "phase", phase: path.phases[1] });
  });

  it("says a linked phase is missing, and takes the link out of the address", () => {
    expect(planArrival({ kind: "link-phase", id: "gone" }, path, false)).toEqual({
      type: "missing",
      message: "That phase is not on your path",
      link: true,
    });
  });

  it("lands on a linked step in its phase, folded unless the link asks for it open", () => {
    expect(planArrival({ kind: "link-step", id: "b1" }, path, false)).toEqual({
      type: "land",
      phaseId: "p2",
      itemId: "b1",
      unfold: false,
    });
    expect(planArrival({ kind: "link-step", id: "b1" }, path, true)).toEqual({
      type: "land",
      phaseId: "p2",
      itemId: "b1",
      unfold: true,
    });
  });

  it("never unfolds a linked question, even when the link says open", () => {
    expect(planArrival({ kind: "link-question", id: "q1" }, path, true)).toEqual({
      type: "land",
      phaseId: "p2",
      itemId: "q1",
      unfold: false,
    });
  });

  it("opens a step or question by address", () => {
    const stepPlan = planArrival({ kind: "step", id: "a1" }, path, false);
    expect(stepPlan).toMatchObject({
      type: "open",
      phaseId: "p1",
      item: { id: "a1", kind: "step" },
    });

    const questionPlan = planArrival({ kind: "question", id: "q1" }, path, false);
    expect(questionPlan).toMatchObject({
      type: "open",
      phaseId: "p2",
      item: { id: "q1", kind: "question" },
    });
  });

  it.each([
    ["step", "That step is not on your path"],
    ["link-step", "That step is not on your path"],
    ["question", "That question is not on your path"],
    ["link-question", "That question is not on your path"],
  ] as const)("names a missing %s", (kind, message) => {
    expect(planArrival({ kind, id: "gone" }, path, false)).toEqual({
      type: "missing",
      message,
      link: false,
    });
  });
});
