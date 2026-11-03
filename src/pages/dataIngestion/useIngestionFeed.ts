import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { buildDataSources } from "../../features/data-ingestion/buildSources.ts";
import { buildRunSourceLabels } from "../../features/data-ingestion/data.ts";
import { useIngestionData } from "../../features/data-ingestion/hooks/useIngestionData.ts";
import type { DataSource, IngestionRun } from "../../features/data-ingestion/types.ts";
import { queryKeys } from "../../services/queryKeys.ts";
import { runSourceOptionsOf, sourceHealthOf } from "./ingestionRules";
import { useConnectors } from "./useConnectors";
import { usePollingWindow } from "./usePollingWindow";
import { useClampedRunPage, useRunFilter } from "./useRunFilter";

/**
 * Everything the page is built from: the ingestion data, which is reloaded every few seconds
 * while any run is in flight or the window after a connect or an update is open, and the sources
 * and run labels made from it.
 */
export function useIngestionFeed(selectedProjectId: string) {
  const queryClient = useQueryClient();
  const runFilter = useRunFilter(selectedProjectId);
  const polling = usePollingWindow();
  const connectors = useConnectors();
  const data = useIngestionData({
    projectId: selectedProjectId || null,
    runQuery: runFilter.query,
    isPollingWindowOpen: polling.isOpen,
  });
  useClampedRunPage(
    data.runPageMeta?.totalPages,
    data.isRunsPlaceholder,
    runFilter.pageNumber,
    runFilter.setPageNumber,
  );

  // Reloads everything the page holds: the status rows, the connections, the runs and the
  // connector list. A mutation calls this instead of reloading by hand, and the returned promise
  // settles once the visible data is back.
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.ingestion.all() }),
    [queryClient],
  );

  const sources = useMemo<DataSource[]>(
    () =>
      buildDataSources({
        projectSources: data.projectSources,
        statuses: data.statuses,
        jiraInstances: data.jiraInstances,
        confluenceConnections: data.confluenceConnections,
        notionConnections: data.notionConnections,
        latestRuns: data.latestRuns,
        connectorEnabledById: connectors.enabledById,
      }),
    [
      data.confluenceConnections,
      data.jiraInstances,
      data.latestRuns,
      data.notionConnections,
      data.projectSources,
      data.statuses,
      connectors.enabledById,
    ],
  );

  return {
    runFilter,
    polling,
    connectors,
    data,
    refresh,
    sources,
    health: useMemo(() => sourceHealthOf(sources), [sources]),
    runSourceOptions: useMemo(() => runSourceOptionsOf(sources), [sources]),
    runSourceLabels: useMemo(() => buildRunSourceLabels(sources), [sources]),
    totalArtifactCount: useMemo(
      () => data.statuses.reduce((sum, status) => sum + status.artifactCount, 0),
      [data.statuses],
    ),
  };
}

export type IngestionFeed = ReturnType<typeof useIngestionFeed>;

/**
 * The run whose details are open. It is captured as an object, not just an id: paging the history
 * replaces the loaded rows, and looking it up only in the current page would snap an open run
 * drawer shut as soon as the user moved to another page.
 */
export function useRunSelection(runs: IngestionRun[]) {
  const [snapshot, setSnapshot] = useState<IngestionRun | null>(null);

  // Prefers the row from the currently loaded page, so an open drawer keeps updating while
  // polling refreshes the list, and falls back to the captured run once the user pages away.
  const selectedRun = useMemo(() => {
    if (!snapshot) return null;

    return runs.find((run) => run.runId === snapshot.runId) ?? snapshot;
  }, [runs, snapshot]);

  return {
    selectedRun,
    selectedRunId: selectedRun?.runId ?? null,
    select: setSnapshot,
    close: () => setSnapshot(null),
  };
}
