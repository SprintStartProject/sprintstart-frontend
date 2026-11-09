import { describe, expect, it } from "vitest";
import {
  keepingHeldGraph,
  questionNode,
  stepNode,
  withCreatedQuestion,
  withCreatedStep,
  withNodeChange,
  withNodeChangeInList,
} from "../../../../src/features/blueprints/graphPathUpdates.ts";
import type {
  BlueprintGraphNode,
  BlueprintPath,
  BlueprintQuestion,
  BlueprintStep,
} from "../../../../src/features/blueprints/types.ts";

function pathFixture(): BlueprintPath {
  return {
    id: "path",
    blueprintPhases: [
      {
        id: "ph1",
        revision: 1,
        title: "One",
        graphX: 5,
        graphY: 6,
        blockerIds: ["ph0"],
        blueprintSteps: [
          { id: "s1", revision: 2, graphX: 0, graphY: 0, blockerIds: [] },
          { id: "s2", revision: 3, graphX: 0, graphY: 0, blockerIds: [] },
        ],
        blueprintCheckQuestions: [{ id: "q1", revision: 4 }],
      },
      { id: "ph2", revision: 9, title: "Two", blueprintSteps: [], blueprintCheckQuestions: [] },
    ],
  } as unknown as BlueprintPath;
}

const place = { revision: 0, graphX: 30, graphY: 40 };

describe("withNodeChange", () => {
  it("writes the whole change onto a step", () => {
    const next = withNodeChange(pathFixture(), "ph1", "s1", {
      revision: 7,
      graphX: 11,
      graphY: 12,
      blockerIds: ["s2"],
    });
    expect(next.blueprintPhases[0].blueprintSteps[0]).toMatchObject({
      revision: 7,
      graphX: 11,
      graphY: 12,
      blockerIds: ["s2"],
    });
    expect(next.blueprintPhases[0].blueprintSteps[1].revision).toBe(3);
  });

  it("keeps only the revision on a question", () => {
    const next = withNodeChange(pathFixture(), "ph1", "q1", {
      revision: 8,
      graphX: 11,
      blockerIds: ["x"],
    });
    expect(next.blueprintPhases[0].blueprintCheckQuestions[0]).toEqual({ id: "q1", revision: 8 });
  });

  it("leaves other phases and unknown nodes alone", () => {
    const next = withNodeChange(pathFixture(), "ph2", "s1", { revision: 99 });
    expect(next.blueprintPhases[0].blueprintSteps[0].revision).toBe(2);
    expect(withNodeChange(pathFixture(), "ph1", "nope", { revision: 99 })).toEqual(pathFixture());
  });
});

describe("withNodeChangeInList", () => {
  const nodes = [
    { id: "a", revision: 1, graphX: 0, graphY: 0, blockerIds: [] },
    { id: "b", revision: 2, graphX: 0, graphY: 0, blockerIds: [] },
  ] as unknown as BlueprintGraphNode[];

  it("changes only the named node", () => {
    const next = withNodeChangeInList(nodes, "b", { revision: 5, blockerIds: ["a"] });
    expect(next[0]).toBe(nodes[0]);
    expect(next[1]).toMatchObject({ revision: 5, blockerIds: ["a"], graphX: 0 });
  });
});

describe("created nodes", () => {
  const step = { id: "s9", title: "New step", blueprintPhaseId: "ph1" } as BlueprintStep;
  const question = { id: "q9", title: "New q", blueprintPhaseId: "ph1" } as BlueprintQuestion;

  it("describes a created step as an unblocked node at its place", () => {
    expect(stepNode(step, place)).toEqual({
      id: "s9",
      revision: 0,
      title: "New step",
      type: "STEP",
      blueprintPhaseId: "ph1",
      graphX: 30,
      graphY: 40,
      blockerIds: [],
    });
  });

  it("describes a created question the same way", () => {
    expect(questionNode(question, { ...place, revision: 3 })).toMatchObject({
      id: "q9",
      type: "QUESTION",
      revision: 3,
      graphX: 30,
      graphY: 40,
    });
  });

  it("adds a created step to its phase, placed", () => {
    const next = withCreatedStep(pathFixture(), step, place);
    const steps = next.blueprintPhases[0].blueprintSteps;
    expect(steps.map((entry) => entry.id)).toEqual(["s1", "s2", "s9"]);
    expect(steps[2]).toMatchObject({ graphX: 30, graphY: 40, revision: 0 });
    expect(next.blueprintPhases[1].blueprintSteps).toEqual([]);
  });

  it("adds a created question to its phase at the revision it was created at", () => {
    const next = withCreatedQuestion(pathFixture(), { ...question, revision: 77 }, place);
    const questions = next.blueprintPhases[0].blueprintCheckQuestions;
    expect(questions.map((entry) => entry.id)).toEqual(["q1", "q9"]);
    expect(questions[1].revision).toBe(0);
  });
});

describe("keepingHeldGraph", () => {
  it("is the fetched path when nothing is held yet", () => {
    const fetched = pathFixture();
    expect(keepingHeldGraph(null, fetched)).toBe(fetched);
  });

  it("keeps the coordinates and prerequisites held, with the revision just fetched", () => {
    const held = pathFixture();
    const fetched = {
      ...pathFixture(),
      blueprintPhases: [
        { ...pathFixture().blueprintPhases[0], revision: 50, graphX: null, blockerIds: [] },
        { ...pathFixture().blueprintPhases[1], revision: 51 },
        {
          id: "ph3",
          revision: 52,
          title: "Three",
          blueprintSteps: [],
          blueprintCheckQuestions: [],
        },
      ],
    } as unknown as BlueprintPath;

    const merged = keepingHeldGraph(held, fetched);

    expect(merged.blueprintPhases[0]).toMatchObject({
      revision: 50,
      graphX: 5,
      graphY: 6,
      blockerIds: ["ph0"],
    });
    expect(merged.blueprintPhases[2]).toMatchObject({
      revision: 52,
      graphX: null,
      graphY: null,
      blockerIds: [],
    });
  });
});
