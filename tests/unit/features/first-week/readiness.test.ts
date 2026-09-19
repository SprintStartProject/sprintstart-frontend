import { describe, it, expect } from "vitest";
import {
  buildReadiness,
  hireStage,
  hiresByStage,
  hiresInFirstWeeks,
  MAX_FIRST_WEEK_HIRES,
  MIN_LIVE_POOL,
  RESPONSE_WAIT_DAYS,
  type BuildReadinessInput,
} from "../../../../src/features/first-week/readiness";
import type { ArrivalStep, DerivableArrivalStep } from "../../../../src/features/arrival/types";
import type { HireTimeline } from "../../../../src/features/onboarding-metrics/types";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

const NOW = new Date("2026-09-19T00:00:00.000Z");

function step(key: string, projectId: string | null = null): ArrivalStep {
  return {
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
  };
}

function derivable(key: string, added: boolean): DerivableArrivalStep {
  return {
    key,
    suggestedTitle: key,
    suggestedDescription: key,
    selfConfirmable: false,
    added,
  };
}

function task(over: Partial<StarterWorkTask> = {}): StarterWorkTask {
  return {
    id: "task-1",
    sourceId: "github:acme/repo:ISSUE:1",
    title: "Starter task",
    summary: null,
    rationale: null,
    sourceUrl: null,
    competencyKeys: [],
    status: "LIVE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: NOW.toISOString(),
    ...over,
  };
}

