import type { ArrivalFocus } from "../arrival/components/ArrivalStepAuthoring";
import { mergedStepCount } from "../arrival/mergedSteps";
import type { DerivableArrivalStep, ArrivalStep } from "../arrival/types";
import { isAwaitingFirstResponse } from "../onboarding-metrics/hireStatus";
import type { HireTimeline } from "../onboarding-metrics/types";
import type { StarterWorkFocus } from "../starter-work/components/StarterWorkSection";
import type { StarterWorkTask } from "../starter-work/types";

/** Below this many LIVE tasks, the pool no longer gives a hire a real choice. */
export const MIN_LIVE_POOL = 5;
/** How stale the pool's last sync against its trackers may get before it is worth a nudge. */
export const SYNC_STALE_DAYS = 7;
/** How long after joining a hire still counts as "in their first weeks" on their own. */
export const HIRE_WINDOW_DAYS = 14;
/** How many hires `hiresInFirstWeeks` returns — what the Overview tab has room to show. */
export const MAX_FIRST_WEEK_HIRES = 5;
/** How many days a hire's first contribution can sit without a response before it is critical. */
export const RESPONSE_WAIT_DAYS = 2;

/** The three preparation stages a hire moves through, in the order they happen. */
export type ReadinessStage = "arrive" | "task0" | "starter";

/**
 * A readiness check's stage, for grouping and sort order. `"hires"` is not one of the three
 * preparation stages above — it has no `StageCard` and never affects a `StageReadiness.status` —
 * it exists so a real hire's own trouble (stalled, no GitHub login) can still show up in
 * `openChecks` alongside the preparation checks.
 */
export type ReadinessCheckStage = ReadinessStage | "hires";

/** How urgently a check is worth a PM's attention. */
export type CheckSeverity = "critical" | "warning" | "info";

/**
 * Where a readiness check's action label sends the PM, and what it should do once it lands.
 * `{ hire }` opens that hire's own timeline (see `OverviewSection`, which intercepts it before it
 * can reach a plain tab switch) rather than jumping within the First Week tabs.
 */
export type OverviewTarget =
  | { tab: "arrival"; focus?: ArrivalFocus }
  | { tab: "starter"; focus?: StarterWorkFocus }
  | { hire: string };

/** One open condition worth a PM's attention, tied to the stage it affects. */
export type ReadinessCheck = {
  id: string;
  stage: ReadinessCheckStage;
  severity: CheckSeverity;
  title: string;
  /** A few words for a stage column's status line — see `StageColumn`. */
  shortTitle: string;
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
  /**
   * The project's onboarding hires, when that data has loaded. Optional and defaulted to none —
   * `FirstWeekHires` fetches it independently of everything else here, so a slow or failed load
   * must not stop the rest of readiness from rendering.
   */
  hires?: HireTimeline[];
  now: Date;
};

export type Readiness = {
  stages: Record<ReadinessStage, StageReadiness>;
  /** Every open check across all stages, sorted worst-first (then by stage order). */
  openChecks: ReadinessCheck[];
};

const STAGE_ORDER: ReadinessStage[] = ["arrive", "task0", "starter"];
const CHECK_STAGE_ORDER: ReadinessCheckStage[] = [...STAGE_ORDER, "hires"];
const SEVERITY_ORDER: Record<CheckSeverity, number> = { critical: 0, warning: 1, info: 2 };
const HIRE_WINDOW_MS = HIRE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function arrivalChecks(input: BuildReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  if (mergedStepCount(input.company, input.project) === 0) {
    checks.push({
      id: "arrival-empty",
      stage: "arrive",
      severity: "critical",
      title: "The arrival list is empty",
      shortTitle: "Empty",
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
      shortTitle: "No GitHub check",
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
      shortTitle: `${count} to add`,
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
      shortTitle: "No project steps",
      description: "Every step a hire on this project sees is company-wide.",
      actionLabel: "Add a project step",
      target: { tab: "arrival", focus: "add" },
    });
  }

  return checks;
}

