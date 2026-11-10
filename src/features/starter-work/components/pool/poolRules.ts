import { formatRelativeDate } from "../../format";
import { parseCandidateSource } from "../../sourceId";
import type { StarterWorkTask } from "../../types";

export type PoolStatusFilter = "all" | "unseen" | "seen" | "taskZero" | "closed";

const STATUS_FILTER_ORDER: PoolStatusFilter[] = ["all", "unseen", "seen", "taskZero", "closed"];

export const STATUS_FILTER_LABELS: Record<PoolStatusFilter, string> = {
  all: "All",
  unseen: "New",
  seen: "Looked at",
  taskZero: "Task 0",
  closed: "Closed",
};

export type PoolStatusCounts = Record<PoolStatusFilter, number>;

/** "Closed 2 days ago" for a task shown under the Closed filter, or null with no timestamp to phrase one from. */
export function closedLineFor(task: StarterWorkTask): string | null {
  return task.sourceCheckedAt ? `Closed ${formatRelativeDate(task.sourceCheckedAt)}` : null;
}

/** The repo/Jira-project keys the corpus candidates belong to. */
export function groupKeysOf(candidates: { sourceId: string }[] | undefined): Set<string> {
  const keys = new Set<string>();
  (candidates ?? []).forEach((candidate) => {
    const groupKey = parseCandidateSource(candidate.sourceId).groupKey;
    if (groupKey) keys.add(groupKey);
  });
  return keys;
}

/** Unseen tasks first, within an otherwise stable order — a page change never moves a task for no visible reason. */
export function unseenFirst(tasks: StarterWorkTask[]): StarterWorkTask[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    const aUnseen = !a.reviewed;
    const bUnseen = !b.reviewed;
    return aUnseen === bUnseen ? 0 : aUnseen ? -1 : 1;
  });
  return sorted;
}

/** Most recently closed first; tasks without a timestamp sink to the end. */
export function mostRecentlyClosedFirst(tasks: StarterWorkTask[]): StarterWorkTask[] {
  return [...tasks].sort((a, b) => {
    if (!a.sourceCheckedAt) return 1;
    if (!b.sourceCheckedAt) return -1;
    return b.sourceCheckedAt.localeCompare(a.sourceCheckedAt);
  });
}

/** The newest moment reconciliation compared any of these tasks against its source, or null. */
export function latestCheckedAt(tasks: StarterWorkTask[]): string | null {
  return tasks.reduce<string | null>((latest, current) => {
    if (!current.sourceCheckedAt) return latest;
    if (!latest || current.sourceCheckedAt > latest) return current.sourceCheckedAt;
    return latest;
  }, null);
}

/** Keeps only the tasks whose source belongs to one of the project's groups. */
export function onlyInProject(
  tasks: StarterWorkTask[],
  projectGroupKeys: ReadonlySet<string>,
): StarterWorkTask[] {
  return tasks.filter((task) => {
    const groupKey = parseCandidateSource(task.sourceId).groupKey;
    return groupKey !== null && projectGroupKeys.has(groupKey);
  });
}

export function countStatuses(
  live: StarterWorkTask[],
  closed: StarterWorkTask[],
): PoolStatusCounts {
  return {
    all: live.length,
    unseen: live.filter((task) => !task.reviewed).length,
    seen: live.filter((task) => task.reviewed).length,
    taskZero: live.filter((task) => task.taskZeroEligible).length,
    closed: closed.length,
  };
}

/**
 * The tabs shown in the bar. "Closed" stays out until the first closed task — a tab that is always
 * empty is clutter — except while it is the active filter, so syncing it away never pulls the bar out
 * from under the reader.
 */
export function visibleStatusFilters(
  closedCount: number,
  active: PoolStatusFilter,
): PoolStatusFilter[] {
  return STATUS_FILTER_ORDER.filter(
    (value) => value !== "closed" || closedCount > 0 || active === "closed",
  );
}

/** The live tasks one non-closed status filter shows. */
export function applyStatusFilter(
  tasks: StarterWorkTask[],
  filter: PoolStatusFilter,
): StarterWorkTask[] {
  return tasks.filter((task) => {
    if (filter === "unseen") return !task.reviewed;
    if (filter === "seen") return task.reviewed;
    if (filter === "taskZero") return task.taskZeroEligible;
    return true;
  });
}