function hire(over: Partial<HireTimeline> = {}): HireTimeline {
  return {
    userId: "u1",
    displayName: "Hire One",
    githubLogin: "hire-one",
    joinedAt: NOW.toISOString(),
    firstTaskClaimedAt: null,
    firstContributionOpenedAt: null,
    firstResponseAt: null,
    firstContributionAcceptedAt: null,
    hoursToFirstAcceptedContribution: null,
    hoursToFirstResponse: null,
    acceptedContributionCount: 0,
    openContributionCount: 0,
    longestOpenWaitHours: null,
    stalled: false,
    stalledReason: null,
    ...over,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** A minimal input where every check is satisfied — nothing open, everything `ready`. */
function readyInput(over: Partial<BuildReadinessInput> = {}): BuildReadinessInput {
  return {
    company: [step("vpn")],
    project: null,
    derivable: [derivable("github-account", true)],
    pool: Array.from({ length: MIN_LIVE_POOL }, (_, index) =>
      task({ id: `task-${index}`, sourceCheckedAt: NOW.toISOString() }),
    ),
    stale: [],
    unseenCount: 0,
    projectName: null,
    now: NOW,
    ...over,
  };
}

describe("buildReadiness", () => {
  it("opens no checks and marks every stage ready when everything is satisfied", () => {
    const readiness = buildReadiness(
      readyInput({ pool: [task({ taskZeroEligible: true })].concat(readyInput().pool) }),
    );

    expect(readiness.openChecks).toEqual([]);
    expect(readiness.stages.arrive.status).toBe("ready");
    expect(readiness.stages.task0.status).toBe("ready");
    expect(readiness.stages.starter.status).toBe("ready");
  });

  describe("arrive stage", () => {
    it("flags an empty merged list as critical", () => {
      const readiness = buildReadiness(readyInput({ company: [], project: null }));

      const check = readiness.openChecks.find((one) => one.id === "arrival-empty");
      expect(check?.severity).toBe("critical");
      expect(readiness.stages.arrive.status).toBe("missing");
    });

    it("does not flag an empty company list when a project step fills it", () => {
      const readiness = buildReadiness(
        readyInput({ company: [], project: [step("staging", "p1")], projectName: "Apollo" }),
      );

      expect(readiness.openChecks.some((one) => one.id === "arrival-empty")).toBe(false);
    });

    it("warns when the GitHub derivable is not added", () => {
      const readiness = buildReadiness(
        readyInput({ derivable: [derivable("github-account", false)] }),
      );

      const check = readiness.openChecks.find((one) => one.id === "arrival-github");
      expect(check?.severity).toBe("warning");
      expect(readiness.stages.arrive.status).toBe("attention");
    });

    it("does not warn once the GitHub derivable is added", () => {
      const readiness = buildReadiness(
        readyInput({ derivable: [derivable("github-account", true)] }),
      );

      expect(readiness.openChecks.some((one) => one.id === "arrival-github")).toBe(false);
    });

    it("counts other missing derivable steps as one info check", () => {
      const readiness = buildReadiness(
        readyInput({
          derivable: [
            derivable("github-account", true),
            derivable("environment-ready", false),
            derivable("slack-invite", false),
          ],
        }),
      );

      const check = readiness.openChecks.find((one) => one.id === "arrival-derivable");
      expect(check?.severity).toBe("info");
      expect(check?.title).toContain("2");
      // Info checks show up in the list but never move a stage out of "ready".
      expect(readiness.stages.arrive.status).toBe("ready");
    });

    it("flags a selected project with no project steps of its own", () => {
      const readiness = buildReadiness(
        readyInput({ project: [], projectName: "Apollo", company: [step("vpn")] }),
      );

      const check = readiness.openChecks.find((one) => one.id === "arrival-no-project-steps");
      expect(check?.severity).toBe("info");
    });

    it("does not flag a missing project step when no project is selected", () => {
      const readiness = buildReadiness(readyInput({ project: null, projectName: null }));

      expect(readiness.openChecks.some((one) => one.id === "arrival-no-project-steps")).toBe(false);
    });
  });

  describe("task0 stage", () => {
    it("is critical when no pool task is Task 0 eligible", () => {
      const readiness = buildReadiness(readyInput({ pool: [task()] }));

      const check = readiness.openChecks.find((one) => one.id === "task0-none");
      expect(check?.severity).toBe("critical");
      expect(readiness.stages.task0.status).toBe("missing");
    });

    it("warns when every Task 0 task already has an assignee", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [task({ taskZeroEligible: true, sourceHasAssignee: true })],
        }),
      );

      const check = readiness.openChecks.find((one) => one.id === "task0-taken");
      expect(check?.severity).toBe("warning");
      expect(readiness.stages.task0.status).toBe("attention");
    });

    it("is ready when at least one Task 0 task has no assignee", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [
            task({ id: "t1", taskZeroEligible: true, sourceHasAssignee: true }),
            task({ id: "t2", taskZeroEligible: true, sourceHasAssignee: null }),
          ],
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "task0-taken")).toBe(false);
      expect(readiness.openChecks.some((one) => one.id === "task0-none")).toBe(false);
    });

    it("warns when a stale task is Task 0 eligible, alongside task0-none", () => {
      const readiness = buildReadiness(
        readyInput({ pool: [task()], stale: [task({ id: "s1", taskZeroEligible: true })] }),
      );

      const ids = readiness.openChecks.map((one) => one.id);
      expect(ids).toContain("task0-none");
      expect(ids).toContain("task0-closed");
    });

    it("warns about a Task 0 shortage when more hires are arriving than free Task 0 tasks", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [task({ id: "t0", taskZeroEligible: true, sourceHasAssignee: null })],
          hires: [
            hire({ userId: "a", displayName: "Lena", firstTaskClaimedAt: null }),
            hire({ userId: "b", displayName: "Tom", firstTaskClaimedAt: null }),
          ],
        }),
      );

      const check = readiness.openChecks.find((one) => one.id === "task0-short");
      expect(check?.severity).toBe("warning");
      expect(check?.description).toBe(
        "Lena and Tom will need a first task soon, only 1 is marked.",
      );
    });

    it("does not flag a shortage when there is no Task 0 task at all — task0-none covers it", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [task({ taskZeroEligible: false })],
          hires: [hire({ userId: "a", firstTaskClaimedAt: null })],
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "task0-short")).toBe(false);
      expect(readiness.openChecks.some((one) => one.id === "task0-none")).toBe(true);
    });

    it("does not flag a shortage when enough free Task 0 tasks are marked", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [
            task({ id: "t0", taskZeroEligible: true, sourceHasAssignee: null }),
            task({ id: "t1", taskZeroEligible: true, sourceHasAssignee: null }),
          ],
          hires: [hire({ userId: "a", firstTaskClaimedAt: null })],
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "task0-short")).toBe(false);
    });
  });

  describe("starter stage", () => {
    it("warns about unseen tasks", () => {
      const readiness = buildReadiness(readyInput({ unseenCount: 3 }));

      const check = readiness.openChecks.find((one) => one.id === "pool-unseen");
      expect(check?.severity).toBe("warning");
      expect(check?.title).toContain("3");
      expect(readiness.stages.starter.status).toBe("attention");
    });

    it("warns when the LIVE pool is smaller than the minimum", () => {
      const readiness = buildReadiness(readyInput({ pool: [task()] }));

      const check = readiness.openChecks.find((one) => one.id === "pool-small");
      expect(check?.severity).toBe("warning");
    });

    it("does not warn once the pool reaches the minimum", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: Array.from({ length: MIN_LIVE_POOL }, (_, index) =>
            task({ id: `t${index}`, sourceCheckedAt: NOW.toISOString() }),
          ),
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "pool-small")).toBe(false);
    });

    it("flags a pool that has never been synced", () => {
      const readiness = buildReadiness(readyInput({ pool: [task({ sourceCheckedAt: null })] }));

      const check = readiness.openChecks.find((one) => one.id === "pool-sync");
      expect(check?.severity).toBe("info");
      // Info checks show up in the list but never move a stage out of "ready" on their own.
      expect(readiness.stages.starter.status).toBe("attention");
    });

    it("flags a pool whose freshest sync is older than the stale window", () => {
      const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const readiness = buildReadiness(
        readyInput({ pool: [task({ sourceCheckedAt: eightDaysAgo })] }),
      );

      expect(readiness.openChecks.some((one) => one.id === "pool-sync")).toBe(true);
    });

    it("does not flag a pool synced within the stale window", () => {
      const sixDaysAgo = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const readiness = buildReadiness(
        readyInput({
          pool: Array.from({ length: MIN_LIVE_POOL }, (_, index) =>
            task({ id: `t${index}`, sourceCheckedAt: sixDaysAgo }),
          ),
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "pool-sync")).toBe(false);
    });

    it("does not flag sync freshness for an empty pool", () => {
      const readiness = buildReadiness(readyInput({ pool: [] }));

      expect(readiness.openChecks.some((one) => one.id === "pool-sync")).toBe(false);
    });

    // Deliberately no "closed pool tasks" check — see the comment in `starterChecks`: a closed
    // task self-heals and the Closed tab has no action to take, so it never becomes a check.
    it("never flags a stale (non-Task-0) pool task on its own", () => {
      const readiness = buildReadiness(readyInput({ stale: [task({ id: "s1" })] }));

      expect(readiness.openChecks.some((one) => one.stage === "starter")).toBe(false);
    });
  });

  describe("hires stage", () => {
    it("flags a stalled hire in the window as critical, without touching the other stages", () => {
      const readiness = buildReadiness(
        readyInput({
          pool: [task({ taskZeroEligible: true })].concat(readyInput().pool),
          hires: [hire({ stalled: true, stalledReason: "No response in 5 days" })],
        }),
      );

      const check = readiness.openChecks.find((one) => one.id === "hire-stalled-u1");
      expect(check?.severity).toBe("critical");
      expect(check?.description).toBe("No response in 5 days");
      expect(check?.target).toEqual({ hire: "u1" });
      expect(check?.actionLabel).toBe("See Hire One's timeline");
      expect(readiness.stages.arrive.status).toBe("ready");
      expect(readiness.stages.task0.status).toBe("ready");
      expect(readiness.stages.starter.status).toBe("ready");
    });

    it("warns about a hire in the window with no GitHub login", () => {
      const readiness = buildReadiness(readyInput({ hires: [hire({ githubLogin: null })] }));

      const check = readiness.openChecks.find((one) => one.id === "hire-no-github-u1");
      expect(check?.severity).toBe("warning");
    });

    it("does not flag a hire outside the window who already has an accepted contribution", () => {
      const readiness = buildReadiness(
        readyInput({
          hires: [
            hire({
              joinedAt: daysAgo(30),
              firstContributionAcceptedAt: daysAgo(10),
              stalled: true,
              githubLogin: null,
            }),
          ],
        }),
      );

      expect(readiness.openChecks.some((one) => one.stage === "hires")).toBe(false);
    });

    it("has no hire checks when no hires are given", () => {
      const readiness = buildReadiness(readyInput());

      expect(readiness.openChecks.some((one) => one.stage === "hires")).toBe(false);
    });

    it("does not flag a hire awaiting a response before the wait threshold", () => {
      const readiness = buildReadiness(
        readyInput({
          hires: [
            hire({
              firstContributionOpenedAt: daysAgo(RESPONSE_WAIT_DAYS - 1),
              firstResponseAt: null,
              openContributionCount: 1,
            }),
          ],
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "hire-waiting-u1")).toBe(false);
    });

    it("flags a hire awaiting a response once the wait threshold is reached", () => {
      const readiness = buildReadiness(
        readyInput({
          hires: [
            hire({
              firstContributionOpenedAt: daysAgo(RESPONSE_WAIT_DAYS),
              firstResponseAt: null,
              openContributionCount: 1,
            }),
          ],
        }),
      );

      const check = readiness.openChecks.find((one) => one.id === "hire-waiting-u1");
      expect(check?.severity).toBe("critical");
      expect(check?.title).toBe(`Hire One's first work has waited ${RESPONSE_WAIT_DAYS} days`);
      expect(check?.description).toBe(
        "Nobody has responded yet. That move is on the reviewers, not on Hire One.",
      );
      expect(check?.target).toEqual({ hire: "u1" });
      expect(check?.actionLabel).toBe("See Hire One's timeline");
    });

    it("does not flag a hire whose open contribution already got a response", () => {
      const readiness = buildReadiness(
        readyInput({
          hires: [
            hire({
              firstContributionOpenedAt: daysAgo(5),
              firstResponseAt: daysAgo(4),
              openContributionCount: 1,
            }),
          ],
        }),
      );

      expect(readiness.openChecks.some((one) => one.id === "hire-waiting-u1")).toBe(false);
    });
  });

  describe("sorting", () => {
    it("orders open checks by severity, then by stage order", () => {
      const readiness = buildReadiness(
        readyInput({
          company: [],
          project: null,
          derivable: [derivable("github-account", false)],
          pool: [task()],
          stale: [],
          unseenCount: 2,
        }),
      );

      expect(readiness.openChecks.map((one) => one.id)).toEqual([
        "arrival-empty",
        "task0-none",
        "arrival-github",
        "pool-unseen",
        "pool-small",
      ]);
    });

    it("sorts a hires-stage check after arrive/task0/starter checks of the same severity", () => {
      const readiness = buildReadiness(
        readyInput({
          company: [],
          project: null,
          pool: [task({ taskZeroEligible: true })].concat(readyInput().pool),
          hires: [hire({ stalled: true })],
        }),
      );

      // Both critical: arrival-empty (arrive) must still come before hire-stalled (hires).
      expect(readiness.openChecks.map((one) => one.id)).toEqual([
        "arrival-empty",
        "hire-stalled-u1",
      ]);
    });
  });
});

