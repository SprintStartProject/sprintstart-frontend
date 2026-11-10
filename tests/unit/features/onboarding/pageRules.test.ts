import { describe, expect, it } from "vitest";
import { celebrationAfter, continueAfter } from "../../../../src/features/onboarding/pageRules";
import { placeOf } from "../../../../src/features/onboarding/hooks/useOnboardingPlace";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
  QuestionAttemptResult,
  QuestionStatus,
  StepStatus,
} from "../../../../src/features/onboarding/types";

function step(id: string, phaseId: string, status: StepStatus): OnboardingStepEndpoint {
  return {
    id,
    phaseId,
    position: 1,
    title: `Title ${id}`,
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

function question(id: string, phaseId: string, status: QuestionStatus): OnboardingQuestionEndpoint {
  return { id, phaseId, position: 2, type: "SHORT_TEXT", question: id, status };
}

function phase(
  id: string,
  steps: OnboardingStepEndpoint[],
  questions: OnboardingQuestionEndpoint[] = [],
): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: Number(id.replace(/\D/g, "")) || 1,
    title: `Phase ${id}`,
    description: "",
    steps,
    questions,
    locked: false,
  };
}

function pathOf(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path", userId: "u", createdAt: "2026-01-01T00:00:00Z", phases };
}

describe("continueAfter", () => {
  it("leads to the next step of the same phase", () => {
    const path = pathOf([phase("p1", [step("a1", "p1", "FINISHED"), step("a2", "p1", "WAITING")])]);

    const next = continueAfter(path, "p1");

    expect(next).toMatchObject({ kind: "item", label: "Next step", item: { id: "a2" } });
  });

  it("leads to a question of the same phase", () => {
    const path = pathOf([
      phase("p1", [step("a1", "p1", "FINISHED")], [question("q1", "p1", "OPEN")]),
    ]);

    expect(continueAfter(path, "p1")).toMatchObject({
      kind: "item",
      label: "Next: a question",
      item: { id: "q1" },
    });
  });

  it("names the phase that is up next when this one is finished", () => {
    const path = pathOf([
      phase("p1", [step("a1", "p1", "FINISHED")]),
      phase("p2", [step("b1", "p2", "IN_PROGRESS")]),
    ]);

    expect(continueAfter(path, "p1")).toMatchObject({ kind: "item", label: "On to Phase p2" });
  });

  it("sends the hire to choose when finishing opened several phases", () => {
    const path = pathOf([
      phase("p1", [step("a1", "p1", "FINISHED")]),
      phase("p2", [step("b1", "p2", "WAITING")]),
      phase("p3", [step("c1", "p3", "WAITING")]),
    ]);

    expect(continueAfter(path, "p1")).toEqual({ kind: "choose", label: "Choose your next phase" });
  });

  it("goes back to the path when nothing is left, or there is no path", () => {
    const done = pathOf([phase("p1", [step("a1", "p1", "FINISHED")])]);

    expect(continueAfter(done, "p1")).toEqual({ kind: "back", label: "Back to your path" });
    expect(continueAfter(null, "p1")).toEqual({ kind: "back", label: "Back to your path" });
  });
});

function result(over: Partial<QuestionAttemptResult>): QuestionAttemptResult {
  return {
    attemptId: "a",
    questionId: "q1",
    correct: true,
    createdAt: "2026-01-01T00:00:00Z",
    correctOptionIds: [],
    correctAnswer: null,
    explanation: null,
    feedback: null,
    status: "PASSED",
    onboardingCompleted: false,
    ...over,
  };
}

