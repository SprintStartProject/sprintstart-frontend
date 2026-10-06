import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ConfluenceConnectionDto } from "../../../services/sources/confluenceService.ts";
import type { JiraInstanceDto } from "../../../services/sources/jiraService.ts";
import type { NotionWorkspaceConnectionDto } from "../../../services/sources/notionService.ts";
import type { ProjectSource } from "../../../services/projectService.ts";
import {
  getIngestionRunsPage,
  getIngestionSourceStatuses,
} from "../../../services/ingestionService.ts";
import { queryKeys } from "../../../services/queryKeys.ts";
import { CONNECTORS } from "../connectors/registry.ts";
import { isRunInProgress } from "../data.ts";
import type {
  IngestionRun,
  IngestionRunFilter,
  IngestionRunPage,
  SourceInstanceIngestionStatus,
} from "../types.ts";

/** How many of the project's newest runs feed the source cards and the overview. */
export const LATEST_RUNS_SIZE = 50;

/** How often the page's data is reloaded while a run is in flight. */
const POLL_INTERVAL_MS = 3000;

const NO_RUNS: IngestionRun[] = [];
const NO_STATUSES: SourceInstanceIngestionStatus[] = [];
const NO_PROJECT_SOURCES: ProjectSource[] = [];
const NO_JIRA_INSTANCES: JiraInstanceDto[] = [];
const NO_CONFLUENCE_CONNECTIONS: ConfluenceConnectionDto[] = [];
const NO_NOTION_CONNECTIONS: NotionWorkspaceConnectionDto[] = [];

