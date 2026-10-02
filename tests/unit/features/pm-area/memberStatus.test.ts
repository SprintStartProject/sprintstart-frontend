import { describe, it, expect, vi, afterEach } from "vitest";
import {
  daysOnStep,
  isAtRisk,
  memberName,
  memberStage,
  progressPercent,
  waitingOn,
} from "../../../../src/features/pm-area/memberStatus";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

function member(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Ada",
    lastname: "Lovelace",
    projects: [],
    roles: [],
    skills: [],
    progressPercentage: 0,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep: null,
    hasFeedback: false,
    ...overrides,
  };
}

function stepStartedDaysAgo(days: number): TeamOverviewUser["currentStep"] {
  return {
    id: "s1",
    title: "Set up CI",
    startedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 1000).toISOString(),
    skip: null,
  };
}

describe("memberStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // The backend sends done / total. Reading it as a percentage is what kept the dashboard's
  // team widget from ever counting anybody as finished.
  it("reads progress as the fraction the backend sends", () => {
    expect(progressPercent(member({ progressPercentage: 0.456 }))).toBe(46);
    expect(memberStage(member({ progressPercentage: 1 }))).toBe("done");
    expect(memberStage(member({ progressPercentage: 0.2 }))).toBe("underway");
    expect(memberStage(member({ progressPercentage: 0 }))).toBe("not-started");
  });

  it("flags a member only once they have been on one step for more than five days", () => {
    expect(daysOnStep(member())).toBeNull();
    expect(isAtRisk(member({ currentStep: stepStartedDaysAgo(5) }))).toBe(false);
    expect(isAtRisk(member({ currentStep: stepStartedDaysAgo(6) }))).toBe(true);
  });

  it("lists a skip request before unread feedback", () => {
    const waiting = member({
      hasFeedback: true,
      currentStep: {
        ...stepStartedDaysAgo(1)!,
        skip: {
          id: "k1",
          stepId: "s1",
          reason: "",
          status: "PENDING",
          reviewComment: null,
          reviewedAt: null,
        },
      },
    });

    expect(waitingOn(waiting)).toEqual(["skip", "feedback"]);
    expect(waitingOn(member())).toEqual([]);
  });

  it("names a member without a name rather than showing a blank", () => {
    expect(memberName(member({ firstname: "", lastname: "" }))).toBe("Unnamed member");
  });
});
