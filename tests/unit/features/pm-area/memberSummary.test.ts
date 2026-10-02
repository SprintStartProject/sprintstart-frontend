import { describe, it, expect } from "vitest";
import { memberSummaryData } from "../../../../src/features/pm-area/memberSummary";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/features/onboarding/types";

function step(
  id: string,
  status: OnboardingStepEndpoint["status"],
  overrides: Partial<OnboardingStepEndpoint> = {},
): OnboardingStepEndpoint {
  return {
    id,
    phaseId: "p1",
    position: 0,
    title: id,
    description: "",
    type: "TASK",
    estimatedMinutes: 30,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...overrides,
  };
}

function path(steps: OnboardingStepEndpoint[]): OnboardingPathEndpoint {
  return {
    id: "path1",
    userId: "u1",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 1000).toISOString(),
    phases: [
      {
        id: "p1",
        pathId: "path1",
        position: 0,
        title: "Setup",
        description: "",
        locked: false,
        steps,
        questions: [],
      },
    ],
  };
}

describe("memberSummaryData", () => {
  it("counts the steps by state, and the workload by the steps' estimates", () => {
    const data = memberSummaryData(
      path([
        step("a", "FINISHED"),
        step("b", "SKIPPED", { estimatedMinutes: 60 }),
        step("c", "IN_PROGRESS"),
        step("d", "WAITING", { estimatedMinutes: 90 }),
      ]),
      [],
    );

    expect(Object.fromEntries(data.stepStates.map((state) => [state.key, state.value]))).toEqual({
      done: 1,
      active: 1,
      skipped: 1,
      todo: 1,
    });
    expect(data.estimated).toBe(210);
    expect(data.closedEstimate).toBe(90);
    expect(data.runningDays).toBe(3);
  });

  it("reads what the member said: thumbs, and skip requests by outcome", () => {
    const skip = (accepted: boolean | null) => ({
      id: `skip-${String(accepted)}`,
      stepId: "x",
      reason: "",
      accepted,
      reviewComment: null,
      reviewedAt: null,
    });
    const feedback = (helpful: boolean) => ({
      id: `f-${String(helpful)}`,
      stepId: "x",
      helpful,
      comment: "",
      createdAt: "",
    });

    const data = memberSummaryData(
      path([
        step("a", "FINISHED", { feedback: feedback(true) }),
        step("b", "FINISHED", { feedback: feedback(false) }),
        step("c", "IN_PROGRESS", { skip: skip(null) }),
        step("d", "SKIPPED", { skip: skip(true) }),
        step("e", "WAITING", { skip: skip(false) }),
      ]),
      [{ id: "f1", message: "Nice", read: true }],
    );

    expect([data.helpful, data.unhelpful, data.comments]).toEqual([1, 1, 1]);
    expect([data.pendingSkips, data.approvedSkips, data.declinedSkips]).toEqual([1, 1, 1]);
  });

  it("has nothing to count without a path", () => {
    const data = memberSummaryData(null, []);

    expect(data.phases).toEqual([]);
    expect(data.stepCount).toBe(0);
    expect(data.progress).toBeNull();
  });
});
