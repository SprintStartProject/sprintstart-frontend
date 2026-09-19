import { mergedStepCount } from "../arrival/mergedSteps";
import type { DerivableArrivalStep, ArrivalStep } from "../arrival/types";
import type { StarterWorkFocus } from "../starter-work/components/StarterWorkSection";
import type { StarterWorkTask } from "../starter-work/types";

/** Below this many LIVE tasks, the pool no longer gives a hire a real choice. */
export const MIN_LIVE_POOL = 5;
/** How stale the pool's last sync against its trackers may get before it is worth a nudge. */
export const SYNC_STALE_DAYS = 7;

/** The three preparation stages a hire moves through, in the order they happen. */
export type ReadinessStage = "arrive" | "task0" | "starter";

/** How urgently a check is worth a PM's attention. */
export type CheckSeverity = "critical" | "warning" | "info";

/**
 * A one-shot jump into the Arrival tab's add-step flow, set by a readiness check.
 *
 * Mirrors `StarterWorkFocus` on the arrival side: `"add"` is the only jump today, ahead of the
 * Overview readiness list actually wiring it up.
 */
export type ArrivalFocus = "add";

/** Where a readiness check's action label sends the PM, and what it should do once it lands. */
export type OverviewTarget =
  { tab: "arrival"; focus?: ArrivalFocus } | { tab: "starter"; focus?: StarterWorkFocus };

/** One open condition worth a PM's attention, tied to the stage it affects. */
export type ReadinessCheck = {
  id: string;
  stage: ReadinessStage;
  severity: CheckSeverity;
  title: string;
  description: string;
  actionLabel: string;
  target: OverviewTarget;
};

/** A stage's overall state, derived from the checks still open against it. */
export type StageReadiness = {
  stage: ReadinessStage;
  /** `missing` if a critical check is open, `attention` if only warnings are, else `ready`. */
  status: "ready" | "attention" | "missing";
  checks: ReadinessCheck[];
};

export type BuildReadinessInput = {
  company: ArrivalStep[] | null;
  project: ArrivalStep[] | null;
  derivable: DerivableArrivalStep[];
  /** The LIVE starter-work pool. */
  pool: StarterWorkTask[];
  /** The pool's tasks reconciliation found closed at their source. */
  stale: StarterWorkTask[];
  unseenCount: number;
  projectName: string | null;
  now: Date;
};

export type Readiness = {
  stages: Record<ReadinessStage, StageReadiness>;
  /** Every open check across all stages, sorted worst-first (then by stage order). */
  openChecks: ReadinessCheck[];
};

const STAGE_ORDER: ReadinessStage[] = ["arrive", "task0", "starter"];
const SEVERITY_ORDER: Record<CheckSeverity, number> = { critical: 0, warning: 1, info: 2 };

function arrivalChecks(input: BuildReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  if (mergedStepCount(input.company, input.project) === 0) {
    checks.push({
      id: "arrival-empty",
      stage: "arrive",
      severity: "critical",
      title: "The arrival list is empty",
      description: "New hires have nothing to check off before they start.",
      actionLabel: "Add a step",
      target: { tab: "arrival", focus: "add" },
    });
  }

  const githubCheck = input.derivable.find(
    (candidate) => candidate.key === "github-account" && !candidate.added,
  );
  if (githubCheck) {
    checks.push({
      id: "arrival-github",
      stage: "arrive",
      severity: "warning",
      title: "The GitHub check isn't on the list",
      description:
        "Without it, a hire who can't clone the repository can still be pointed at work.",
      actionLabel: "Add the GitHub check",
      target: { tab: "arrival", focus: "add" },
    });
  }

  const otherMissingDerivable = input.derivable.filter(
    (candidate) => !candidate.added && candidate.key !== "github-account",
  );
  if (otherMissingDerivable.length > 0) {
    const count = otherMissingDerivable.length;
    checks.push({
      id: "arrival-derivable",
      stage: "arrive",
      severity: "info",
      title: `${count} automatic ${count === 1 ? "check isn't" : "checks aren't"} on the list`,
      description: "SprintStart can check these itself, so hires don't have to tick them.",
      actionLabel: "Add them",
      target: { tab: "arrival", focus: "add" },
    });
  }

  if (input.projectName !== null && (input.project ?? []).length === 0) {
    checks.push({
      id: "arrival-no-project-steps",
      stage: "arrive",
      severity: "info",
      title: `${input.projectName} hasn't added anything of its own`,
      description: "Every step a hire on this project sees is company-wide.",
      actionLabel: "Add a project step",
      target: { tab: "arrival", focus: "add" },
    });
  }

  return checks;
}