describe("celebrationAfter", () => {
  const q1 = question("q1", "p1", "OPEN");

  it("celebrates the whole onboarding when the backend says it is complete", () => {
    expect(celebrationAfter(q1, result({ onboardingCompleted: true }), [], 0)).toEqual({
      kind: "mission",
    });
  });

  it("celebrates a phase whose last open item this answer finished", () => {
    const phases = [phase("p1", [step("a1", "p1", "FINISHED")], [q1])];

    expect(celebrationAfter(q1, result({}), phases, 0)).toEqual({
      kind: "phase",
      moment: {
        tone: "milestone",
        title: "Phase completed",
        message: "You completed the Phase p1 phase.",
        progress: { current: 1, total: 1 },
      },
    });
  });

  it("counts the phases already done", () => {
    const phases = [
      phase("p1", [step("a1", "p1", "FINISHED")]),
      phase("p2", [step("b1", "p2", "SKIPPED")], [question("q1", "p2", "OPEN")]),
      phase("p3", [step("c1", "p3", "WAITING")]),
    ];
    const here = question("q1", "p2", "OPEN");

    const celebration = celebrationAfter(here, result({}), phases, 1);

    expect(celebration).toMatchObject({
      kind: "phase",
      moment: { progress: { current: 2, total: 3 } },
    });
  });

  it("never counts past the number of phases", () => {
    const phases = [phase("p1", [step("a1", "p1", "FINISHED")], [q1])];

    expect(celebrationAfter(q1, result({}), phases, 5)).toMatchObject({
      moment: { progress: { current: 1, total: 1 } },
    });
  });

  it("does not celebrate a wrong answer", () => {
    const phases = [phase("p1", [step("a1", "p1", "FINISHED")], [q1])];

    expect(celebrationAfter(q1, result({ correct: false }), phases, 0)).toBeNull();
  });

  it("does not celebrate while a step is still open", () => {
    const phases = [phase("p1", [step("a1", "p1", "IN_PROGRESS")], [q1])];

    expect(celebrationAfter(q1, result({}), phases, 0)).toBeNull();
  });

  it("does not celebrate while another question is still open", () => {
    const phases = [
      phase("p1", [step("a1", "p1", "FINISHED")], [q1, question("q2", "p1", "OPEN")]),
    ];

    expect(celebrationAfter(q1, result({}), phases, 0)).toBeNull();
  });

  it("counts a passed question and the one just answered as done", () => {
    const phases = [phase("p1", [], [q1, question("q2", "p1", "PASSED")])];

    expect(celebrationAfter(q1, result({}), phases, 0)).toMatchObject({ kind: "phase" });
  });

  it("has nothing to celebrate for a question that is not on the path", () => {
    expect(celebrationAfter(q1, result({}), [], 0)).toBeNull();
  });
});

describe("placeOf", () => {
  const phases = [
    phase("p1", [step("a1", "p1", "WAITING")]),
    phase("p2", [step("b1", "p2", "WAITING")], [question("q1", "p2", "OPEN")]),
  ];
  const base = {
    viewMode: "list" as const,
    phases,
    selectedPhase: phases[0],
    openGraphPhaseId: null,
    expandedItemId: null,
    graphItemId: null,
  };

  it("is the selected phase when nothing is open in the list", () => {
    expect(placeOf(base)).toEqual({ kind: "phase", id: "p1", title: "Phase p1" });
  });

  it("is the step that is open", () => {
    expect(placeOf({ ...base, expandedItemId: "b1" })).toEqual({
      kind: "step",
      id: "b1",
      title: "Title b1",
    });
  });

  it("is the question's phase for an open question", () => {
    expect(placeOf({ ...base, expandedItemId: "q1" })).toEqual({
      kind: "phase",
      id: "p2",
      title: "Phase p2",
    });
  });

  it("reads the graph's open item and zoomed phase in the graph", () => {
    const graph = { ...base, viewMode: "graph" as const, expandedItemId: "a1" };

    expect(placeOf({ ...graph, graphItemId: "b1" })).toMatchObject({ kind: "step", id: "b1" });
    expect(placeOf({ ...graph, openGraphPhaseId: "p2" })).toMatchObject({
      kind: "phase",
      id: "p2",
    });
  });

  it("is nowhere on the graph's map, or with no phase selected", () => {
    expect(placeOf({ ...base, viewMode: "graph" })).toBeNull();
    expect(placeOf({ ...base, selectedPhase: null })).toBeNull();
  });
});
