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

  it("bins the members underway by time on their step, and marks the ones past the limit", () => {
    const { stepBins, atRisk } = teamProgressData([
      member("today", 0.2, 0),
      member("two", 0.2, 2),
      member("week", 0.2, 7),
      member("month", 0.2, 30),
      member("finished", 1, 40),
    ]);

    expect(stepBins.map((bin) => bin.value)).toEqual([1, 1, 0, 1, 1]);
    expect(stepBins.at(-1)?.hint).toBe("month");
    expect(stepBins.at(-1)?.colorClassName).toBe("text-app-warning-solid");
    expect(stepBins[0].colorClassName).toBe("text-app-brand");
    // Somebody who has finished is not "stuck" on the step they finished on.
    expect(atRisk).toBe(2);
  });
});
