import { describe, expect, it } from "vitest";
import {
  failureMessage,
  isBehind,
  keepTyping,
  minutesBetween,
  needsRead,
  pendingSkipOf,
  skipStateOf,
  sortedByPosition,
  taskProgress,
  tasksToGoLabel,
  workedLabel,
} from "../../../../../../src/features/onboarding/components/journey/workspace/workspaceRules";
import type {
  OnboardingStepDetail,
  OnboardingStepSkip,
  OnboardingTaskEndpoint,
} from "../../../../../../src/features/onboarding/types";

function step(overrides: Partial<OnboardingStepDetail> = {}): OnboardingStepDetail {
  return {
    id: "s1",
    status: "IN_PROGRESS",
    skip: null,
    ...overrides,
  } as OnboardingStepDetail;
}

function skip(overrides: Partial<OnboardingStepSkip> = {}): OnboardingStepSkip {
  return {
    id: "k1",
    stepId: "s1",
    reason: "I know it",
    accepted: null,
    reviewComment: null,
    reviewedAt: null,
    ...overrides,
  };
}

function task(id: string, position: number, finished = false): OnboardingTaskEndpoint {
  return { id, position, finished, title: id, description: "" } as OnboardingTaskEndpoint;
}

describe("minutesBetween", () => {
  it("floors whole minutes and never goes below zero", () => {
    const start = "2026-08-01T10:00:00Z";
    const at = (seconds: number) => new Date(start).getTime() + seconds * 1000;

    expect(minutesBetween(start, at(59))).toBe(0);
    expect(minutesBetween(start, at(60))).toBe(1);
    expect(minutesBetween(start, at(185))).toBe(3);
    expect(minutesBetween(start, at(-600))).toBe(0);
  });
});

describe("isBehind", () => {
  it("is true for finished and skipped steps only", () => {
    expect(isBehind(step({ status: "FINISHED" }))).toBe(true);
    expect(isBehind(step({ status: "SKIPPED" }))).toBe(true);
    expect(isBehind(step({ status: "IN_PROGRESS" }))).toBe(false);
    expect(isBehind(step({ status: "WAITING" }))).toBe(false);
  });
});

describe("workedLabel", () => {
  const startedAt = "2026-08-01T10:00:00Z";
  const startMs = new Date(startedAt).getTime();

  it("is null before the step was started", () => {
    expect(workedLabel(step({ startedAt: null }), startMs)).toBeNull();
  });

  it("counts up to now while the step is open", () => {
    const label = workedLabel(step({ startedAt }), startMs + 12 * 60_000);

    expect(label).toMatch(/^· on it for /);
    expect(label).toContain("12");
  });

  it("measures to the completion once the step is behind the member", () => {
    const label = workedLabel(
      step({ status: "FINISHED", startedAt, completedAt: "2026-08-01T10:30:00Z" }),
      startMs + 10_000 * 60_000,
    );

    expect(label).toMatch(/^· took /);
    expect(label).toContain("30");
  });

  it("shows at least a minute", () => {
    expect(workedLabel(step({ startedAt }), startMs)).toContain("1");
  });
});

describe("skipStateOf", () => {
  it("is null without a skip request", () => {
    expect(skipStateOf(step())).toBeNull();
  });

  it("is pending while nobody has answered", () => {
    expect(skipStateOf(step({ skip: skip({ accepted: null }) }))).toBe("pending");
  });

  it("is approved when accepted", () => {
    expect(skipStateOf(step({ skip: skip({ accepted: true }) }))).toBe("approved");
  });

  it("is declined when refused and the step is not skipped", () => {
    expect(skipStateOf(step({ skip: skip({ accepted: false }) }))).toBe("declined");
  });

  it("says nothing about a declined request on a step that ended up skipped", () => {
    expect(skipStateOf(step({ status: "SKIPPED", skip: skip({ accepted: false }) }))).toBeNull();
  });
});

describe("taskProgress / tasksToGoLabel", () => {
  it("counts done tasks and the rounded percentage", () => {
    const progress = taskProgress([task("a", 0, true), task("b", 1), task("c", 2)]);

    expect(progress).toEqual({ done: 1, total: 3, allDone: false, percent: 33 });
  });

  it("is complete when every task is done", () => {
    expect(taskProgress([task("a", 0, true)])).toMatchObject({ allDone: true, percent: 100 });
  });

  it("treats a step without tasks as done with no progress to show", () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, allDone: true, percent: 0 });
  });

  it("pluralises the open count", () => {
    expect(tasksToGoLabel(1)).toBe("1 task to go");
    expect(tasksToGoLabel(2)).toBe("2 tasks to go");
  });
});

describe("sortedByPosition", () => {
  it("orders by position without touching the input", () => {
    const input = [task("b", 2), task("a", 1)];

    expect(sortedByPosition(input).map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(input.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

describe("needsRead", () => {
  const last = {
    stepId: "s1",
    buddyChanges: 2,
    status: "IN_PROGRESS",
    skipReason: "",
    comment: "",
  };

  it("reads when nothing was read yet", () => {
    expect(needsRead(null, "s1", 0, "WAITING")).toBe(true);
  });

  it("does not read again for the same step, buddy count and status", () => {
    expect(needsRead(last, "s1", 2, "IN_PROGRESS")).toBe(false);
  });

  it("reads again when any of the three differs", () => {
    expect(needsRead(last, "s2", 2, "IN_PROGRESS")).toBe(true);
    expect(needsRead(last, "s1", 3, "IN_PROGRESS")).toBe(true);
    expect(needsRead(last, "s1", 2, "FINISHED")).toBe(true);
  });
});

describe("keepTyping", () => {
  it("keeps what the member typed when it differs from the last server text", () => {
    expect(keepTyping("my draft", "server v1", "server v2")).toBe("my draft");
  });

  it("takes the server text when the field still shows the last server text", () => {
    expect(keepTyping("server v1", "server v1", "server v2")).toBe("server v2");
  });

  it("takes the server text on the first read of a step", () => {
    expect(keepTyping("stale", undefined, "server")).toBe("server");
  });
});

describe("pendingSkipOf / failureMessage", () => {
  it("turns a created skip into an unanswered request", () => {
    const created = { id: "k9", stepId: "s1", reason: "r", reviewComment: "c" };

    expect(pendingSkipOf(created as never)).toEqual({
      id: "k9",
      stepId: "s1",
      reason: "r",
      accepted: null,
      reviewComment: "c",
      reviewedAt: null,
    });
  });

  it("uses an error's own message and the fallback for anything else", () => {
    expect(failureMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(failureMessage("text", "fallback")).toBe("fallback");
  });
});