function taskZeroChecks(input: BuildReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  const taskZeroTasks = input.pool.filter((task) => task.taskZeroEligible);
  if (taskZeroTasks.length === 0) {
    checks.push({
      id: "task0-none",
      stage: "task0",
      severity: "critical",
      title: "No Task 0 yet",
      description: "New hires get no automatic first task until one pool task is marked Task 0.",
      actionLabel: "Choose Task 0",
      target: { tab: "starter", focus: "task0" },
    });
  } else if (taskZeroTasks.every((task) => task.sourceHasAssignee === true)) {
    checks.push({
      id: "task0-taken",
      stage: "task0",
      severity: "warning",
      title: "Every Task 0 is already taken",
      description: "The next hire to arrive would land on a task somebody else is already doing.",
      actionLabel: "Choose another",
      target: { tab: "starter", focus: "task0" },
    });
  }

  if (input.stale.some((task) => task.taskZeroEligible)) {
    checks.push({
      id: "task0-closed",
      stage: "task0",
      severity: "warning",
      title: "A Task 0 was closed in its tracker",
      description: "It's still marked as an automatic first task, but the issue behind it is gone.",
      actionLabel: "Review closed",
      target: { tab: "starter", focus: "closed" },
    });
  }

  return checks;
}

/** Whether the pool's freshest sync is missing or older than `SYNC_STALE_DAYS`. */
function poolSyncIsStale(pool: StarterWorkTask[], now: Date): boolean {
  const checkedTimestamps = pool
    .map((task) => task.sourceCheckedAt)
    .filter((checkedAt): checkedAt is string => checkedAt !== null)
    .map((checkedAt) => new Date(checkedAt).getTime());

  if (checkedTimestamps.length === 0) return true;

  const mostRecent = Math.max(...checkedTimestamps);
  const staleAfterMs = SYNC_STALE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - mostRecent > staleAfterMs;
}

function starterChecks(input: BuildReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  if (input.unseenCount > 0) {
    checks.push({
      id: "pool-unseen",
      stage: "starter",
      severity: "warning",
      title: `${input.unseenCount} ${input.unseenCount === 1 ? "task" : "tasks"} nobody has looked at yet`,
      description: "Hires can already pick them. A quick look moves the good ones up their list.",
      actionLabel: "Go through them",
      target: { tab: "starter", focus: "triage" },
    });
  }

  if (input.pool.length < MIN_LIVE_POOL) {
    checks.push({
      id: "pool-small",
      stage: "starter",
      severity: "warning",
      title: `Only ${input.pool.length} ${input.pool.length === 1 ? "task" : "tasks"} in the pool`,
      description: `Aim for at least ${MIN_LIVE_POOL} so hires have a real choice.`,
      actionLabel: "Find more",
      target: { tab: "starter" },
    });
  }

  if (input.pool.length > 0 && poolSyncIsStale(input.pool, input.now)) {
    checks.push({
      id: "pool-sync",
      stage: "starter",
      severity: "info",
      title: "The pool hasn't been synced recently",
      description: "Closed issues and new assignees may not be reflected yet.",
      actionLabel: "Sync now",
      target: { tab: "starter", focus: "sync" },
    });
  }

  if (input.stale.length > 0) {
    checks.push({
      id: "pool-closed",
      stage: "starter",
      severity: "info",
      title: `${input.stale.length} ${input.stale.length === 1 ? "task" : "tasks"} closed in their tracker`,
      description: "They're still listed here until someone looks at them.",
      actionLabel: "Look at closed",
      target: { tab: "starter", focus: "closed" },
    });
  }

  return checks;
}

function stageStatus(checks: ReadinessCheck[]): StageReadiness["status"] {
  if (checks.some((check) => check.severity === "critical")) return "missing";
  if (checks.some((check) => check.severity === "warning")) return "attention";
  return "ready";
}

/**
 * Runs every readiness check against the current arrival lists, pool and review queue, and rolls
 * the result up into a status per stage plus one prioritised list of what to fix.
 *
 * `now` is a parameter rather than read from `Date.now()` internally so the pool-freshness check
 * stays deterministic in tests.
 */
export function buildReadiness(input: BuildReadinessInput): Readiness {
  const checksByStage: Record<ReadinessStage, ReadinessCheck[]> = {
    arrive: arrivalChecks(input),
    task0: taskZeroChecks(input),
    starter: starterChecks(input),
  };

  const stages = Object.fromEntries(
    STAGE_ORDER.map((stage) => [
      stage,
      { stage, status: stageStatus(checksByStage[stage]), checks: checksByStage[stage] },
    ]),
  ) as Record<ReadinessStage, StageReadiness>;

  const openChecks = STAGE_ORDER.flatMap((stage) => checksByStage[stage]).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0
      ? bySeverity
      : STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
  });

  return { stages, openChecks };
}
