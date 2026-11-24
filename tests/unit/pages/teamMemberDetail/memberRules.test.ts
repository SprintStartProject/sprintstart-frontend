import { describe, expect, it } from "vitest";
import {
  allStepsOf,
  describeRebuildError,
  formatMinutes,
  getActualMinutes,
  getStepStatusStyles,
  gapsOwnedBy,
  moveTask,
  openItemCount,
  sortedPhases,
  stepFeedbackFor,
  taskCount,
  topKnowledgeGaps,
  unassignedRolesOf,
  type DetailOnboardingStep,
} from "../../../../src/pages/teamMemberDetail/memberRules";
import type { KnowledgeGap } from "../../../../src/services/knowledgeGapTypes";
import type { TeamOverviewUser } from "../../../../src/services/teamManagementTypes";

const step = (over: Partial<DetailOnboardingStep> = {}) =>
  ({ id: "s1", title: "Install", position: 1, ...over }) as DetailOnboardingStep;

const task = (id: string, position: number, finished = false) => ({
  id,
  stepId: "s1",
  position,
  title: id,
  description: "",
  finished,
});

const gap = (id: string, severity: string, ownerIds: string[] = ["u1"]) =>
  ({ id, severity, owners: ownerIds.map((owner) => ({ id: owner })) }) as unknown as KnowledgeGap;

describe("describeRebuildError", () => {
  it("explains a knowledge base that covers nothing", () => {
    expect(describeRebuildError("x", "not-enough-knowledge")).toContain(
      "knowledge base does not cover any phase yet",
    );
  });

  it("explains a missing, or an ambiguous, blueprint", () => {
    expect(describeRebuildError("No active blueprint found")).toContain("no published onboarding");
    expect(describeRebuildError("Multiple active blueprints")).toContain("more than one published");
  });

  it("explains a refusal", () => {
    expect(describeRebuildError("request failed with status: 403")).toContain(
      "Only the project's manager",
    );
  });

  it("passes any other message on, and says the path is unchanged", () => {
    expect(describeRebuildError("boom")).toBe("boom The current path is unchanged.");
    expect(describeRebuildError("")).toBe("The generation failed. The current path is unchanged.");
  });
});

describe("formatMinutes", () => {
  it("says there is no estimate for nothing", () => {
    expect(formatMinutes(undefined)).toBe("No estimate");
    expect(formatMinutes(null)).toBe("No estimate");
    expect(formatMinutes(0)).toBe("No estimate");
    expect(formatMinutes(-5)).toBe("No estimate");
  });

  it("gives minutes under an hour, and hours with the rest", () => {
    expect(formatMinutes(59)).toBe("59 min");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(125)).toBe("2h 5m");
  });
});

describe("getActualMinutes", () => {
  it("takes the recorded duration first", () => {
    expect(getActualMinutes(step({ durationMinutes: 12 }))).toBe(12);
  });

  it("works it out from the start and the end, at least a minute", () => {
    expect(
      getActualMinutes(
        step({ startedAt: "2026-01-01T10:00:00Z", completedAt: "2026-01-01T10:45:00Z" }),
      ),
    ).toBe(45);
    expect(
      getActualMinutes(
        step({ startedAt: "2026-01-01T10:00:00Z", completedAt: "2026-01-01T10:00:10Z" }),
      ),
    ).toBe(1);
  });

  it("is none without both times", () => {
    expect(getActualMinutes(step())).toBeNull();
    expect(getActualMinutes(step({ startedAt: "2026-01-01T10:00:00Z" }))).toBeNull();
    expect(getActualMinutes(step({ completedAt: "2026-01-01T10:00:00Z" }))).toBeNull();
  });
});

describe("getStepStatusStyles", () => {
  it("colours each status in its own way", () => {
    const all = ["FINISHED", "SKIPPED", "IN_PROGRESS", "LOCKED"].map(getStepStatusStyles);
    expect(new Set(all).size).toBe(4);
    expect(all[0]).toContain("success");
    expect(all[1]).toContain("danger");
    expect(all[2]).toContain("brand");
    expect(all[3]).toContain("muted");
  });
});

describe("unassignedRolesOf", () => {
  it("offers the roles the member does not hold", () => {
    const roles = [
      { id: "a", name: "A", description: "" },
      { id: "b", name: "B", description: "" },
    ];
    const user = { roles: [roles[0]] } as TeamOverviewUser;
    expect(unassignedRolesOf(roles, user)).toEqual([roles[1]]);
  });
});

describe("phases and steps", () => {
  const path = {
    phases: [
      { id: "p2", position: 2, steps: [step({ id: "later" })] },
      {
        id: "p1",
        position: 1,
        steps: [step({ id: "b", position: 2 }), step({ id: "a", position: 1 })],
      },
      { id: "p3", position: 3 },
    ],
  } as never;

  it("sorts the phases and leaves the path alone", () => {
    expect(sortedPhases(path).map((phase) => phase.id)).toEqual(["p1", "p2", "p3"]);
    expect((path as { phases: { id: string }[] }).phases[0].id).toBe("p2");
    expect(sortedPhases(null)).toEqual([]);
  });

  it("lists every step, phase by phase, each phase in step order", () => {
    expect(allStepsOf(sortedPhases(path)).map((entry) => entry.id)).toEqual(["a", "b", "later"]);
  });
});