function hasRunningRun(runs: readonly IngestionRun[] | undefined): boolean {
  return runs?.some((run) => isRunInProgress(run.status)) ?? false;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type UseIngestionDataOptions = {
  /** The selected project; null until one is confirmed, which holds the project-scoped loads back. */
  projectId: string | null;
  /** The query of the run table: project, filters and the viewed page. */
  runQuery: IngestionRunFilter;
  /**
   * Whether the window after a connect or an update is open. A just-started run may
   * not be listed yet, so the data is reloaded for a while even though none is running.
   */
  isPollingWindowOpen: boolean;
};

/**
 * Everything the Data Ingestion page is built from, each part its own cached query:
 * the status rows and the connectors' connection records the source cards are
 * merged from, the project's newest runs, and the run table's current page.
 *
 * All of it is reloaded together every few seconds while any run is in flight (in
 * the table or among the latest runs) or the post-update window is open, so the
 * cards move from "Syncing" to "Synced" without a manual reload. Switching the
 * project starts every project-scoped part from nothing, so no card shows the
 * previous project's numbers; an in-place reload keeps what is on screen, so an
 * open details drawer survives it.
 *
 * Which parts fail loudly is the connector's call: a project's own sources and the
 * status rows report an error, while Jira, Confluence and Notion degrade quietly (their
 * lists may be off limits to the viewer) and leave their cards out.
 */
export function useIngestionData({
  projectId,
  runQuery,
  isPollingWindowOpen,
}: UseIngestionDataOptions) {
  const queryClient = useQueryClient();
  const enabled = Boolean(projectId);
  const scopeId = projectId ?? "";
  const latestRunsKey = queryKeys.ingestion.latestRuns(scopeId);

  // The run table is requested first: it is what the page shows first, and the
  // newest runs behind the cards follow it.
  //
  // Keeps the rows of the previous query on screen while a new filter or page loads,
  // so paging and filtering refresh quietly instead of blanking the table.
  const runsPageQuery = useQuery<IngestionRunPage>({
    queryKey: queryKeys.ingestion.runsPage(runQuery),
    queryFn: () => getIngestionRunsPage(runQuery),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: (query) =>
      isPollingWindowOpen ||
      hasRunningRun(query.state.data?.items) ||
      hasRunningRun(queryClient.getQueryData<IngestionRun[]>(latestRunsKey))
        ? POLL_INTERVAL_MS
        : false,
  });

  const latestRunsQuery = useQuery({
    queryKey: latestRunsKey,
    queryFn: async () =>
      (await getIngestionRunsPage({ projectId: scopeId, size: LATEST_RUNS_SIZE })).items,
    enabled,
    refetchInterval: (query) =>
      isPollingWindowOpen || hasRunningRun(query.state.data) ? POLL_INTERVAL_MS : false,
  });

  const isPolling =
    isPollingWindowOpen ||
    hasRunningRun(latestRunsQuery.data) ||
    hasRunningRun(runsPageQuery.data?.items);
  const refetchInterval = isPolling ? POLL_INTERVAL_MS : false;

  // The run queries decide when polling is over, and they settle a moment before the
  // status rows and connections do, so the last poll can stop those first: the cards
  // would keep the status of the run that has just finished. One more load as polling
  // ends brings them level.
  const wasPollingRef = useRef(false);
  useEffect(() => {
    const justStopped = wasPollingRef.current && !isPolling;
    wasPollingRef.current = isPolling;

    if (!justStopped || !enabled) return;

    void queryClient.invalidateQueries({ queryKey: queryKeys.ingestion.statuses(scopeId) });

    for (const { connections } of [CONNECTORS.JIRA, CONNECTORS.CONFLUENCE, CONNECTORS.NOTION]) {
      if (connections.live) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.ingestion.connections(connections.scope, scopeId),
        });
      }
    }
  }, [enabled, isPolling, queryClient, scopeId]);

  const statusesQuery = useQuery({
    queryKey: queryKeys.ingestion.statuses(scopeId),
    queryFn: () => getIngestionSourceStatuses(scopeId),
    enabled,
    refetchInterval,
  });

  // GitHub repositories and uploads are project sources and share one load.
  const { connections: projectSourceConnections } = CONNECTORS.GITHUB;
  const projectSourcesQuery = useQuery({
    queryKey: queryKeys.ingestion.connections(projectSourceConnections.scope, scopeId),
    queryFn: () => projectSourceConnections.load(scopeId),
    enabled,
  });

  const { connections: jiraConnections } = CONNECTORS.JIRA;
  const jiraQuery = useQuery({
    queryKey: queryKeys.ingestion.connections(jiraConnections.scope, scopeId),
    queryFn: () => jiraConnections.load(scopeId),
    enabled,
    retry: false,
    refetchInterval: jiraConnections.live ? refetchInterval : false,
  });

  const { connections: confluenceConnections } = CONNECTORS.CONFLUENCE;
  const confluenceQuery = useQuery({
    queryKey: queryKeys.ingestion.connections(confluenceConnections.scope, scopeId),
    queryFn: () => confluenceConnections.load(scopeId),
    enabled,
    retry: false,
    refetchInterval: confluenceConnections.live ? refetchInterval : false,
  });

  const { connections: notionConnections } = CONNECTORS.NOTION;
  const notionQuery = useQuery({
    queryKey: queryKeys.ingestion.connections(notionConnections.scope, scopeId),
    queryFn: () => notionConnections.load(scopeId),
    enabled,
    retry: false,
    refetchInterval: notionConnections.live ? refetchInterval : false,
  });

  return {
    statuses: statusesQuery.data ?? NO_STATUSES,
    latestRuns: latestRunsQuery.data ?? NO_RUNS,
    projectSources: projectSourcesQuery.data ?? NO_PROJECT_SOURCES,
    jiraInstances: jiraQuery.data ?? NO_JIRA_INSTANCES,
    confluenceConnections: confluenceQuery.data ?? NO_CONFLUENCE_CONNECTIONS,
    notionConnections: notionQuery.data ?? NO_NOTION_CONNECTIONS,

    /** The run table's current page. */
    runs: runsPageQuery.data?.items ?? NO_RUNS,
    runPageMeta: runsPageQuery.data?.page ?? null,
    /** True while the rows on screen belong to the previous query. */
    isRunsPlaceholder: runsPageQuery.isPlaceholderData,
    /** True until the run table has anything to show. */
    isRunsLoading: runsPageQuery.isLoading,
    runsErrorMessage: runsPageQuery.isError
      ? messageOf(runsPageQuery.error, "Failed to load ingestion data")
      : null,

    /** True until the selected project's data has arrived, which a project switch starts over. */
    isProjectDataLoading: [
      statusesQuery,
      projectSourcesQuery,
      jiraQuery,
      confluenceQuery,
      notionQuery,
      latestRunsQuery,
    ].some((query) => query.isLoading),
    statusErrorMessage: statusesQuery.isError
      ? messageOf(statusesQuery.error, "Source status could not be loaded.")
      : null,
    projectSourcesErrorMessage: projectSourcesQuery.isError
      ? messageOf(
          projectSourcesQuery.error,
          projectSourceConnections.failureMessage ?? "Project sources could not be loaded.",
        )
      : null,
  };
}