/** "Lena", "Lena and Tom", "Lena, Tom and Mia" — join order matches `names` as given. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function taskZeroChecks(
  input: BuildReadinessInput,
  arrivingHires: HireTimeline[],
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  const taskZeroTasks = input.pool.filter((task) => task.taskZeroEligible);
  const freeTaskZeroTasks = taskZeroTasks.filter((task) => task.sourceHasAssignee !== true);
  if (taskZeroTasks.length === 0) {
    checks.push({
      id: "task0-none",
      stage: "task0",
      severity: "critical",
      title: "No Task 0 yet",
      shortTitle: "No Task 0 yet",
      description: "New hires get no automatic first task until one pool task is marked Task 0.",
      actionLabel: "Choose Task 0",
      target: { tab: "starter", focus: "task0" },
    });
  } else if (freeTaskZeroTasks.length === 0) {
    checks.push({
      id: "task0-taken",
      stage: "task0",
      severity: "warning",
      title: "Every Task 0 is already taken",
      shortTitle: "All taken",
      description: "The next hire to arrive would land on a task somebody else is already doing.",
      actionLabel: "Choose another",
      target: { tab: "starter", focus: "task0" },
    });
  } else if (arrivingHires.length > freeTaskZeroTasks.length) {
    checks.push({
      id: "task0-short",
      stage: "task0",
      severity: "warning",
      title: "Not enough Task 0 for who's coming",
      shortTitle: "Running low",
      description: `${joinNames(arrivingHires.map((hire) => hire.displayName))} will need a first task soon, only ${freeTaskZeroTasks.length} ${freeTaskZeroTasks.length === 1 ? "is" : "are"} marked.`,
      actionLabel: "Choose Task 0",
      target: { tab: "starter", focus: "task0" },
    });
  }

  if (input.stale.some((task) => task.taskZeroEligible)) {
    checks.push({
      id: "task0-closed",
      stage: "task0",
      severity: "warning",
      title: "A Task 0 was closed in its tracker",
      shortTitle: "One closed",
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
      shortTitle: `${input.unseenCount} not looked at`,
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
      shortTitle: "Running low",
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
      shortTitle: "Sync needed",
      description: "Closed issues and new assignees may not be reflected yet.",
      actionLabel: "Sync now",
      target: { tab: "starter", focus: "sync" },
    });
  }

  // Deliberately no "N tasks closed in their tracker" check here: a closed task isn't something a
  // PM can act on. The Closed tab is read-only (no approve/reject, nothing to reassign), and the
  // task returns to the pool on its own if the issue reopens — there is nothing to fix, so it does
  // not belong in a list of things that need a PM.

  return checks;
}

function joinedAtMs(hire: HireTimeline): number {
  return hire.joinedAt !== null ? new Date(hire.joinedAt).getTime() : Number.NEGATIVE_INFINITY;
}

/** Whole days between an ISO timestamp and `now`; null when the timestamp is null. */
function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Hires still worth watching on the Overview tab: joined within `HIRE_WINDOW_DAYS`, or — no
 * matter how long ago they joined — still without a first accepted contribution. Onboarding that
 * never lands does not get to age out of view just because the calendar moved on.
 *
 * Stalled hires sort first, then newest first — shared by `hiresInFirstWeeks` and `hiresByStage`
 * below, which differ only in whether the result is capped.
 */
function relevantFirstWeekHires(hires: HireTimeline[], now: Date): HireTimeline[] {
  return hires
    .filter((hire) => {
      const joinedRecently =
        hire.joinedAt !== null &&
        now.getTime() - new Date(hire.joinedAt).getTime() <= HIRE_WINDOW_MS;
      return joinedRecently || hire.firstContributionAcceptedAt === null;
    })
    .slice()
    .sort((a, b) => {
      if (a.stalled !== b.stalled) return a.stalled ? -1 : 1;
      return joinedAtMs(b) - joinedAtMs(a);
    });
}

/**
 * `relevantFirstWeekHires`, capped to `MAX_FIRST_WEEK_HIRES` — what the readiness checks below
 * have room to raise one per hire for.
 */
export function hiresInFirstWeeks(hires: HireTimeline[], now: Date): HireTimeline[] {
  return relevantFirstWeekHires(hires, now).slice(0, MAX_FIRST_WEEK_HIRES);
}

