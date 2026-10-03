import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Plug } from "lucide-react";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { PanelPresence } from "../components/ui/PanelPresence.tsx";
import { Pagination } from "../components/ui/Pagination.tsx";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs.tsx";
import { DataIngestionHeader } from "../features/data-ingestion/components/DataIngestionHeader.tsx";
import { DataIngestionLoadingState } from "../features/data-ingestion/components/DataIngestionLoadingState.tsx";
import { WarningBanner } from "../features/data-ingestion/components/WarningBanner.tsx";
import { DataIngestionSectionFilter } from "../features/data-ingestion/components/DataIngestionSectionFilter.tsx";
import { OverviewSection } from "../features/data-ingestion/components/OverviewSection.tsx";
import { RunDetailsPanel } from "../features/data-ingestion/components/RunDetailsPanel.tsx";
import { RunHistory } from "../features/data-ingestion/components/RunHistory.tsx";
import {
  RunHistoryFilters,
  type RunStatusFilter,
} from "../features/data-ingestion/components/RunHistoryFilters.tsx";
import { SyncScheduleSettings } from "../features/data-ingestion/components/SyncScheduleSettings.tsx";
import { AddSourceModal } from "../features/data-ingestion/components/AddSourceModal.tsx";
import { SourceDetailsPanel } from "../features/data-ingestion/components/SourceDetailsPanel.tsx";
import { SourceList } from "../features/data-ingestion/components/SourceList.tsx";
import { ConnectorList } from "../features/connectors/components/ConnectorList.tsx";
import { ConnectorsLoadingState } from "../features/connectors/components/ConnectorsLoadingState.tsx";
import { toConnectorListItems } from "../features/connectors/data.ts";
import type { ConnectorListItem } from "../features/connectors/types.ts";
import { connectorService } from "../services/connectorService.ts";
import { buildDataSources } from "../features/data-ingestion/buildSources.ts";
import { useIngestionData } from "../features/data-ingestion/hooks/useIngestionData.ts";
import {
  CONNECTORS,
  SCHEDULED_SOURCE_SYSTEMS,
  getConnector,
} from "../features/data-ingestion/connectors/registry.ts";
import type { SourceSystem } from "../features/data-ingestion/connectors/sourceSystems.ts";
import { buildRunSourceLabels, getRunSourceLabel } from "../features/data-ingestion/data.ts";
import { githubRepositoryOf } from "../features/data-ingestion/sourceDetails.ts";
import type {
  DataSource,
  IngestionRun,
  IngestionRunFilter,
  SectionKey,
  SourceChange,
} from "../features/data-ingestion/types.ts";
import { SECTION_ORDER } from "../features/data-ingestion/types.ts";
import {
  loadProjectSyncSchedule,
  saveProjectSyncSchedule,
} from "../features/data-ingestion/projectSyncSchedule.ts";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel.tsx";
import { queryKeys } from "../services/queryKeys.ts";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import { getGithubPatNames } from "../services/sources/githubService.ts";
import type { SyncScheduleConfig, SyncScheduleRequest } from "../services/sources/syncSchedule.ts";

/**
 * Wording for the project-wide sync-settings modal, per connector. `one` and
 * `many` name the connector's sources so the copy reads naturally in both the
 * "overwrites every … in this project" and the "updates all … in this project"
 * sentences.
 */
function getSyncSettingsCopy(system: SourceSystem) {
  const { label, noun } = CONNECTORS[system].meta;

  return { label, one: `${label} ${noun.singular}`, many: `${label} ${noun.plural}` };
}

// How long a connect or an update keeps the page reloading, so the run it just
// started shows up even though none was running yet when it was triggered.
const POLLING_WINDOW_MS = 60_000;

// Small enough that the run table stays scannable and pagination is actually
// reachable rather than a single page of rows.
const RUN_PAGE_SIZE = 10;

type RunFilterState = {
  status: RunStatusFilter;
  /** The selected source's `value` (GitHub repo id, Jira instance URL, or Confluence connection id), or `"ALL"`. */
  sourceValue: string;
  /**
   * How to translate `sourceValue` into a query param: GitHub and Confluence filter by
   * `repositoryId`, Jira by `sourceRef`. Null while no specific source is selected.
   */
  sourceSystem: SourceSystem | null;
};

const DEFAULT_RUN_FILTER: RunFilterState = {
  status: "ALL",
  sourceValue: "ALL",
  sourceSystem: null,
};

