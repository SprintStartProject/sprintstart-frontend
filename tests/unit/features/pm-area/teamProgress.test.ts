import { describe, it, expect } from "vitest";
import { teamProgressData } from "../../../../src/features/pm-area/teamProgress";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

const DAY = 24 * 60 * 60 * 1000;

function member(
  userId: string,
  progressPercentage: number,
  daysOnStep: number | null = null,
): TeamOverviewUser {
  return {
    userId,
    firstname: userId,
    lastname: "",
    projects: [],
    roles: [],
    skills: [],
    progressPercentage,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep:
      daysOnStep === null
        ? null
        : {
            id: `s-${userId}`,
            title: "Step",
            startedAt: new Date(Date.now() - daysOnStep * DAY - 1000).toISOString(),
            skip: null,
          },
    hasFeedback: false,
  };
}

describe("teamProgressData", () => {
  it("counts the team by stage and averages the progress", () => {
    const { stages, averageProgress } = teamProgressData([
      member("a", 0),
      member("b", 0.5, 1),
      member("c", 1),
    ]);

    expect(stages.map((stage) => [stage.key, stage.value])).toEqual([
      ["not-started", 1],
      ["underway", 1],
      ["done", 1],
    ]);
    expect(averageProgress).toBe(50);
  });
});