/** No claimed first task yet, a claimed task not yet accepted, or a first accepted contribution. */
export function hireStage(hire: HireTimeline): ReadinessStage {
  if (hire.firstTaskClaimedAt === null) return "arrive";
  if (hire.firstContributionAcceptedAt !== null) return "starter";
  return "task0";
}

/**
 * `relevantFirstWeekHires`, grouped by the stage each hire is currently in — what the Overview
 * board's three columns render under "Here now". Uncapped: each column applies its own display
 * limit rather than sharing one global cap across all three.
 */
export function hiresByStage(
  hires: HireTimeline[],
  now: Date,
): Record<ReadinessStage, HireTimeline[]> {
  const result = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, [] as HireTimeline[]]),
  ) as Record<ReadinessStage, HireTimeline[]>;
  for (const hire of relevantFirstWeekHires(hires, now)) {
    result[hireStage(hire)].push(hire);
  }
  return result;
}

/**
 * One check per real hire in trouble, on top of the three preparation stages above — a stalled
 * hire, one nobody can attribute work to, or one whose first contribution nobody has responded to
 * is a fact about them, not about the pool or the arrival list, so it gets its own stage
 * (`"hires"`) rather than being folded into `starter`. Each points at that hire's own timeline
 * rather than the Onboarding insights page — see `OverviewTarget`.
 *
 * Built from the same capped, sorted `hiresInFirstWeeks` list the Overview tab renders, so a hire
 * only ever shows up here if a PM can also see them there.
 */
function hireChecks(input: BuildReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  for (const hire of hiresInFirstWeeks(input.hires ?? [], input.now)) {
    if (hire.stalled) {
      checks.push({
        id: `hire-stalled-${hire.userId}`,
        stage: "hires",
        severity: "critical",
        title: `${hire.displayName} is stalled`,
        shortTitle: "Stalled",
        description: hire.stalledReason ?? "Nobody has moved this forward recently.",
        actionLabel: `See ${hire.displayName}'s timeline`,
        target: { hire: hire.userId },
      });
    }

    if (hire.githubLogin === null) {
      checks.push({
        id: `hire-no-github-${hire.userId}`,
        stage: "hires",
        severity: "warning",
        title: `${hire.displayName} has no GitHub login`,
        shortTitle: "No GitHub login",
        description: "Their work can't be attributed to them until they add one.",
        actionLabel: `See ${hire.displayName}'s timeline`,
        target: { hire: hire.userId },
      });
    }

    const waitingDays = isAwaitingFirstResponse(hire)
      ? daysSince(hire.firstContributionOpenedAt, input.now)
      : null;
    if (waitingDays !== null && waitingDays >= RESPONSE_WAIT_DAYS) {
      checks.push({
        id: `hire-waiting-${hire.userId}`,
        stage: "hires",
        severity: "critical",
        title: `${hire.displayName}'s first work has waited ${waitingDays} days`,
        shortTitle: "Waiting on review",
        description: `Nobody has responded yet. That move is on the reviewers, not on ${hire.displayName}.`,
        actionLabel: `See ${hire.displayName}'s timeline`,
        target: { hire: hire.userId },
      });
    }
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
  const arrivingHires = hiresByStage(input.hires ?? [], input.now).arrive;

  const checksByStage: Record<ReadinessStage, ReadinessCheck[]> = {
    arrive: arrivalChecks(input),
    task0: taskZeroChecks(input, arrivingHires),
    starter: starterChecks(input),
  };

  const stages = Object.fromEntries(
    STAGE_ORDER.map((stage) => [
      stage,
      { stage, status: stageStatus(checksByStage[stage]), checks: checksByStage[stage] },
    ]),
  ) as Record<ReadinessStage, StageReadiness>;

  const openChecks = [
    ...STAGE_ORDER.flatMap((stage) => checksByStage[stage]),
    ...hireChecks(input),
  ].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0
      ? bySeverity
      : CHECK_STAGE_ORDER.indexOf(a.stage) - CHECK_STAGE_ORDER.indexOf(b.stage);
  });

  return { stages, openChecks };
}