/**
 * A source offered in the run-history filter. `value` is the GitHub repository
 * id, Jira instance URL, or Confluence connection id; `sourceSystem` decides
 * which query param it maps to (repositoryId vs. sourceRef).
 */
type RunSourceFilterOption = {
  value: string;
  label: string;
  sourceSystem: SourceSystem;
};

function hasSourceId(sources: DataSource[], sourceId: string) {
  return sources.some((source) => source.sourceId === sourceId);
}

/**
 * Turns a `?sourceId=` value into the id this page actually selects by.
 *
 * A card's id is its project-source id, but callers do not always have one. The knowledge-gap
 * detail page links here from a gap, and a gap identifies itself by component — `owner/repo`,
 * which is the GitHub repository's full name. Accepting that spelling too is what lets its
 * "Update data source" button open the repository rather than dropping the reader on the page
 * and leaving them to find it.
 *
 * Case-insensitive on the component: GitHub treats owner
 * and repository names that way, and the component string reaches us from the AI service.
 */
function resolveRequestedSourceId(sources: DataSource[], requested: string): string | null {
  if (requested.length === 0) return null;
  if (hasSourceId(sources, requested)) return requested;

  const byComponent = sources.find(
    (source) => githubRepositoryOf(source)?.fullName.toLowerCase() === requested.toLowerCase(),
  );

  return byComponent?.sourceId ?? null;
}

const STATUS_BADGE_TONE = {
  success: "border-app-success-border bg-app-success-bg text-app-success-text",
  brand: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
  warning: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  neutral: "border-app-border bg-app-neutral-bg text-app-neutral-text",
} as const;

