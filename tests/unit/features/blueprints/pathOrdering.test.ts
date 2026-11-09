import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPositionUpdates,
  findItem,
  moveItem,
  savePosition,
  siblingIds,
} from "../../../../src/features/blueprints/pathOrdering.ts";
import type { BlueprintPath } from "../../../../src/features/blueprints/types.ts";

const { service } = vi.hoisted(() => ({
  service: {
    updatePhasePosition: vi.fn(),
    updateStepPosition: vi.fn(),
    updateTaskPosition: vi.fn(),
    updateQuestionPosition: vi.fn(),
    updateOptionPosition: vi.fn(),
  },
}));

vi.mock("../../../../src/services/blueprintService.ts", () => ({ blueprintService: service }));

const item = (id: string, position: number, extra: Record<string, unknown> = {}) => ({
  id,
  position,
  revision: position + 10,
  ...extra,
});

/** Two phases; the first holds three steps (the first with three tasks) and three questions (the first with three options). */
function pathFixture(): BlueprintPath {
  return {
    id: "path",
    blueprintPhases: [
      item("ph1", 0, {
        blueprintSteps: [
          item("s1", 0, {
            blueprintTasks: [item("t1", 0), item("t2", 1), item("t3", 2)],
          }),
          item("s2", 1, { blueprintTasks: [] }),
          item("s3", 2, { blueprintTasks: [] }),
        ],
        blueprintCheckQuestions: [
          item("q1", 0, {
            blueprintCheckOptions: [item("o1", 0), item("o2", 1), item("o3", 2)],
          }),
          item("q2", 1, { blueprintCheckOptions: [] }),
          item("q3", 2, { blueprintCheckOptions: [] }),
        ],
      }),
      item("ph2", 1, {
        blueprintSteps: [item("s9", 0, { blueprintTasks: [] })],
        blueprintCheckQuestions: [],
      }),
    ],
  } as unknown as BlueprintPath;
}

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);
const positions = (list: { position: number }[]) => list.map((entry) => entry.position);

describe("moveItem", () => {
  it("moves a phase to the front and renumbers", () => {
    const moved = moveItem(pathFixture(), "phase", "ph2", 0);
    expect(ids(moved.blueprintPhases)).toEqual(["ph2", "ph1"]);
    expect(positions(moved.blueprintPhases)).toEqual([0, 1]);
  });

  it("moves a step only within its own phase", () => {
    const moved = moveItem(pathFixture(), "step", "s3", 0);
    expect(ids(moved.blueprintPhases[0].blueprintSteps)).toEqual(["s3", "s1", "s2"]);
    expect(positions(moved.blueprintPhases[0].blueprintSteps)).toEqual([0, 1, 2]);
    expect(ids(moved.blueprintPhases[1].blueprintSteps)).toEqual(["s9"]);
  });

  it("moves a task within its step", () => {
    const moved = moveItem(pathFixture(), "task", "t3", 1);
    expect(ids(moved.blueprintPhases[0].blueprintSteps[0].blueprintTasks)).toEqual([
      "t1",
      "t3",
      "t2",
    ]);
  });

  it("moves a question within its phase", () => {
    const moved = moveItem(pathFixture(), "question", "q2", 2);
    expect(ids(moved.blueprintPhases[0].blueprintCheckQuestions)).toEqual(["q1", "q3", "q2"]);
  });

  it("moves an option within its question", () => {
    const moved = moveItem(pathFixture(), "option", "o1", 2);
    expect(ids(moved.blueprintPhases[0].blueprintCheckQuestions[0].blueprintCheckOptions)).toEqual([
      "o2",
      "o3",
      "o1",
    ]);
  });

  it("leaves the path as it was when the item is not there", () => {
    const moved = moveItem(pathFixture(), "step", "nope", 0);
    expect(ids(moved.blueprintPhases[0].blueprintSteps)).toEqual(["s1", "s2", "s3"]);
    expect(ids(moveItem(pathFixture(), "phase", "nope", 0).blueprintPhases)).toEqual([
      "ph1",
      "ph2",
    ]);
  });
});