describe("hiresInFirstWeeks", () => {
  it("includes a hire who joined within the window even if already accepted", () => {
    const hires = hiresInFirstWeeks(
      [hire({ joinedAt: daysAgo(5), firstContributionAcceptedAt: daysAgo(1) })],
      NOW,
    );

    expect(hires.map((one) => one.userId)).toEqual(["u1"]);
  });

  it("includes a hire who joined long ago but was never accepted", () => {
    const hires = hiresInFirstWeeks(
      [hire({ joinedAt: daysAgo(60), firstContributionAcceptedAt: null })],
      NOW,
    );

    expect(hires.map((one) => one.userId)).toEqual(["u1"]);
  });

  it("excludes a hire who joined long ago and already has an accepted contribution", () => {
    const hires = hiresInFirstWeeks(
      [hire({ joinedAt: daysAgo(60), firstContributionAcceptedAt: daysAgo(30) })],
      NOW,
    );

    expect(hires).toEqual([]);
  });

  it("sorts stalled hires before non-stalled ones", () => {
    const hires = hiresInFirstWeeks(
      [
        hire({ userId: "calm", joinedAt: daysAgo(1), stalled: false }),
        hire({ userId: "stuck", joinedAt: daysAgo(2), stalled: true }),
      ],
      NOW,
    );

    expect(hires.map((one) => one.userId)).toEqual(["stuck", "calm"]);
  });

  it("sorts by most recently joined within the same stalled-ness", () => {
    const hires = hiresInFirstWeeks(
      [
        hire({ userId: "older", joinedAt: daysAgo(5) }),
        hire({ userId: "newer", joinedAt: daysAgo(1) }),
      ],
      NOW,
    );

    expect(hires.map((one) => one.userId)).toEqual(["newer", "older"]);
  });

  it(`caps the result at ${MAX_FIRST_WEEK_HIRES}`, () => {
    const many = Array.from({ length: MAX_FIRST_WEEK_HIRES + 3 }, (_, index) =>
      hire({ userId: `u${index}`, joinedAt: daysAgo(index) }),
    );

    expect(hiresInFirstWeeks(many, NOW)).toHaveLength(MAX_FIRST_WEEK_HIRES);
  });
});

