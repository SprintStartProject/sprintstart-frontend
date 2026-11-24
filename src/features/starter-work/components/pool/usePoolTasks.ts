import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../services/queryKeys";
import { starterWorkService } from "../../../../services/starterWorkService";
import type { StarterWorkTask } from "../../../../services/starterWorkTypes";
import {
  applyStatusFilter,
  countStatuses,
  groupKeysOf,
  latestCheckedAt,
  mostRecentlyClosedFirst,
  onlyInProject,
  unseenFirst,
  type PoolStatusFilter,
} from "./poolRules";

/**
 * Which repos/Jira projects belong to the selected project's corpus — the same project-scoped query
 * `CorpusIssueBrowser` fetches, so an already-open browser costs this nothing extra.
 */
export function useProjectGroupKeys(selectedProjectId: string): ReadonlySet<string> {
  const { data: candidates } = useQuery({
    queryKey: queryKeys.starterWork.corpusIssues(selectedProjectId),
    queryFn: () => starterWorkService.fetchCandidates(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  return useMemo(() => groupKeysOf(candidates), [candidates]);
}

type PoolTaskSelection = {
  tasks: StarterWorkTask[];
  closedTasks: StarterWorkTask[];
  onlyProject: boolean;
  statusFilter: PoolStatusFilter;
  projectGroupKeys: ReadonlySet<string>;
};

/** The live and closed tasks after project scoping, their per-tab counts, and what the active tab shows. */
export function usePoolTasks({
  tasks,
  closedTasks,
  onlyProject,
  statusFilter,
  projectGroupKeys,
}: PoolTaskSelection) {
  const lastCheckedAt = useMemo(() => latestCheckedAt(tasks), [tasks]);

  const projectScopedTasks = useMemo(() => {
    const sorted = unseenFirst(tasks);
    return onlyProject ? onlyInProject(sorted, projectGroupKeys) : sorted;
  }, [tasks, onlyProject, projectGroupKeys]);

  const projectScopedClosedTasks = useMemo(() => {
    const sorted = mostRecentlyClosedFirst(closedTasks);
    return onlyProject ? onlyInProject(sorted, projectGroupKeys) : sorted;
  }, [closedTasks, onlyProject, projectGroupKeys]);

  const statusCounts = useMemo(
    () => countStatuses(projectScopedTasks, projectScopedClosedTasks),
    [projectScopedTasks, projectScopedClosedTasks],
  );

  const filteredTasks = useMemo(
    () =>
      statusFilter === "closed"
        ? projectScopedClosedTasks
        : applyStatusFilter(projectScopedTasks, statusFilter),
    [projectScopedTasks, projectScopedClosedTasks, statusFilter],
  );

  return { lastCheckedAt, statusCounts, filteredTasks };
}