describe("applyPositionUpdates", () => {
  it("writes the server's revisions and positions onto the matching items only", () => {
    const applied = applyPositionUpdates(pathFixture(), "step", "s1", [
      { id: "s1", revision: 50, position: 2 },
      { id: "s2", revision: 51, position: 0 },
    ]);
    const steps = applied.blueprintPhases[0].blueprintSteps;
    expect(steps.map((step) => [step.id, step.revision, step.position])).toEqual([
      ["s1", 50, 2],
      ["s2", 51, 0],
      ["s3", 12, 2],
    ]);
  });

  it("applies to phases, tasks, questions and options", () => {
    const update = [{ id: "x", revision: 99, position: 7 }];
    const phases = applyPositionUpdates(pathFixture(), "phase", "ph1", [
      { id: "ph1", revision: 99, position: 7 },
    ]);
    expect(phases.blueprintPhases[0]).toMatchObject({ revision: 99, position: 7 });
    for (const [kind, id] of [
      ["task", "t1"],
      ["question", "q1"],
      ["option", "o1"],
    ] as const) {
      const applied = applyPositionUpdates(pathFixture(), kind, id, [{ ...update[0], id }]);
      expect(JSON.stringify(applied)).toContain('"revision":99');
    }
  });

  it("changes nothing when there are no updates", () => {
    const applied = applyPositionUpdates(pathFixture(), "task", "t1", []);
    expect(applied).toEqual(pathFixture());
  });
});

describe("findItem", () => {
  it("finds an item of each kind wherever it sits", () => {
    const path = pathFixture();
    expect(findItem(path, "phase", "ph2")?.id).toBe("ph2");
    expect(findItem(path, "step", "s9")?.id).toBe("s9");
    expect(findItem(path, "task", "t2")?.id).toBe("t2");
    expect(findItem(path, "question", "q3")?.id).toBe("q3");
    expect(findItem(path, "option", "o3")?.id).toBe("o3");
  });

  it("does not find an id under the wrong kind or an unknown one", () => {
    expect(findItem(pathFixture(), "step", "t1")).toBeUndefined();
    expect(findItem(pathFixture(), "phase", "nope")).toBeUndefined();
  });
});

describe("siblingIds", () => {
  it("lists the ids of the list an item sits in", () => {
    const path = pathFixture();
    expect(siblingIds(path, "phase", "ph1")).toEqual(["ph1", "ph2"]);
    expect(siblingIds(path, "step", "s2")).toEqual(["s1", "s2", "s3"]);
    expect(siblingIds(path, "step", "s9")).toEqual(["s9"]);
    expect(siblingIds(path, "task", "t3")).toEqual(["t1", "t2", "t3"]);
    expect(siblingIds(path, "question", "q1")).toEqual(["q1", "q2", "q3"]);
    expect(siblingIds(path, "option", "o2")).toEqual(["o1", "o2", "o3"]);
  });

  it("is empty for an unknown item or before the path has loaded", () => {
    expect(siblingIds(pathFixture(), "step", "nope")).toEqual([]);
    expect(siblingIds(null, "phase", "ph1")).toEqual([]);
  });
});

describe("savePosition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends each kind to its own endpoint with the item's revision", async () => {
    const scope = { kind: "global" } as const;
    const entry = { id: "x", revision: 4 };
    service.updatePhasePosition.mockResolvedValue(["phase"]);
    service.updateStepPosition.mockResolvedValue(["step"]);
    service.updateTaskPosition.mockResolvedValue(["task"]);
    service.updateQuestionPosition.mockResolvedValue(["question"]);
    service.updateOptionPosition.mockResolvedValue(["option"]);

    expect(await savePosition(scope, "phase", entry, 3)).toEqual(["phase"]);
    expect(await savePosition(scope, "step", entry, 3)).toEqual(["step"]);
    expect(await savePosition(scope, "task", entry, 3)).toEqual(["task"]);
    expect(await savePosition(scope, "question", entry, 3)).toEqual(["question"]);
    expect(await savePosition(scope, "option", entry, 3)).toEqual(["option"]);
    for (const call of [
      service.updatePhasePosition,
      service.updateStepPosition,
      service.updateTaskPosition,
      service.updateQuestionPosition,
      service.updateOptionPosition,
    ]) {
      expect(call).toHaveBeenCalledWith(scope, "x", { revision: 4, position: 3 });
    }
  });
});