/** Small count badge summarising how many sources are in a given status. */
function StatusBadge({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_BADGE_TONE;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${STATUS_BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function DataIngestionPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  // The selected run is captured as an object, not just an id: paging the
  // history replaces the loaded rows, and looking it up only in the current page
  // would snap an open run drawer shut as soon as the user moved to another page.
  const [selectedRunSnapshot, setSelectedRunSnapshot] = useState<IngestionRun | null>(null);

  const [runPageNumber, setRunPageNumber] = useState(1);
  const [runFilter, setRunFilter] = useState<RunFilterState>(DEFAULT_RUN_FILTER);
  // Set while a manual refresh is in flight, so the header can show it.
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState(false);
  const [isSyncSettingsModalOpen, setIsSyncSettingsModalOpen] = useState(false);
  const [syncSettingsSystem, setSyncSettingsSystem] = useState<SourceSystem>("GITHUB");
  // Whether the sources of the open sync-settings tab currently have different schedules.
  const [isSyncScheduleMixed, setIsSyncScheduleMixed] = useState(false);
  // When the window after a connect or an update opened; null while it is closed.
  const [pollingWindowStartedAt, setPollingWindowStartedAt] = useState<number | null>(null);
  const [togglingConnectorId, setTogglingConnectorId] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  // The project is chosen globally in the sidebar switcher. The `?projectId=`
  // search param is still honoured so deep links from the admin view land on
  // the right project — it writes into the global selection below, which holds
  // the value unpublished until the loaded project list confirms it (or drops
  // it when that list says the project is not reachable).
  const { selectedProject, selectedProjectId, setSelectedProjectId, reloadProjects } =
    useProjectContext();

  const requestedProjectId = searchParams.get("projectId") ?? "";
  const requestedSourceId = searchParams.get("sourceId") ?? "";

  // Applies a `?projectId=` deep link (e.g. opening a source from the admin
  // project view) and then drops the parameter again.
  //
  // Consuming it is what makes the project switcher usable afterwards: while the
  // parameter stayed in the URL, every switch was immediately overwritten,
  // because this effect re-ran on the resulting mismatch and forced the
  // deep-linked project back.
  useEffect(() => {
    if (!requestedProjectId) return;

    void Promise.resolve().then(() => {
      if (requestedProjectId !== selectedProjectId) {
        setSelectedProjectId(requestedProjectId);
      }

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("projectId");
      setSearchParams(nextSearchParams, { replace: true });
    });
  }, [requestedProjectId, searchParams, selectedProjectId, setSearchParams, setSelectedProjectId]);

  // Server-side query for the run history. Scoping by project is what keeps runs
  // from other projects' repositories out of the list; the backend resolves the
  // project to its connected repositories.
  const runQuery = useMemo<IngestionRunFilter>(() => {
    // The connector says which query parameter scopes its runs (repositoryId is
    // the backend source-instance UUID, sourceRef the run's source reference).
    const scope =
      runFilter.sourceValue !== "ALL" && runFilter.sourceSystem
        ? getConnector(runFilter.sourceSystem).runFilter?.param
        : undefined;

    return {
      page: runPageNumber,
      size: RUN_PAGE_SIZE,
      projectId: selectedProjectId || undefined,
      repositoryId: scope === "repositoryId" ? runFilter.sourceValue : undefined,
      sourceRef: scope === "sourceRef" ? runFilter.sourceValue : undefined,
      status: runFilter.status !== "ALL" ? runFilter.status : undefined,
    };
  }, [
    runFilter.sourceValue,
    runFilter.sourceSystem,
    runFilter.status,
    runPageNumber,
    selectedProjectId,
  ]);

  // Everything the page is built from. While any run is in flight, or the window
  // after a connect or an update is open, it is all reloaded every few seconds.
  const {
    statuses: sourceInstances,
    latestRuns,
    projectSources,
    jiraInstances,
    confluenceConnections,
    runs,
    runPageMeta,
    isRunsPlaceholder,
    isRunsLoading,
    runsErrorMessage,
    isProjectDataLoading,
    statusErrorMessage: sourceStatusErrorMessage,
    projectSourcesErrorMessage,
  } = useIngestionData({
    projectId: selectedProjectId || null,
    runQuery,
    isPollingWindowOpen: pollingWindowStartedAt !== null,
  });

  // Closes the window once it has run its course.
  useEffect(() => {
    if (pollingWindowStartedAt === null) return undefined;

    const timeoutId = window.setTimeout(() => setPollingWindowStartedAt(null), POLLING_WINDOW_MS);

    return () => window.clearTimeout(timeoutId);
  }, [pollingWindowStartedAt]);

  const openPollingWindow = () => setPollingWindowStartedAt(Date.now());

  // The viewed page can fall out of range while the view is open (a filter
  // narrowing the result set, runs being removed). Step back to the last page
  // instead of showing an empty table; this re-runs the query.
  useEffect(() => {
    if (!runPageMeta || isRunsPlaceholder) return;

    if (runPageMeta.totalPages >= 1 && runPageNumber > runPageMeta.totalPages) {
      void Promise.resolve().then(() => setRunPageNumber(runPageMeta.totalPages));
    }
  }, [isRunsPlaceholder, runPageMeta, runPageNumber]);

  // Reloads everything the page holds: the status rows, the connections, the runs
  // and the connector list. A mutation calls this instead of reloading by hand, and
  // the returned promise settles once the visible data is back.
  const refreshIngestionData = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.ingestion.all() }),
    [queryClient],
  );

  // The connector state decides whether a source reaches chat at all, so it is
  // loaded with the page rather than only when the connectors modal opens --
  // otherwise a globally disabled connector stays invisible while every card
  // still claims "Connected".
  //
  // A failure is not retried and not reported on the page: the endpoint is
  // PM/ADMIN-only, but HR may open this page, and an unknown connector state must
  // not fake a disabled source. The connectors modal shows the failure.
  const connectorsQuery = useQuery({
    queryKey: queryKeys.ingestion.connectors(),
    queryFn: async () => toConnectorListItems(await connectorService.listConnectors()),
    retry: false,
  });
  const connectors = useMemo(() => connectorsQuery.data ?? [], [connectorsQuery.data]);

  const connectorEnabledById = useMemo(
    () => new Map(connectors.map((connector) => [connector.id.toLowerCase(), connector.enabled])),
    [connectors],
  );

  const sources = useMemo<DataSource[]>(
    () =>
      buildDataSources({
        projectSources,
        statuses: sourceInstances,
        jiraInstances,
        confluenceConnections,
        latestRuns,
        connectorEnabledById,
      }),
    [
      confluenceConnections,
      connectorEnabledById,
      jiraInstances,
      latestRuns,
      projectSources,
      sourceInstances,
    ],
  );

  const totalArtifactCount = useMemo(
    () => sourceInstances.reduce((sum, s) => sum + s.artifactCount, 0),
    [sourceInstances],
  );

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (!isMounted) return;

      const resolvedSourceId = resolveRequestedSourceId(sources, requestedSourceId);

      if (resolvedSourceId) {
        setActiveSection("sources");
      }

      setSelectedSourceId((currentSourceId) => {
        if (resolvedSourceId) {
          return resolvedSourceId;
        }

        // Keep the current selection while the list is transiently empty (an
        // in-flight refresh), so an open details drawer isn't dropped. Only
        // clear when the list is populated and the source is genuinely gone.
        if (!currentSourceId || sources.length === 0) {
          return currentSourceId;
        }

        return hasSourceId(sources, currentSourceId) ? currentSourceId : null;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [requestedSourceId, sources]);

  const visibleSourceSystems = useMemo(
    () => new Set(sources.map((source) => source.sourceSystem)),
    [sources],
  );
  // The connectors whose sync policy can be edited project-wide right now: one tab
  // per schedulable connector that actually has sources on this project.
  const syncSettingsSystems = useMemo<SegmentedTabOption<SourceSystem>[]>(
    () =>
      SCHEDULED_SOURCE_SYSTEMS.filter((system) => visibleSourceSystems.has(system)).map(
        (system) => ({ value: system, label: getSyncSettingsCopy(system).label }),
      ),
    [visibleSourceSystems],
  );
  const syncSettingsCopy = useMemo(
    () => getSyncSettingsCopy(syncSettingsSystem),
    [syncSettingsSystem],
  );

  const sourceHealth = useMemo(() => {
    const count = (state: DataSource["statusView"]["state"]) =>
      sources.filter((source) => source.statusView.state === state).length;

    return {
      total: sources.length,
      connected: count("connected"),
      syncing: count("syncing"),
      attention: count("attention"),
      disabled: count("disabled"),
    };
  }, [sources]);
  const canManageSyncSettings =
    profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  // Naming the documentation owner of a repository writes component ownership, and that
  // endpoint is PM/Admin only. Same two roles as the sync settings above, but for its own
  // reason -- kept apart so changing one does not quietly change the other.
  const canAssignComponentOwners =
    profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  // The `/github/connect` endpoint only checks the global PM/ADMIN role, so the
  // backend accepts an ingest into a project the PM is merely a member of and
  // then fails deep in the pipeline with a 500. Mirror the product rule up front
  // instead: only the assigned project manager (or an admin) may connect a
  // source to a project.
  const canIngestIntoSelectedProject =
    profile?.permissionGroup === "ADMIN" || (selectedProject?.isManaged ?? false);

  const runSourceLabels = useMemo(() => buildRunSourceLabels(sources), [sources]);

  // Sources offered in the run filter, from the project's connected sources. Each
  // connector says which query parameter scopes its runs and by which value; a
  // source whose connector cannot tell its runs apart is not offered.
  const runSourceOptions = useMemo<RunSourceFilterOption[]>(
    () =>
      sources.flatMap((source): RunSourceFilterOption[] => {
        const value = getConnector(source.sourceSystem).runFilter?.valueOf(source);

        return value ? [{ value, label: source.name, sourceSystem: source.sourceSystem }] : [];
      }),
    [sources],
  );

  const isRunFilterActive = runFilter.status !== "ALL" || runFilter.sourceValue !== "ALL";

  const handleResetRunFilter = useCallback(() => {
    setRunFilter(DEFAULT_RUN_FILTER);
    setRunPageNumber(1);
  }, []);

  const handleSectionChange = useCallback((section: SectionKey) => {
    setActiveSection(section);
  }, []);

  const handleOpenConnectorsModal = () => {
    setIsConnectorsModalOpen(true);

    // A load that failed earlier (the list is not retried in the background) is tried
    // again when the user asks for the modal.
    if (connectorsQuery.isError) void connectorsQuery.refetch();
  };

  const handleToggleConnectorEnabled = async (connector: ConnectorListItem) => {
    setTogglingConnectorId(connector.id);

    try {
      const response = await connectorService.setConnectorEnabled(connector.id, !connector.enabled);

      queryClient.setQueryData<ConnectorListItem[]>(queryKeys.ingestion.connectors(), (current) =>
        current?.map((item) => (item.id === connector.id ? { ...item, ...response } : item)),
      );
      toast.success(connector.enabled ? "Connector disabled" : "Connector enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the connector.");
    } finally {
      setTogglingConnectorId(null);
    }
  };

  const selectedSource = useMemo(() => {
    if (!selectedSourceId) return null;

    return sources.find((source) => source.sourceId === selectedSourceId) ?? null;
  }, [selectedSourceId, sources]);

  // The tokens the add-source form discovers repositories with. Only asked for once
  // the modal is open; a failure just leaves the list empty (the form loads its own).
  const { data: githubTokenNames = [] } = useQuery({
    queryKey: queryKeys.admin.githubTokenNames(),
    queryFn: ({ signal }) => getGithubPatNames(signal),
    enabled: isAddSourceModalOpen,
    retry: false,
  });

  // The wizard covers both connect paths (org discovery and a single repository),
  // so this is the only entry point.
  const handleOpenAddSourceModal = () => setIsAddSourceModalOpen(true);

  // Runs after the wizard connects a source: opens the polling window, jumps to the
  // sources list and reloads the page's data and the project switcher's (the modal
  // owns the confirming toast).
  const handleDiscoveryConnected = () => {
    openPollingWindow();
    setActiveSection("sources");

    void Promise.all([refreshIngestionData(), reloadProjects()]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([refreshIngestionData(), reloadProjects()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // The sync-settings modal works on the selected project's sources only: it
  // reads the schedule of each of them, shows it when they all agree, and writes
  // the chosen schedule to each of them.
  const loadProjectSyncConfig = useCallback(async (): Promise<SyncScheduleConfig> => {
    const { config, isMixed } = await loadProjectSyncSchedule(
      syncSettingsSystem,
      sources,
      selectedProjectId || null,
    );
    setIsSyncScheduleMixed(isMixed);

    return { autoUpdate: config.autoUpdate, spec: config.schedule, nextSyncAt: null };
  }, [selectedProjectId, sources, syncSettingsSystem]);

  const handleSaveProjectSyncConfig = useCallback(
    async (request: SyncScheduleRequest) => {
      await saveProjectSyncSchedule(
        syncSettingsSystem,
        sources,
        selectedProjectId || null,
        request,
        syncSettingsCopy.many,
      );
      // Deliberately does NOT reloadProjects(): changing sync schedules does not
      // affect the project switcher's data, and a project reload can transiently
      // reset the selected project (e.g. a slow managed-projects fetch), which
      // blanks the page.
      await refreshIngestionData();
    },
    [refreshIngestionData, selectedProjectId, sources, syncSettingsCopy.many, syncSettingsSystem],
  );

  // The details panel runs its actions itself (through the source's connector
  // definition) and reports what it changed; this reloads what the cards are
  // built from. An update also opens the polling window, so the run it started
  // shows up and the card moves from "Syncing" to "Synced"; an unlink drops the
  // selection, so the card disappears and the drawer closes.
  //
  // Deliberately does NOT reloadProjects(): the switcher's project list is
  // unaffected by these actions, and reloading it can transiently drop the
  // selected project (a slow or failed managed-projects fetch resets the
  // selection), which reads as a project switch and closes the open drawer.
  const handleSourceChanged = async (change: SourceChange) => {
    if (change === "updated") {
      openPollingWindow();
    }

    if (change === "unlinked") {
      setSelectedSourceId(null);
    }

    await refreshIngestionData();
  };

  const isLoading = isRunsLoading || isRefreshing;

  // Two-finger swipe between the sections, for people who would rather not aim
  // at the bar.
  const swipeRef = useSwipeableTabs<SectionKey, HTMLElement>({
    order: SECTION_ORDER,
    value: activeSection,
    onChange: handleSectionChange,
  });

  const showOverview = activeSection === "overview";
  const showSources = activeSection === "overview" || activeSection === "sources";
  const showRuns = activeSection === "overview" || activeSection === "runs";

  const shouldShowInitialLoading =
    (isLoading || (isProjectDataLoading && showSources)) && sources.length === 0;

  // Prefers the row from the currently loaded page, so an open drawer keeps
  // updating while polling refreshes the list, and falls back to the captured
  // run once the user pages away from it.
  const selectedRun = useMemo(() => {
    if (!selectedRunSnapshot) return null;

    return runs.find((run) => run.runId === selectedRunSnapshot.runId) ?? selectedRunSnapshot;
  }, [runs, selectedRunSnapshot]);

  const selectedRunId = selectedRun?.runId ?? null;

  const closeSourceDetails = () => {
    setSelectedSourceId(null);

    if (!searchParams.has("sourceId")) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("sourceId");
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    // No own height or scroll container here: the app shell in App.tsx already
    // provides `min-h-screen` and the document scroll. Nesting a `h-screen`
    // scroller inside it produced a second scrollbar and dead space below the
    // content once the viewport lost height to a horizontal scrollbar.
    <div>
      <div>
        <DataIngestionHeader
          isLoading={isLoading}
          onAddSource={handleOpenAddSourceModal}
          onRefresh={() => void handleRefresh()}
        />

        <main ref={swipeRef} className="app-page-shell">
          <div className="space-y-8">
            {runsErrorMessage && <WarningBanner>{runsErrorMessage}</WarningBanner>}
            {sourceStatusErrorMessage && <WarningBanner>{sourceStatusErrorMessage}</WarningBanner>}
            {projectSourcesErrorMessage && (
              <WarningBanner>{projectSourcesErrorMessage}</WarningBanner>
            )}

            <DataIngestionSectionFilter
              active={activeSection}
              onChange={handleSectionChange}
              sourceCount={sourceHealth.total}
              runCount={runPageMeta?.totalElements ?? runs.length}
            />

            {shouldShowInitialLoading ? (
              <DataIngestionLoadingState />
            ) : (
              // Only the section content slides; the loading state above is not
              // a section and would otherwise animate on its way in too.
              <SlidingTabPanel
                activeKey={activeSection}
                index={SECTION_ORDER.indexOf(activeSection)}
                className="space-y-8"
              >
                {showOverview ? (
                  <OverviewSection
                    sources={sources}
                    totalArtifactCount={totalArtifactCount}
                    runs={latestRuns}
                    onNavigate={handleSectionChange}
                  />
                ) : null}

                {showSources ? (
                  <section aria-label="Sources">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="mr-1 text-lg font-semibold tracking-tight text-app-text">
                          Sources
                        </h2>
                        {sourceHealth.connected > 0 && (
                          <StatusBadge tone="success">
                            {sourceHealth.connected} connected
                          </StatusBadge>
                        )}
                        {sourceHealth.syncing > 0 && (
                          <StatusBadge tone="brand">{sourceHealth.syncing} syncing</StatusBadge>
                        )}
                        {sourceHealth.attention > 0 && (
                          <StatusBadge tone="warning">
                            {sourceHealth.attention} need
                            {sourceHealth.attention === 1 ? "s" : ""} attention
                          </StatusBadge>
                        )}
                        {sourceHealth.disabled > 0 && (
                          <StatusBadge tone="neutral">{sourceHealth.disabled} disabled</StatusBadge>
                        )}
                      </div>

                      {canManageSyncSettings ? (
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleOpenConnectorsModal}
                            icon={<Plug className="h-4 w-4" />}
                            className="w-full sm:w-auto"
                          >
                            <span className="min-w-0 truncate">Manage connectors</span>
                          </Button>

                          {syncSettingsSystems.length > 0 ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSyncSettingsSystem(syncSettingsSystems[0].value);
                                setIsSyncSettingsModalOpen(true);
                              }}
                              icon={<CalendarClock className="h-4 w-4" />}
                              className="w-full sm:w-auto"
                            >
                              <span className="min-w-0 truncate">Manage sync settings</span>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {!isProjectDataLoading ? (
                      <SourceList
                        sources={sources}
                        selectedSourceId={selectedSourceId}
                        onSelectSource={setSelectedSourceId}
                        onAddSource={handleOpenAddSourceModal}
                      />
                    ) : null}
                  </section>
                ) : null}

                {showRuns ? (
                  <section aria-label="Runs">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold tracking-tight text-app-text">Runs</h2>
                        {runPageMeta ? (
                          <Badge variant="neutral" size="sm" className="tabular-nums">
                            {runPageMeta.totalElements} total
                          </Badge>
                        ) : null}
                      </div>

                      <RunHistoryFilters
                        status={runFilter.status}
                        sourceValue={runFilter.sourceValue}
                        sources={runSourceOptions}
                        disabled={isLoading}
                        onStatusChange={(status) => {
                          setRunFilter((current) => ({ ...current, status }));
                          setRunPageNumber(1);
                        }}
                        onSourceChange={(sourceValue) => {
                          const option = runSourceOptions.find(
                            (candidate) => candidate.value === sourceValue,
                          );
                          setRunFilter((current) => ({
                            ...current,
                            sourceValue,
                            sourceSystem: option?.sourceSystem ?? null,
                          }));
                          setRunPageNumber(1);
                        }}
                        onReset={handleResetRunFilter}
                      />
                    </div>
                    <RunHistory
                      runs={runs}
                      selectedRunId={selectedRunId}
                      onSelectRun={setSelectedRunSnapshot}
                      sourceLabelBySourceRef={runSourceLabels}
                      isFiltered={isRunFilterActive}
                    />

                    {runPageMeta && runPageMeta.totalPages > 1 ? (
                      <Pagination
                        currentPage={runPageNumber}
                        totalPages={runPageMeta.totalPages}
                        onPageChange={setRunPageNumber}
                      />
                    ) : null}
                  </section>
                ) : null}
              </SlidingTabPanel>
            )}
          </div>
        </main>
      </div>

      <PanelPresence value={selectedSource}>
        {(source) => (
          <SourceDetailsPanel
            source={source}
            projectId={selectedProjectId || null}
            canManage={canManageSyncSettings}
            canUnlink={canIngestIntoSelectedProject}
            onChanged={handleSourceChanged}
            onClose={closeSourceDetails}
          />
        )}
      </PanelPresence>

      <PanelPresence value={selectedRun}>
        {(run) => (
          <RunDetailsPanel
            run={run}
            sourceLabel={getRunSourceLabel(run, runSourceLabels)}
            onClose={() => setSelectedRunSnapshot(null)}
          />
        )}
      </PanelPresence>

      <Modal
        isOpen={isConnectorsModalOpen}
        title="Connectors"
        description="Enable or disable a connector, and choose which sources are in scope for this project."
        size="xl"
        bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
        onClose={() => setIsConnectorsModalOpen(false)}
      >
        {connectorsQuery.isError && (
          <div className="mb-4">
            <WarningBanner compact>
              {connectorsQuery.error instanceof Error
                ? connectorsQuery.error.message
                : "Failed to load connectors"}
            </WarningBanner>
          </div>
        )}

        {connectorsQuery.isLoading ? (
          <ConnectorsLoadingState />
        ) : (
          <ConnectorList
            connectors={connectors}
            togglingConnectorId={togglingConnectorId}
            projectId={selectedProjectId}
            onToggleEnabled={(connector) => {
              void handleToggleConnectorEnabled(connector);
            }}
            onSourcesSaved={() => void refreshIngestionData()}
          />
        )}
      </Modal>

      <Modal
        isOpen={isSyncSettingsModalOpen}
        title={`${syncSettingsCopy.label} Sync Settings`}
        description={`Apply one sync policy to all ${syncSettingsCopy.many} in this project.`}
        size="lg"
        bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
        onClose={() => setIsSyncSettingsModalOpen(false)}
      >
        {syncSettingsSystems.length > 1 ? (
          <div className="mb-5">
            <SegmentedTabs
              value={syncSettingsSystem}
              options={syncSettingsSystems}
              onChange={setSyncSettingsSystem}
              layoutId="sync-settings-provider-pill"
              ariaLabel="Sync settings connector"
            />
          </div>
        ) : null}

        <SyncScheduleSettings
          key={syncSettingsSystem}
          loadKey={syncSettingsSystem}
          loadConfig={loadProjectSyncConfig}
          onSave={handleSaveProjectSyncConfig}
          showNextSync={false}
          disclaimer={`Applying these settings overwrites the sync settings of every ${syncSettingsCopy.one} in this project.${
            isSyncScheduleMixed ? " These sources currently have different schedules." : ""
          }`}
          autoUpdateOnText={`Due checks update all ${syncSettingsCopy.many} in this project.`}
          autoUpdateOffText={`Due checks only mark ${syncSettingsCopy.many} in this project out of date.`}
          toggleAriaLabel={`Toggle ${syncSettingsCopy.label} auto update for this project`}
          saveLabel="Apply to project"
        />
      </Modal>

      {isAddSourceModalOpen && (
        <AddSourceModal
          projectId={selectedProjectId}
          projectName={selectedProject?.name}
          tokenNames={githubTokenNames}
          canIngest={Boolean(selectedProjectId) && canIngestIntoSelectedProject}
          canAssignOwners={canAssignComponentOwners}
          ingestBlockedReason={
            !selectedProjectId
              ? "Select a project before connecting sources."
              : !canIngestIntoSelectedProject
                ? `You can only connect sources to projects you manage. You are a member of "${selectedProject?.name ?? "this project"}" but not its project manager.`
                : undefined
          }
          onClose={() => setIsAddSourceModalOpen(false)}
          onConnected={handleDiscoveryConnected}
        />
      )}
    </div>
  );
}