describe("hireStage", () => {
  it("puts a hire with no claimed first task in arrive", () => {
    expect(hireStage(hire({ firstTaskClaimedAt: null }))).toBe("arrive");
  });

  it("puts a hire who claimed a task but has nothing accepted yet in task0", () => {
    expect(
      hireStage(hire({ firstTaskClaimedAt: daysAgo(1), firstContributionAcceptedAt: null })),
    ).toBe("task0");
  });

  it("puts a hire with a first accepted contribution in starter", () => {
    expect(
      hireStage(hire({ firstTaskClaimedAt: daysAgo(3), firstContributionAcceptedAt: daysAgo(1) })),
    ).toBe("starter");
  });
});

describe("hiresByStage", () => {
  it("groups hires by their current stage", () => {
    const byStage = hiresByStage(
      [
        hire({ userId: "arriving", firstTaskClaimedAt: null }),
        hire({
          userId: "on-task0",
          firstTaskClaimedAt: daysAgo(1),
          firstContributionAcceptedAt: null,
        }),
        hire({
          userId: "graduated",
          firstTaskClaimedAt: daysAgo(3),
          firstContributionAcceptedAt: daysAgo(1),
        }),
      ],
      NOW,
    );

    expect(byStage.arrive.map((one) => one.userId)).toEqual(["arriving"]);
    expect(byStage.task0.map((one) => one.userId)).toEqual(["on-task0"]);
    expect(byStage.starter.map((one) => one.userId)).toEqual(["graduated"]);
  });

  it(`is not capped at ${MAX_FIRST_WEEK_HIRES}, unlike hiresInFirstWeeks`, () => {
    const many = Array.from({ length: MAX_FIRST_WEEK_HIRES + 3 }, (_, index) =>
      hire({ userId: `u${index}`, joinedAt: daysAgo(index), firstTaskClaimedAt: null }),
    );

    expect(hiresByStage(many, NOW).arrive).toHaveLength(MAX_FIRST_WEEK_HIRES + 3);
  });

  it("excludes a hire outside the first-weeks window who already has accepted work", () => {
    const byStage = hiresByStage(
      [hire({ joinedAt: daysAgo(60), firstContributionAcceptedAt: daysAgo(30) })],
      NOW,
    );

    expect(byStage.arrive).toEqual([]);
    expect(byStage.task0).toEqual([]);
    expect(byStage.starter).toEqual([]);
  });
});
