import { describe, expect, it } from "vitest";
import {
  reorderByKeys,
  rowId,
  sameKeys,
  targetKeyUnder,
  threadModel,
} from "../../../../src/features/arrival/components/thread/threadRules";
import type { ArrivalStep } from "../../../../src/features/arrival/types";

const step = (key: string, projectId: string | null = null): ArrivalStep => ({
  key,
  projectId,
  projectName: null,
  title: key,
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
});

const keys = (steps: ArrivalStep[]) => steps.map((entry) => entry.key);

describe("sameKeys", () => {
  it("is true only for the same keys in the same order", () => {
    expect(sameKeys(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameKeys(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameKeys(["a"], ["a", "b"])).toBe(false);
    expect(sameKeys([], [])).toBe(true);
  });
});

describe("reorderByKeys", () => {
  const steps = [step("a"), step("b"), step("c")];

  it("re-reads the list in the given order", () => {
    expect(keys(reorderByKeys(steps, ["c", "a", "b"]))).toEqual(["c", "a", "b"]);
  });

  it("keeps the original when the lengths disagree", () => {
    expect(reorderByKeys(steps, ["a", "b"])).toBe(steps);
  });

  it("keeps the original when a key is unknown", () => {
    expect(reorderByKeys(steps, ["a", "b", "zzz"])).toBe(steps);
  });
});

describe("rowId", () => {
  it("scopes a key, so a company step and its override stay apart", () => {
    expect(rowId("company", "vpn")).toBe("company:vpn");
    expect(rowId("project", "vpn")).not.toBe(rowId("company", "vpn"));
  });
});

describe("targetKeyUnder", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      getBoundingClientRect: () => ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
      }),
    }) as unknown as HTMLElement;

  const elements = new Map<string, HTMLElement>([
    [rowId("company", "a"), rect(0, 0, 100, 40)],
    [rowId("company", "b"), rect(0, 50, 100, 40)],
    [rowId("company", "c"), rect(0, 100, 100, 40)],
  ]);

  it("finds the row the dragged one's center sits over", () => {
    elements.set(rowId("company", "a"), rect(0, 95, 100, 40));

    expect(targetKeyUnder(["a", "b", "c"], "a", "company", elements)).toBe("c");
    elements.set(rowId("company", "a"), rect(0, 0, 100, 40));
  });

  it("finds nothing when the center is over no other row", () => {
    expect(targetKeyUnder(["a", "b", "c"], "a", "company", elements)).toBeNull();
  });

  it("never names the dragged row itself", () => {
    expect(targetKeyUnder(["a"], "a", "company", elements)).toBeNull();
  });

  it("finds nothing for a row that was never measured", () => {
    expect(targetKeyUnder(["x", "b"], "x", "company", elements)).toBeNull();
  });

  it("looks only inside the dragged row's own scope", () => {
    const mixed = new Map(elements);
    mixed.set(rowId("project", "a"), rect(0, 50, 100, 40));

    expect(targetKeyUnder(["a", "b"], "a", "project", mixed)).toBeNull();
  });

  it("counts the edge of a row as inside", () => {
    const edge = new Map<string, HTMLElement>([
      [rowId("company", "a"), rect(0, 30, 100, 40)],
      [rowId("company", "b"), rect(0, 50, 100, 40)],
    ]);

    // a's center is y=50, the top edge of b.
    expect(targetKeyUnder(["a", "b"], "a", "company", edge)).toBe("b");
  });
});

describe("threadModel", () => {
  const base = {
    companySteps: [step("a"), step("b"), step("c")],
    projectSteps: [] as ArrivalStep[],
    liveCompanySteps: [step("a"), step("b"), step("c")],
    liveProjectSteps: [] as ArrivalStep[],
    draggingScope: null,
    hasProject: false,
  };

  it("numbers the company steps straight through", () => {
    const { company, project } = threadModel(base);

    expect(company.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(project).toEqual([]);
  });

  it("flags the first row as unable to move up and the last as unable to move down", () => {
    const { company } = threadModel(base);

    expect(company.map((entry) => entry.canMoveUp)).toEqual([false, true, true]);
    expect(company.map((entry) => entry.canMoveDown)).toEqual([true, true, false]);
  });

  it("marks a shadowed company step as replaced and unmovable, and counts the override", () => {
    const projectSteps = [step("b", "p1"), step("extra", "p1")];
    const { company, project } = threadModel({
      ...base,
      projectSteps,
      liveProjectSteps: projectSteps,
      hasProject: true,
    });

    expect(company[0].number).toBe(1);
    expect(company[2].number).toBe(2);
    expect(company[1]).toMatchObject({ replaced: true, canMoveUp: false, canMoveDown: false });
    expect(project.map((entry) => entry.number)).toEqual([3, 4]);
    expect(project.map((entry) => entry.isOverride)).toEqual([true, false]);
    expect(project.map((entry) => entry.scope)).toEqual(["project", "project"]);
    expect(project.map((entry) => entry.canMoveUp)).toEqual([false, true]);
    expect(project.map((entry) => entry.canMoveDown)).toEqual([true, false]);
  });

  it("shadows nothing and shows no project steps without a project", () => {
    const projectSteps = [step("b", "p1")];
    const { company, project } = threadModel({
      ...base,
      projectSteps,
      liveProjectSteps: projectSteps,
      hasProject: false,
    });

    expect(company.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(company.some((entry) => entry.replaced)).toBe(false);
    expect(project).toEqual([]);
  });

  it("keeps the numbers of the order the server has while that scope is dragged", () => {
    const live = [step("c"), step("a"), step("b")];
    const { company } = threadModel({
      ...base,
      liveCompanySteps: live,
      draggingScope: "company",
    });

    // Rows sit in the live order, but each keeps the number the server order gave it.
    expect(company.map((entry) => entry.step.key)).toEqual(["c", "a", "b"]);
    expect(company.map((entry) => entry.number)).toEqual([3, 1, 2]);
  });

  it("takes the live order for the numbers once nothing is dragged", () => {
    const live = [step("c"), step("a"), step("b")];
    const { company } = threadModel({ ...base, liveCompanySteps: live });

    expect(company.map((entry) => entry.number)).toEqual([1, 2, 3]);
  });

  it("keeps the project numbers on the server order while the project scope is dragged", () => {
    const projectSteps = [step("x", "p1"), step("y", "p1")];
    const { project } = threadModel({
      ...base,
      projectSteps,
      liveProjectSteps: [projectSteps[1], projectSteps[0]],
      hasProject: true,
      draggingScope: "project",
    });

    expect(project.map((entry) => entry.step.key)).toEqual(["y", "x"]);
    expect(project.map((entry) => entry.number)).toEqual([5, 4]);
  });
});
