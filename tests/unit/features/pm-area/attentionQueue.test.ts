import { describe, it, expect } from "vitest";
import { buildAttentionQueue } from "../../../../src/features/pm-area/attentionQueue";
import type { AttentionItem } from "../../../../src/features/onboarding-metrics/types";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

function member(overrides: Partial<TeamOverviewUser>): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Test",
    lastname: "Member",
    projects: [],
    roles: [],
    skills: [],
    progressPercentage: 0.3,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep: null,
    hasFeedback: false,
    ...overrides,
  };
}

function startedDaysAgo(days: number, skipPending = false): TeamOverviewUser["currentStep"] {
  return {
    id: "s1",
    title: "Set up CI",
    startedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 1000).toISOString(),
    skip: skipPending
      ? {
          id: "k1",
          stepId: "s1",
          reason: "",
          status: "PENDING",
          reviewComment: null,
          reviewedAt: null,
        }
      : null,
  };
}

const waitingOnReview = (hireId: string, hireName: string): AttentionItem => ({
  hireId,
  hireName,
  reason: "Waiting 2 days on a review",
  severity: "BLOCKED",
  days: 2,
});

describe("buildAttentionQueue", () => {
  it("gives each person one entry with every reason on it", () => {
    const queue = buildAttentionQueue(
      [
        member({
          userId: "bob",
          firstname: "Bob",
          hasFeedback: true,
          currentStep: startedDaysAgo(1, true),
        }),
      ],
      [waitingOnReview("bob", "Bob Member")],
    );

    expect(queue).toHaveLength(1);
    expect(queue[0].reasons.map((reason) => reason.kind)).toEqual([
      "skip",
      "feedback",
      "waiting-review",
    ]);
  });

  it("orders people by their most pressing reason", () => {
    const queue = buildAttentionQueue(
      [
        member({ userId: "stuck", firstname: "Stu", currentStep: startedDaysAgo(9) }),
        member({ userId: "feedback", firstname: "Fey", hasFeedback: true }),
        member({ userId: "skip", firstname: "Skip", currentStep: startedDaysAgo(1, true) }),
      ],
      [{ ...waitingOnReview("drift", "Dri Ft"), severity: "DRIFTING" }],
    );

    expect(queue.map((entry) => entry.userId)).toEqual(["skip", "feedback", "drift", "stuck"]);
  });

  // A long step on somebody who already asked to skip it is the same story told twice.
  it("does not add a long step to a person already in the queue", () => {
    const queue = buildAttentionQueue(
      [member({ userId: "bob", currentStep: startedDaysAgo(9, true) })],
      [],
    );

    expect(queue[0].reasons.map((reason) => reason.kind)).toEqual(["skip"]);
  });

  it("keeps a hire the roster does not know, under the metrics' name for them", () => {
    const queue = buildAttentionQueue([], [waitingOnReview("ghost", "Gus Host")]);

    expect(queue).toEqual([
      expect.objectContaining({ userId: "ghost", name: "Gus Host", member: null }),
    ]);
  });
});