describe("openItemCount", () => {
  const user = (over: Partial<TeamOverviewUser> = {}) =>
    ({ userId: "u1", hasFeedback: false, currentStep: null, ...over }) as TeamOverviewUser;
  const waiting = user({ currentStep: { skip: { status: "PENDING" } } as never });

  it("counts a pending skip as one", () => {
    expect(openItemCount(waiting, [])).toBe(1);
    expect(openItemCount(user(), [])).toBe(0);
  });

  it("counts every unread comment, not the kinds", () => {
    const feedback = [
      { id: "a", message: "", read: false },
      { id: "b", message: "", read: false },
      { id: "c", message: "", read: true },
    ];
    expect(openItemCount(user(), feedback)).toBe(2);
    expect(openItemCount(waiting, feedback)).toBe(3);
  });

  it("stands the member's own flag in for feedback that has not loaded", () => {
    expect(openItemCount(user({ hasFeedback: true }), [])).toBe(1);
    expect(openItemCount(user({ hasFeedback: true }), [{ id: "a", message: "", read: true }])).toBe(
      1,
    );
  });
});

describe("stepFeedbackFor", () => {
  it("is none without a step", () => {
    expect(stepFeedbackFor(null, [{ id: "a", message: "x", stepId: "s1" }])).toEqual([]);
  });

  it("keeps the items of the step, and fills a missing verdict from the step's own feedback", () => {
    const withFeedback = step({
      feedback: { id: "f1", comment: "c", helpful: true, createdAt: "t" },
    } as never);
    const result = stepFeedbackFor(withFeedback, [
      { id: "f1", message: "mine", stepId: "s1" },
      { id: "f2", message: "kept", stepId: "s1", helpful: false },
      { id: "f3", message: "other step", stepId: "s2" },
    ]);

    expect(result.map((item) => [item.id, item.helpful])).toEqual([
      ["f1", true],
      ["f2", false],
    ]);
  });

  it("leaves a verdict open when the step's feedback is another item", () => {
    const withFeedback = step({
      feedback: { id: "other", comment: "c", helpful: true, createdAt: "t" },
    } as never);

    expect(
      stepFeedbackFor(withFeedback, [{ id: "f1", message: "m", stepId: "s1" }])[0].helpful,
    ).toBeUndefined();
  });

  it("falls back to the step's own feedback when the list has none for it", () => {
    const withFeedback = step({
      feedback: { id: "f1", comment: "from step", helpful: false, createdAt: "t" },
    } as never);

    expect(stepFeedbackFor(withFeedback, [])).toEqual([
      {
        id: "f1",
        stepId: "s1",
        stepTitle: "Install",
        message: "from step",
        helpful: false,
        createdAt: "t",
      },
    ]);
  });

  it("is none when neither has any", () => {
    expect(stepFeedbackFor(step(), [])).toEqual([]);
  });
});

describe("knowledge gaps", () => {
  it("keeps the gaps of components the member owns, and not the covered ones", () => {
    const gaps = [
      gap("a", "high"),
      gap("b", "covered"),
      gap("c", "low", ["other"]),
      gap("d", "low", ["other", "u1"]),
    ];
    expect(gapsOwnedBy(gaps, "u1").map((entry) => entry.id)).toEqual(["a", "d"]);
    expect(gapsOwnedBy(gaps, undefined)).toEqual([]);
  });

  it("shows the three most severe, high first, unknown last", () => {
    const gaps = [
      gap("low", "low"),
      gap("odd", "weird"),
      gap("high", "high"),
      gap("medium", "medium"),
    ];
    expect(topKnowledgeGaps(gaps).map((entry) => entry.id)).toEqual(["high", "medium", "low"]);
    expect(gaps[0].id).toBe("low");
  });
});

describe("taskCount", () => {
  it("counts the done tasks and all of them", () => {
    expect(taskCount([task("a", 0, true), task("b", 1), task("c", 2, true)])).toEqual({
      done: 2,
      total: 3,
    });
    expect(taskCount([])).toEqual({ done: 0, total: 0 });
  });
});

describe("moveTask", () => {
  const tasks = [task("c", 2), task("a", 0), task("b", 1)];

  it("renumbers from zero and reports only the tasks that moved", () => {
    const move = moveTask(tasks, "c", "a");
    expect(move?.next.map((entry) => [entry.id, entry.position])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect(move?.changed.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves a task whose position did not change out of the changed ones", () => {
    const move = moveTask([task("a", 0), task("b", 1), task("c", 2)], "b", "c");
    expect(move?.changed.map((entry) => entry.id)).toEqual(["c", "b"]);
  });

  it("is none for a move onto itself or to a task that is not there", () => {
    expect(moveTask(tasks, "a", "a")).toBeNull();
    expect(moveTask(tasks, "a", "nowhere")).toBeNull();
    expect(moveTask(tasks, "nowhere", "a")).toBeNull();
  });

  it("does not reorder the tasks it was given", () => {
    moveTask(tasks, "c", "a");
    expect(tasks.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });
});
