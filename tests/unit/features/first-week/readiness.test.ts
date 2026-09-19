import { describe, it, expect } from "vitest";
import {
  buildReadiness,
  MIN_LIVE_POOL,
  type BuildReadinessInput,
} from "../../../../src/features/first-week/readiness";
import type { ArrivalStep, DerivableArrivalStep } from "../../../../src/features/arrival/types";
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

    it("flags closed pool tasks as info", () => {
      const readiness = buildReadiness(readyInput({ stale: [task({ id: "s1" })] }));

      const check = readiness.openChecks.find((one) => one.id === "pool-closed");
      expect(check?.severity).toBe("info");
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
  });
});
