import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  afterPhaseDeletion,
  afterQuestionDeletion,
  afterStepDeletion,
  findDeletable,
  nodesAfterDeletion,
  sendDelete,
} from "../../../../src/features/blueprints/pathDeletion.ts";
import type {
  BlueprintGraphNode,
  BlueprintPath,
} from "../../../../src/features/blueprints/types.ts";

const { service } = vi.hoisted(() => ({
  service: {
    deletePhase: vi.fn(),
    deleteStep: vi.fn(),
    deleteQuestion: vi.fn(),
    deleteTask: vi.fn(),
    deleteResource: vi.fn(),
    deleteOption: vi.fn(),
  },
}));

vi.mock("../../../../src/services/blueprintService.ts", () => ({ blueprintService: service }));

function pathFixture(): BlueprintPath {
  return {
    id: "path",
    blueprintPhases: [
      {
        id: "ph1",
        revision: 1,
        blockerIds: [],
        blueprintSteps: [
          {
            id: "s1",
            revision: 2,
            blockerIds: [],
            blueprintTasks: [{ id: "t1", revision: 20 }],
            blueprintResources: [{ id: "r1", revision: 21 }],
          },
          {
            id: "s2",
            revision: 3,
            blockerIds: ["s1", "q1"],
            blueprintTasks: [],
            blueprintResources: [],
          },
        ],
        blueprintCheckQuestions: [
          {
            id: "q1",
            revision: 4,
            blockerIds: ["s1"],
            blueprintCheckOptions: [{ id: "o1", revision: 22 }],
          },
          { id: "q2", revision: 5, blockerIds: ["q1"], blueprintCheckOptions: [] },
        ],
      },
      {
        id: "ph2",
        revision: 9,
        blockerIds: ["ph1"],
        blueprintSteps: [],
        blueprintCheckQuestions: [],
      },
    ],
  } as unknown as BlueprintPath;
}

describe("afterPhaseDeletion", () => {
  it("drops the phase and stops the others waiting for it, at their new revisions", () => {
    const next = afterPhaseDeletion(pathFixture(), "ph1", [
      { id: "ph1", revision: 50 },
      { id: "ph2", revision: 51 },
    ]);
    expect(next.blueprintPhases.map((phase) => phase.id)).toEqual(["ph2"]);
    expect(next.blueprintPhases[0]).toMatchObject({ revision: 51, blockerIds: [] });
  });

  it("leaves phases the server did not touch as they were", () => {
    const before = pathFixture();
    const next = afterPhaseDeletion(before, "ph2", []);
    expect(next.blueprintPhases).toEqual([before.blueprintPhases[0]]);
  });
});

describe("afterStepDeletion", () => {
  it("drops the step, renumbers what it touched and releases what waited for it", () => {
    const next = afterStepDeletion(pathFixture(), "s1", [
      { id: "s2", revision: 60 },
      { id: "q1", revision: 61 },
    ]);
    const phase = next.blueprintPhases[0];
    expect(phase.blueprintSteps.map((step) => step.id)).toEqual(["s2"]);
    expect(phase.blueprintSteps[0]).toMatchObject({ revision: 60, blockerIds: ["q1"] });
    // A question only takes the new revision; its own prerequisites are the server's business.
    expect(phase.blueprintCheckQuestions[0]).toMatchObject({ revision: 61, blockerIds: ["s1"] });
  });
});

describe("afterQuestionDeletion", () => {
  it("drops the question and releases the steps that waited for it", () => {
    const next = afterQuestionDeletion(pathFixture(), "q1", [
      { id: "s2", revision: 70 },
      { id: "q2", revision: 71 },
    ]);
    const phase = next.blueprintPhases[0];
    expect(phase.blueprintCheckQuestions.map((question) => question.id)).toEqual(["q2"]);
    expect(phase.blueprintCheckQuestions[0].revision).toBe(71);
    expect(phase.blueprintSteps[1]).toMatchObject({ revision: 70, blockerIds: ["s1"] });
  });
});

describe("nodesAfterDeletion", () => {
  it("drops the node and releases the ones that waited for it", () => {
    const nodes = [
      { id: "a", revision: 1, blockerIds: [] },
      { id: "b", revision: 2, blockerIds: ["a"] },
    ] as unknown as BlueprintGraphNode[];
    const next = nodesAfterDeletion(nodes, "a", [{ id: "b", revision: 8 }]);
    expect(next).toEqual([{ id: "b", revision: 8, blockerIds: [] }]);
  });
});

describe("findDeletable", () => {
  it("finds each kind with its revision", () => {
    const path = pathFixture();
    expect(findDeletable(path, "phase", "ph2")).toMatchObject({ revision: 9 });
    expect(findDeletable(path, "step", "s2")).toMatchObject({ revision: 3 });
    expect(findDeletable(path, "task", "t1")).toMatchObject({ revision: 20 });
    expect(findDeletable(path, "resource", "r1")).toMatchObject({ revision: 21 });
    expect(findDeletable(path, "question", "q2")).toMatchObject({ revision: 5 });
    expect(findDeletable(path, "option", "o1")).toMatchObject({ revision: 22 });
  });

  it("finds nothing for an unknown id, a wrong kind or no path", () => {
    expect(findDeletable(pathFixture(), "task", "nope")).toBeUndefined();
    expect(findDeletable(pathFixture(), "resource", "t1")).toBeUndefined();
    expect(findDeletable(null, "phase", "ph1")).toBeUndefined();
  });
});

describe("sendDelete", () => {
  beforeEach(() => vi.clearAllMocks());
  const scope = { kind: "global" } as const;

  it("reports what a phase, step or question delete touched", async () => {
    service.deletePhase.mockResolvedValue({ updatedPhases: [{ id: "p", revision: 1 }] });
    service.deleteStep.mockResolvedValue({ updatedSteps: [{ id: "s", revision: 2 }] });
    service.deleteQuestion.mockResolvedValue({ updatedQuestions: [{ id: "q", revision: 3 }] });

    expect(await sendDelete(scope, "phase", { id: "x", revision: 7 })).toEqual({
      kind: "phase",
      id: "x",
      updated: [{ id: "p", revision: 1 }],
    });
    expect(await sendDelete(scope, "step", { id: "x", revision: 7 })).toEqual({
      kind: "step",
      id: "x",
      updated: [{ id: "s", revision: 2 }],
    });
    expect(await sendDelete(scope, "question", { id: "x", revision: 7 })).toEqual({
      kind: "question",
      id: "x",
      updated: [{ id: "q", revision: 3 }],
    });
    expect(service.deletePhase).toHaveBeenCalledWith(scope, "x", 7);
    expect(service.deleteStep).toHaveBeenCalledWith(scope, "x", 7);
    expect(service.deleteQuestion).toHaveBeenCalledWith(scope, "x", 7);
  });

  it("reports nothing for a task, a resource or an option", async () => {
    expect(await sendDelete(scope, "task", { id: "t", revision: 1 })).toBeUndefined();
    expect(await sendDelete(scope, "resource", { id: "r", revision: 2 })).toBeUndefined();
    expect(await sendDelete(scope, "option", { id: "o", revision: 3 })).toBeUndefined();
    expect(service.deleteTask).toHaveBeenCalledWith(scope, "t", 1);
    expect(service.deleteResource).toHaveBeenCalledWith(scope, "r", 2);
    expect(service.deleteOption).toHaveBeenCalledWith(scope, "o", 3);
  });
});
