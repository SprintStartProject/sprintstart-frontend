import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Plug } from "lucide-react";
import { Modal } from "../components/ui/Modal.tsx";
import { Pagination } from "../components/ui/Pagination.tsx";
import { DataIngestionHeader } from "../features/data-ingestion/components/DataIngestionHeader.tsx";
import { DataIngestionLoadingState } from "../features/data-ingestion/components/DataIngestionLoadingState.tsx";
import { DataIngestionSectionFilter } from "../features/data-ingestion/components/DataIngestionSectionFilter.tsx";
import { OverviewSection } from "../features/data-ingestion/components/OverviewSection.tsx";
import { RunDetailsPanel } from "../features/data-ingestion/components/RunDetailsPanel.tsx";
import { RunHistory } from "../features/data-ingestion/components/RunHistory.tsx";
import {
  RunHistoryFilters,
  type RunStatusFilter,
} from "../features/data-ingestion/components/RunHistoryFilters.tsx";
import { GithubRepositorySyncSettings } from "../features/data-ingestion/components/GithubRepositorySyncSettings.tsx";
import { AddSourceModal } from "../features/data-ingestion/components/AddSourceModal.tsx";
import { SourceDetailsPanel } from "../features/data-ingestion/components/SourceDetailsPanel.tsx";
import { SourceList } from "../features/data-ingestion/components/SourceList.tsx";
import { ConnectorList } from "../features/connectors/components/ConnectorList.tsx";
import { ConnectorsLoadingState } from "../features/connectors/components/ConnectorsLoadingState.tsx";
import { toConnectorListItems } from "../features/connectors/data.ts";
import type { ConnectorListItem } from "../features/connectors/types.ts";
import { connectorService } from "../services/connectorService.ts";
import {
  buildRunSourceLabels,
  createJiraSourceFromInstance,
  deriveSourceStatus,
  formatDateTime,
  getBackendSourceStatusLabel,
  getRunSourceLabel,
  getSourceStatus,
  getSourceStatusFromBackend,
  getSourceStatusLabel,
  isRunInProgress,
  SOURCE_META,
} from "../features/data-ingestion/data.ts";
import type {
  BackendProjectSourceStatus,
  DataSource,
  GithubRepositoryDetails,
  IngestionRun,
  IngestionRunFilter,
  LoadingState,
  PageMetadata,
  SectionKey,
  SourceInstanceIngestionStatus,
  SourceSystem,
} from "../features/data-ingestion/types.ts";
import {
  getIngestionRunsPage,
  getIngestionSourceStatuses,
} from "../services/ingestionService.ts";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import {
  configureAllGithubRepositories,
  configureGithubRepository,
  getGithubRepositoryConfig,
  getGithubPatNames,
  removeRepositoryFromProject,
  updateGithubRepository,
  type ConfigureGithubRepositoryRequest,
} from "../services/sources/githubService.ts";
import {
  configureJiraInstance,
  getJiraConfig,
  getJiraInstances,
  updateJiraInstance,
  type ConfigureJiraInstanceRequest,
  type JiraInstanceDto,
} from "../services/sources/jiraService.ts";
import {
  projectService,
  type ProjectSource,
} from "../services/projectService.ts";
import { parseGithubRepositoryReference } from "../services/sources/githubRepositoryInput.ts";

const DEFAULT_GLOBAL_GITHUB_SYNC_CONFIG: ConfigureGithubRepositoryRequest = {
  autoUpdate: true,
  schedule: { type: "INTERVAL", everyMinutes: 60 },
};

// Small enough that the run table stays scannable and pagination is actually
// reachable rather than a single page of rows.
const RUN_PAGE_SIZE = 10;

type RunFilterState = {
  status: RunStatusFilter;
  /** The selected source's `value` (GitHub repo id or Jira instance URL), or `"ALL"`. */
  sourceValue: string;
  /**
   * How to translate `sourceValue` into a query param: GitHub filters by
   * `repositoryId`, Jira by the connector-neutral `sourceRef`. Null while no
   * specific source is selected.
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
 * id or Jira instance URL; `sourceSystem` decides which query param it maps to
 * (repositoryId vs. sourceRef).
 */
type RunSourceFilterOption = {
  value: string;
  label: string;
  sourceSystem: SourceSystem;
};

function toSourceSystem(value: string): SourceSystem | null {
  const normalized = value.toUpperCase();

  if (
    normalized === "GITHUB" ||
    normalized === "JIRA" ||
    normalized === "UPLOAD"
  ) {
    return normalized;
  }

  return null;
}

function getIngestionStatusLabel(
  hasNeverSynced: boolean,
  hasErrors: boolean,
  runStatus: IngestionRun["status"] | null,
) {
  if (!hasNeverSynced && !hasErrors && runStatus === null) {
    return "Synced";
  }

  return getSourceStatusLabel(hasNeverSynced, hasErrors, runStatus);
}

/**
 * Finds the per-repo ingestion status (from `/api/v1/ingestion-sources/status`,
 * endpoint #5) that belongs to a connected project source. A project source only
 * carries an opaque id and a display name, so we match on the repository id
 * first, then on the `"owner/name"` recoverable from the source's name or id.
 */
function matchSourceInstance(
  projectSource: ProjectSource,
  instances: SourceInstanceIngestionStatus[],
): SourceInstanceIngestionStatus | null {
  const byRepositoryId = instances.find(
    (instance) => instance.repositoryId === projectSource.id,
  );
  if (byRepositoryId) return byRepositoryId;

  const reference =
    parseGithubRepositoryReference(projectSource.name) ??
    parseGithubRepositoryReference(projectSource.id);
  if (!reference) return null;

  const fullName = `${reference.owner}/${reference.name}`.toLowerCase();

  return (
    instances.find(
      (instance) => instance.sourceId.toLowerCase() === fullName,
    ) ??
    instances.find(
      (instance) =>
        `${instance.owner}/${instance.name}`.toLowerCase() === fullName,
    ) ??
    null
  );
}

function githubRepositoryFromInstance(
  instance: SourceInstanceIngestionStatus,
): GithubRepositoryDetails {
  return {
    owner: instance.owner ?? "",
    name: instance.name ?? "",
    repositoryId: instance.repositoryId,
    fullName: instance.sourceId,
    url: instance.sourceUrl,
    enabled: instance.enabled,
  };
}

/**
 * Builds the source cards for the Data Ingestion page. The project's connected
 * sources define which cards exist (and their stable `sourceId`, used for
 * selection and deep links); for GitHub, the per-repo status endpoint (#5) is
 * the authoritative source of the repository identity, health, counters, total
 * artifact count, enabled flag and per-type sync times — no longer reconstructed
 * from artifact metadata. Sources without a per-repo row (uploads, or an
 * unresolvable repo) fall back to their source system's latest run.
 */
function buildProjectDataSources(
  projectSources: ProjectSource[],
  sourceInstances: SourceInstanceIngestionStatus[],
  runs: IngestionRun[],
  /** Connector id (lowercase, e.g. "github") -> globally enabled. */
  connectorEnabledById: Map<string, boolean>,
): DataSource[] {
  const latestRunBySource = new Map<SourceSystem, IngestionRun>();
  const sourceCountBySystem = new Map<SourceSystem, number>();

  projectSources.forEach((projectSource) => {
    const sourceSystem = toSourceSystem(projectSource.type);
    if (!sourceSystem) return;

    sourceCountBySystem.set(
      sourceSystem,
      (sourceCountBySystem.get(sourceSystem) ?? 0) + 1,
    );
  });

  // Runs arrive newest-first, so the first hit per key is the latest.
  const latestRunByRepository = new Map<string, IngestionRun>();

  runs.forEach((run) => {
    if (!latestRunBySource.has(run.sourceSystem)) {
      latestRunBySource.set(run.sourceSystem, run);
    }

    [run.repositoryId, run.sourceId?.toLowerCase()].forEach((key) => {
      if (key && !latestRunByRepository.has(key)) {
        latestRunByRepository.set(key, run);
      }
    });
  });

  return projectSources.flatMap((projectSource): DataSource[] => {
    const sourceSystem = toSourceSystem(projectSource.type);
    if (!sourceSystem) return [];

    const meta = SOURCE_META[sourceSystem];
    const latestRun = latestRunBySource.get(sourceSystem);
    const sharesSourceSystem = (sourceCountBySystem.get(sourceSystem) ?? 1) > 1;
    const connectorEnabled = connectorEnabledById.get(
      sourceSystem.toLowerCase(),
    );
    const instance =
      sourceSystem === "GITHUB"
        ? matchSourceInstance(projectSource, sourceInstances)
        : null;

    if (instance) {
      const effectiveBackendStatus: BackendProjectSourceStatus =
        instance.enabled === false ? "DISABLED" : instance.connectionStatus;
      const hasErrors = instance.failedCount > 0;
      const hasNeverSynced = instance.lastRunTime === null;

      // Strictly this repository's own latest run. Falling back to the newest
      // run of the source system (or the per-system aggregate) would let one
      // failing repo colour every other GitHub card. The per-repo status
      // endpoint is authoritative for health anyway; a run only adds the
      // AI-sync stage, and having none loaded simply means "unknown".
      const repositoryRun =
        (instance.repositoryId
          ? latestRunByRepository.get(instance.repositoryId)
          : undefined) ??
        latestRunByRepository.get(instance.sourceId.toLowerCase()) ??
        null;
      const runStatus = repositoryRun?.status ?? null;

      return [
        {
          sourceId: projectSource.id,
          sourceSystem,
          name: projectSource.name,
          type: meta.type,
          icon: meta.icon,
          status: getSourceStatusFromBackend(effectiveBackendStatus),
          backendStatus: effectiveBackendStatus,
          statusLabel: getBackendSourceStatusLabel(effectiveBackendStatus),
          ingestionStatus: getSourceStatus(
            hasNeverSynced,
            hasErrors,
            runStatus,
          ),
          ingestionStatusLabel: getIngestionStatusLabel(
            hasNeverSynced,
            hasErrors,
            runStatus,
          ),
          statusView: deriveSourceStatus({
            backendStatus: effectiveBackendStatus,
            runStatus,
            aiSyncStatus: repositoryRun?.aiSyncStatus ?? null,
            hasErrors,
            hasNeverSynced,
            connectorEnabled,
          }),
          artifacts: instance.artifactCount,
          lastSync: formatDateTime(instance.lastRunTime),
          nextSync: "Not available",
          errors: instance.failedCount,
          description: meta.description,
          lastRunAt: instance.lastRunTime,
          latestIngestedCount: instance.ingestedCount,
          latestUpdatedCount: instance.updatedCount,
          deletedCount: instance.deletedCount,
          totalArtifactCount: instance.artifactCount,
          runIds: [],
          sharesSourceSystem,
          failedItems: instance.failedItems,
          githubRepository: githubRepositoryFromInstance(instance),
          lastCommitsSyncAt: instance.lastCommitsSyncAt,
          lastIssuesSyncAt: instance.lastIssuesSyncAt,
          lastPullRequestsSyncAt: instance.lastPullRequestsSyncAt,
        },
      ];
    }

    // Fallback for sources without a per-repo status row (uploads, or a repo
    // whose connection could not be resolved): everything comes from the
    // source system's latest run.
    const backendStatus = projectSource.status;
    const latestUpdatedCount = latestRun?.updatedCount ?? 0;
    const failedItems = latestRun?.failedItems ?? [];
    const errors = latestRun?.failedCount ?? failedItems.length;
    const lastRunAt = latestRun?.startedAt ?? null;
    const hasNeverSynced = lastRunAt === null;
    const runStatus = latestRun?.status ?? null;
    const latestIngestedCount = latestRun?.ingestedCount ?? 0;

    return [
      {
        sourceId: projectSource.id,
        sourceSystem,
        name: projectSource.name,
        type: meta.type,
        icon: meta.icon,
        status: getSourceStatusFromBackend(backendStatus),
        backendStatus,
        statusLabel: getBackendSourceStatusLabel(backendStatus),
        ingestionStatus: getSourceStatus(hasNeverSynced, errors > 0, runStatus),
        ingestionStatusLabel: getIngestionStatusLabel(
          hasNeverSynced,
          errors > 0,
          runStatus,
        ),
        statusView: deriveSourceStatus({
          backendStatus,
          runStatus,
          aiSyncStatus: latestRun?.aiSyncStatus ?? null,
          hasErrors: errors > 0,
          hasNeverSynced,
          connectorEnabled,
        }),
        artifacts: latestIngestedCount,
        lastSync: formatDateTime(lastRunAt),
        nextSync: "Not available",
        errors,
        description: meta.description,
        lastRunAt,
        latestIngestedCount,
        latestUpdatedCount,
        deletedCount: latestRun?.deletedCount ?? 0,
        totalArtifactCount: 0,
        runIds: [],
        sharesSourceSystem,
        failedItems,
        githubRepository: null,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      },
    ];
  });
}
function hasSourceId(sources: DataSource[], sourceId: string) {
  return sources.some((source) => source.sourceId === sourceId);
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
  const [selectedRunSnapshot, setSelectedRunSnapshot] =
    useState<IngestionRun | null>(null);

  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [runPageMeta, setRunPageMeta] = useState<PageMetadata | null>(null);
  const [runPageNumber, setRunPageNumber] = useState(1);
  const [runFilter, setRunFilter] =
    useState<RunFilterState>(DEFAULT_RUN_FILTER);
  // Monotonic id of the newest run request, so out-of-order responses are dropped.
  const runRequestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [projectSources, setProjectSources] = useState<ProjectSource[]>([]);
  const [sourceInstances, setSourceInstances] = useState<
    SourceInstanceIngestionStatus[]
  >([]);
  // Connected Jira instances for the selected project. Jira is not a
  // ProjectSourceProvider on the backend, so its instances never appear in
  // `projectSources`/`sourceInstances` and are loaded separately here.
  const [jiraInstances, setJiraInstances] = useState<JiraInstanceDto[]>([]);
  const [projectDataVersion, setProjectDataVersion] = useState(0);
  const [sourceStatusErrorMessage, setSourceStatusErrorMessage] = useState<
    string | null
  >(null);
  const [projectSourcesErrorMessage, setProjectSourcesErrorMessage] = useState<
    string | null
  >(null);
  const [isProjectDataLoading, setIsProjectDataLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState(false);
  const [isSyncSettingsModalOpen, setIsSyncSettingsModalOpen] = useState(false);
  const [globalGithubSyncConfig, setGlobalGithubSyncConfig] =
    useState<ConfigureGithubRepositoryRequest>(
      DEFAULT_GLOBAL_GITHUB_SYNC_CONFIG,
    );
  const [githubTokenNames, setGithubTokenNames] = useState<string[]>([]);
  const [connectSuccessMessage, setConnectSuccessMessage] = useState<
    string | null
  >(null);
  const [pollingUntil, setPollingUntil] = useState<number | null>(null);
  const [connectors, setConnectors] = useState<ConnectorListItem[]>([]);
  const [connectorsLoadingState, setConnectorsLoadingState] =
    useState<LoadingState>("idle");
  const [connectorsErrorMessage, setConnectorsErrorMessage] = useState<
    string | null
  >(null);
  const [hasLoadedConnectors, setHasLoadedConnectors] = useState(false);
  const [togglingConnectorId, setTogglingConnectorId] = useState<string | null>(
    null,
  );
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );

  // The project is chosen globally in the sidebar switcher. The `?projectId=`
  // search param is still honoured so deep links from the admin view land on
  // the right project — it writes into the global selection below.
  const {
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    reloadProjects,
  } = useProjectContext();

  const requestedProjectId = searchParams.get("projectId") ?? "";
  const requestedSourceId = searchParams.get("sourceId") ?? "";

  // Tracks the last project we loaded data for, so an in-place refresh (a
  // `projectDataVersion` bump after saving) can reload without wiping the source
  // list — clearing it would drop `selectedSource` and close an open details
  // drawer mid-save. Only a real project switch resets the lists.
  const loadedProjectIdRef = useRef<string | null>(null);

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
  }, [
    requestedProjectId,
    searchParams,
    selectedProjectId,
    setSearchParams,
    setSelectedProjectId,
  ]);

  // A project's connected sources come from the project-scoped detail endpoint
  // any member may reach, not from the admin-only project listing behind the
  // switcher (which leaves `sources` empty for PM/member users). Sources and
  // the artifact snapshot are fetched together so a project switch reveals the
  // repo and its ingested files as one unit: the state is reset up front (no
  // stale counts from the previous project) and a single loading flag covers
  // both, so the list never renders "done but empty" while the heavier snapshot
  // is still in flight.
  useEffect(() => {
    let isMounted = true;

    // Deferred to a microtask so the resets below do not run synchronously in
    // the effect body and cascade a render (same pattern as the provider).
    void Promise.resolve().then(async () => {
      if (!isMounted) return;

      // Only a real project switch clears the current lists; an in-place refresh
      // (same project, version bump) reloads without emptying them, so an open
      // details drawer and its selection survive a save.
      const isProjectSwitch = loadedProjectIdRef.current !== selectedProjectId;
      loadedProjectIdRef.current = selectedProjectId;

      if (isProjectSwitch) {
        setProjectSources([]);
        setSourceInstances([]);
        setJiraInstances([]);
      }
      setProjectSourcesErrorMessage(null);
      setSourceStatusErrorMessage(null);

      if (!selectedProjectId) {
        setIsProjectDataLoading(false);
        return;
      }

      if (isProjectSwitch) {
        setIsProjectDataLoading(true);
      }

      const [projectResult, sourceStatusResult, jiraResult] =
        await Promise.allSettled([
          projectService.getAccessibleProject(selectedProjectId),
          getIngestionSourceStatuses(selectedProjectId),
          getJiraInstances(selectedProjectId),
        ]);

      if (!isMounted) return;

      if (projectResult.status === "fulfilled") {
        setProjectSources(projectResult.value.sources);
      } else {
        setProjectSourcesErrorMessage(
          projectResult.reason instanceof Error
            ? projectResult.reason.message
            : "Project sources could not be loaded.",
        );
      }

      if (sourceStatusResult.status === "fulfilled") {
        setSourceInstances(sourceStatusResult.value);
      } else {
        setSourceStatusErrorMessage(
          sourceStatusResult.reason instanceof Error
            ? sourceStatusResult.reason.message
            : "Source status could not be loaded.",
        );
      }

      // Jira instances degrade quietly: a load failure (e.g. an HR user without
      // the PM/ADMIN role the endpoint requires) must not blank the page or
      // surface an error banner — it just means no Jira cards.
      setJiraInstances(
        jiraResult.status === "fulfilled" ? jiraResult.value : [],
      );

      setIsProjectDataLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [projectDataVersion, selectedProjectId]);

  // Server-side query for the run history. Scoping by project is what keeps runs
  // from other projects' repositories out of the list; the backend resolves the
  // project to its connected repositories.
  const buildRunQuery = useCallback(
    (page: number): IngestionRunFilter => {
      const hasSource = runFilter.sourceValue !== "ALL";

      return {
        page,
        size: RUN_PAGE_SIZE,
        projectId: selectedProjectId || undefined,
        // GitHub scopes by repositoryId; Jira (and any connector-neutral source)
        // scopes by the run's sourceInstanceRef via sourceRef.
        repositoryId:
          hasSource && runFilter.sourceSystem === "GITHUB"
            ? runFilter.sourceValue
            : undefined,
        sourceRef:
          hasSource && runFilter.sourceSystem === "JIRA"
            ? runFilter.sourceValue
            : undefined,
        status: runFilter.status !== "ALL" ? runFilter.status : undefined,
      };
    },
    [
      runFilter.sourceValue,
      runFilter.sourceSystem,
      runFilter.status,
      selectedProjectId,
    ],
  );

  // Loads exactly the page currently being viewed.
  //
  // Starting a repository update fires several overlapping refreshes (an
  // immediate one, a delayed one, plus the 3s poll). Their responses can resolve
  // out of order, and an older snapshot landing last would drop the runs that
  // were just created -- which looked like new runs only appearing after a
  // manual browser refresh. The sequence guard keeps the newest response.
  const loadRuns = useCallback(
    async (page: number) => {
      const requestId = ++runRequestIdRef.current;
      const result = await getIngestionRunsPage(buildRunQuery(page));

      if (requestId !== runRequestIdRef.current) return;

      // The viewed page can fall out of range while the view is open (a filter
      // narrowing the result set, runs being removed). Step back to the last
      // page instead of showing an empty table; this re-triggers the load.
      if (result.page.totalPages >= 1 && page > result.page.totalPages) {
        setRunPageNumber(result.page.totalPages);
        return;
      }

      setRuns(result.items);
      setRunPageMeta(result.page);
    },
    [buildRunQuery],
  );

  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoadingState("loading");
      }
      setErrorMessage(null);

      try {
        await loadRuns(runPageNumber);
        setLoadingState("success");
      } catch (error) {
        if (showLoading) {
          setLoadingState("error");
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load ingestion data",
        );
      }
    },
    [loadRuns, runPageNumber],
  );

  // In-place refresh of the per-repo status (#5) after a source mutation, without
  // re-running the whole project fetch. Scoped to the selected project so a PM
  // only sees their project's repos (the backend `projectId` filter).
  const reloadSourceStatuses = useCallback(async () => {
    if (!selectedProjectId) {
      setSourceInstances([]);
      setJiraInstances([]);
      return;
    }

    try {
      const statuses = await getIngestionSourceStatuses(selectedProjectId);
      setSourceInstances(statuses);
    } catch {
      // The combined project-data effect surfaces load errors; a failed in-place
      // refresh should leave the last-known statuses in place rather than blank
      // the cards.
    }

    // Independent of the GitHub status refresh: a Jira failure must not stop the
    // GitHub statuses from updating, and vice versa.
    try {
      setJiraInstances(await getJiraInstances(selectedProjectId));
    } catch {
      // Keep the last-known Jira instances on a failed in-place refresh.
    }
  }, [selectedProjectId]);

  // Runs on mount and whenever the run query changes (project, filters or the
  // selected page). Only the first load shows the page-level loading state, so
  // paging and filtering refresh quietly.
  useEffect(() => {
    const showLoading = !hasLoadedOnceRef.current;
    hasLoadedOnceRef.current = true;

    void loadData(showLoading);
  }, [loadData]);

  useEffect(() => {
    const hasRunningRun = runs.some((run) => isRunInProgress(run.status));
    const isPollingWindowActive =
      pollingUntil !== null && Date.now() < pollingUntil;

    if (!hasRunningRun && !isPollingWindowActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const shouldStopPolling =
        pollingUntil !== null &&
        Date.now() >= pollingUntil &&
        !runs.some((run) => isRunInProgress(run.status));

      if (shouldStopPolling) {
        setPollingUntil(null);
        return;
      }

      void loadData(false);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [loadData, pollingUntil, runs]);

  const connectorEnabledById = useMemo(
    () =>
      new Map(
        connectors.map((connector) => [
          connector.id.toLowerCase(),
          connector.enabled,
        ]),
      ),
    [connectors],
  );

  const sources = useMemo<DataSource[]>(() => {
    const githubAndUpload = buildProjectDataSources(
      projectSources,
      sourceInstances,
      runs,
      connectorEnabledById,
    );

    // Jira cards are now driven by the connector-neutral status rows (health,
    // counters, artifact total, last sync) — the same authoritative source as
    // GitHub. The status endpoint carries no credential metadata, so the Jira
    // instance DTOs are merged in by URL purely for the credential shown in the
    // details panel and used by the update action.
    const jiraInstanceByUrl = new Map(
      jiraInstances.map((instance) => [
        instance.instanceUrl.toLowerCase(),
        instance,
      ]),
    );

    const jiraSources = sourceInstances
      .filter((status) => status.sourceSystem === "JIRA")
      .map((status) =>
        createJiraSourceFromInstance(
          status,
          jiraInstanceByUrl.get(status.sourceId.toLowerCase()) ?? null,
        ),
      );

    return [...githubAndUpload, ...jiraSources];
  }, [
    connectorEnabledById,
    jiraInstances,
    projectSources,
    runs,
    sourceInstances,
  ]);

  const totalArtifactCount = useMemo(
    () => sourceInstances.reduce((sum, s) => sum + s.artifactCount, 0),
    [sourceInstances],
  );

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (!isMounted) return;

      const requestedSourceExists =
        requestedSourceId.length > 0 && hasSourceId(sources, requestedSourceId);

      if (requestedSourceExists) {
        setActiveSection("sources");
      }

      setSelectedSourceId((currentSourceId) => {
        if (requestedSourceExists) {
          return requestedSourceId;
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
  const hasGithubSources = visibleSourceSystems.has("GITHUB");

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
  const canManageGithubSyncSettings =
    profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  // The `/github/connect` endpoint only checks the global PM/ADMIN role, so the
  // backend accepts an ingest into a project the PM is merely a member of and
  // then fails deep in the pipeline with a 500. Mirror the product rule up front
  // instead: only the assigned project manager (or an admin) may connect a
  // source to a project.
  const canIngestIntoSelectedProject =
    profile?.permissionGroup === "ADMIN" ||
    (selectedProject?.isManaged ?? false);

  const runSourceLabels = useMemo(
    () => buildRunSourceLabels(sources),
    [sources],
  );

  // Sources offered in the run filter, from the project's connected sources: a
  // GitHub repo filters by its repositoryId, a Jira instance by its URL
  // (sourceId), which the query maps to sourceRef.
  const runSourceOptions = useMemo<RunSourceFilterOption[]>(
    () =>
      sources.flatMap((source): RunSourceFilterOption[] => {
        if (source.githubRepository?.repositoryId) {
          return [
            {
              value: source.githubRepository.repositoryId,
              label: source.name,
              sourceSystem: "GITHUB",
            },
          ];
        }

        if (source.sourceSystem === "JIRA") {
          return [
            {
              value: source.sourceId,
              label: source.name,
              sourceSystem: "JIRA",
            },
          ];
        }

        return [];
      }),
    [sources],
  );

  const isRunFilterActive =
    runFilter.status !== "ALL" || runFilter.sourceValue !== "ALL";

  const handleResetRunFilter = useCallback(() => {
    setRunFilter(DEFAULT_RUN_FILTER);
    setRunPageNumber(1);
  }, []);

  const loadConnectors = useCallback(async () => {
    setConnectorsLoadingState("loading");
    setConnectorsErrorMessage(null);

    try {
      const response = await connectorService.listConnectors();
      setConnectors(toConnectorListItems(response));
      setHasLoadedConnectors(true);
      setConnectorsLoadingState("success");
    } catch (error) {
      setConnectorsLoadingState("error");
      setConnectorsErrorMessage(
        error instanceof Error ? error.message : "Failed to load connectors",
      );
    }
  }, []);

  // The connector state decides whether a source reaches chat at all, so it is
  // loaded with the page rather than only when the connectors modal opens —
  // otherwise a globally disabled connector stays invisible while every card
  // still claims "Connected".
  //
  // Failure is swallowed on purpose: the endpoint is PM/ADMIN-only, but HR may
  // open this page. An unknown connector state must not fake a disabled source.
  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const response = await connectorService.listConnectors();
        setConnectors(toConnectorListItems(response));
        setHasLoadedConnectors(true);
      } catch {
        setConnectors([]);
      }
    });
  }, []);

  const handleSectionChange = useCallback((section: SectionKey) => {
    setActiveSection(section);
  }, []);

  const handleOpenConnectorsModal = useCallback(() => {
    setIsConnectorsModalOpen(true);

    if (!hasLoadedConnectors && connectorsLoadingState !== "loading") {
      void loadConnectors();
    }
  }, [connectorsLoadingState, hasLoadedConnectors, loadConnectors]);

  const handleToggleConnectorEnabled = useCallback(
    async (connector: ConnectorListItem) => {
      setTogglingConnectorId(connector.id);
      setConnectorsErrorMessage(null);

      try {
        const response = await connectorService.setConnectorEnabled(
          connector.id,
          !connector.enabled,
        );

        setConnectors((current) =>
          current.map((item) =>
            item.id === connector.id ? { ...item, ...response } : item,
          ),
        );
      } catch (error) {
        setConnectorsErrorMessage(
          error instanceof Error ? error.message : "Failed to update connector",
        );
      } finally {
        setTogglingConnectorId(null);
      }
    },
    [],
  );

  const handleToggleConnectorSources = useCallback(
    (connector: ConnectorListItem) => {
      setSelectedConnectorId((current) =>
        current === connector.id ? null : connector.id,
      );
    },
    [],
  );

  const selectedSource = useMemo(() => {
    if (!selectedSourceId) return null;

    return (
      sources.find((source) => source.sourceId === selectedSourceId) ?? null
    );
  }, [selectedSourceId, sources]);

  const loadGithubTokenNames = useCallback(() => {
    void getGithubPatNames()
      .then((tokenNames) => {
        setGithubTokenNames(tokenNames);
      })
      .catch(() => {
        setGithubTokenNames([]);
      });
  }, []);

  // The wizard covers both connect paths (org discovery and a single repository),
  // so this is the only entry point.
  const handleOpenAddSourceModal = () => {
    setIsAddSourceModalOpen(true);
    loadGithubTokenNames();
  };

  // Runs after the wizard connects a source (GitHub repositories or a Jira
  // instance): surface a success message, kick the polling window and refresh
  // the page's data.
  const handleDiscoveryConnected = useCallback(() => {
    setConnectSuccessMessage(
      `Selected sources are connecting to ${selectedProject?.name ?? "the project"}. Initial ingestion is running in the background.`,
    );
    setPollingUntil(Date.now() + 60000);
    setActiveSection("sources");

    void Promise.all([
      loadData(false),
      reloadProjects(),
      reloadSourceStatuses(),
    ]).then(() => setProjectDataVersion((version) => version + 1));

    window.setTimeout(() => {
      void loadData(false);
      void reloadProjects();
      void reloadSourceStatuses();
      setProjectDataVersion((version) => version + 1);
    }, 1500);
  }, [loadData, reloadSourceStatuses, reloadProjects, selectedProject]);

  // Shared post-update refresh: polling window + an immediate and a delayed
  // reload, so a just-started run appears without a manual refresh.
  const refreshAfterUpdate = useCallback(
    (startedMessage: string) => {
      setPollingUntil(Date.now() + 60000);
      setConnectSuccessMessage(startedMessage);

      void Promise.all([loadData(false), reloadSourceStatuses()]).then(() =>
        setProjectDataVersion((version) => version + 1),
      );

      window.setTimeout(() => {
        void loadData(false);
        void reloadSourceStatuses();
        setProjectDataVersion((version) => version + 1);
      }, 1500);
    },
    [loadData, reloadSourceStatuses],
  );

  const handleUpdateSource = useCallback(
    async (source: DataSource) => {
      if (source.sourceSystem === "JIRA") {
        if (!source.jiraInstance) {
          throw new Error(
            "Instance details are not available for this source.",
          );
        }

        await updateJiraInstance({
          instanceUrl: source.jiraInstance.instanceUrl,
        });
        refreshAfterUpdate(`Update for ${source.name} started.`);
        return;
      }

      if (source.sourceSystem !== "GITHUB" || !source.githubRepository) {
        throw new Error(
          "Repository details are not available for this source.",
        );
      }

      await updateGithubRepository(source.githubRepository);
      refreshAfterUpdate(
        `Update for ${source.githubRepository.fullName} started.`,
      );
    },
    [refreshAfterUpdate],
  );

  const handleSaveGlobalGithubConfig = useCallback(
    async (request: ConfigureGithubRepositoryRequest) => {
      await configureAllGithubRepositories(request);
      setGlobalGithubSyncConfig(request);
      // Deliberately does NOT reloadProjects(): changing sync schedules does not
      // affect the project switcher's data, and a project reload can transiently
      // reset the selected project (e.g. a slow managed-projects fetch), which
      // makes the page-data effect treat it as a project switch and blank the
      // page. See the note on refreshSourceDetails.
      await Promise.all([loadData(false), reloadSourceStatuses()]);
    },
    [loadData, reloadSourceStatuses],
  );

  const handleLoadGithubRepositoryConfig = useCallback(
    async (repository: GithubRepositoryDetails) => {
      return getGithubRepositoryConfig(repository);
    },
    [],
  );

  const handleSaveGithubRepositoryConfig = useCallback(
    async (
      repository: GithubRepositoryDetails,
      request: ConfigureGithubRepositoryRequest,
    ) => {
      await configureGithubRepository(repository, request);
      // No reloadProjects(): see refreshSourceDetails — a per-repo sync-schedule
      // change never alters the project switcher, and reloading it can reset the
      // selected project and blank the page mid-save.
      await Promise.all([loadData(false), reloadSourceStatuses()]);
    },
    [loadData, reloadSourceStatuses],
  );

  const handleLoadJiraConfig = useCallback(
    async (instanceUrl: string) => getJiraConfig(instanceUrl),
    [],
  );

  const handleSaveJiraConfig = useCallback(
    async (
      instanceUrl: string,
      request: Omit<ConfigureJiraInstanceRequest, "instanceUrl">,
    ) => {
      await configureJiraInstance({ instanceUrl, ...request });
      // Mirrors the GitHub path: no reloadProjects(), just refresh this page's
      // run list and per-source statuses so the next-sync time updates.
      await Promise.all([loadData(false), reloadSourceStatuses()]);
    },
    [loadData, reloadSourceStatuses],
  );

  // Refreshes just this page's data after a source-level mutation (enable/disable,
  // "Refresh details"). It intentionally does NOT reloadProjects(): the switcher's
  // project list is unaffected by these actions, and reloading it can transiently
  // drop the selected project (a slow/failed managed-projects fetch resets the
  // selection), which the page-data effect then reads as a project switch — it
  // clears the source list, shows the initial loading skeleton and closes the
  // open details drawer. That reset is what read as "the whole page reloads".
  const refreshSourceDetails = useCallback(async () => {
    await Promise.all([loadData(false), reloadSourceStatuses()]);
    setProjectDataVersion((version) => version + 1);
  }, [loadData, reloadSourceStatuses]);

  // Enables/disables a connected repository as an ingestion source (the
  // connector allow/deny toggle), then refreshes so the drawer reflects it.
  const handleSetSourceEnabled = useCallback(
    async (repository: GithubRepositoryDetails, enabled: boolean) => {
      await connectorService.patchConnectorSources("github", [
        { sourceId: repository.fullName, enabled },
      ]);
      await refreshSourceDetails();
    },
    [refreshSourceDetails],
  );

  // Jira instances are gated through the same generic connector endpoint as
  // GitHub: the JiraConnector's patchSource flips `sourceEnabled` and the AI
  // service is notified, keyed by the instance URL.
  const handleSetJiraSourceEnabled = useCallback(
    async (instanceUrl: string, enabled: boolean) => {
      await connectorService.patchConnectorSources("jira", [
        { sourceId: instanceUrl, enabled },
      ]);
      await refreshSourceDetails();
    },
    [refreshSourceDetails],
  );

  // Removes a GitHub repository's link to the selected project (the DELETE
  // counterpart to linking it via the Add Source flow). The repository and its
  // artifacts are kept; only this project stops using it. Closes the drawer and
  // refreshes the project-scoped lists so the source card disappears.
  const handleUnlinkSource = useCallback(
    async (source: DataSource) => {
      const repositoryId = source.githubRepository?.repositoryId;

      if (
        source.sourceSystem !== "GITHUB" ||
        !repositoryId ||
        !selectedProjectId
      ) {
        throw new Error("This repository cannot be removed from the project.");
      }

      await removeRepositoryFromProject(repositoryId, selectedProjectId);

      setSelectedSourceId(null);
      setConnectSuccessMessage(
        `${source.githubRepository?.fullName ?? "Repository"} was removed from ${selectedProject?.name ?? "the project"}.`,
      );
      await refreshSourceDetails();
    },
    [refreshSourceDetails, selectedProject?.name, selectedProjectId],
  );

  const isLoading = loadingState === "loading";

  const showOverview = activeSection === "overview";
  const showSources =
    activeSection === "overview" || activeSection === "sources";
  const showRuns = activeSection === "overview" || activeSection === "runs";

  const shouldShowInitialLoading =
    (isLoading || (isProjectDataLoading && showSources)) &&
    sources.length === 0;

  // Prefers the row from the currently loaded page, so an open drawer keeps
  // updating while polling refreshes the list, and falls back to the captured
  // run once the user pages away from it.
  const selectedRun = useMemo(() => {
    if (!selectedRunSnapshot) return null;

    return (
      runs.find((run) => run.runId === selectedRunSnapshot.runId) ??
      selectedRunSnapshot
    );
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
    <div className="bg-app-bg">
      <div>
        <DataIngestionHeader
          isLoading={isLoading}
          onAddSource={handleOpenAddSourceModal}
          onRefresh={() => {
            void loadData();
            void reloadProjects();
            void reloadSourceStatuses();
            if (isConnectorsModalOpen) {
              void loadConnectors();
            }
            setProjectDataVersion((version) => version + 1);
          }}
        />

        <main className="app-page-shell">
          <div className="space-y-8">
            {errorMessage && (
              <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                {errorMessage}
              </div>
            )}

            {sourceStatusErrorMessage && (
              <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                {sourceStatusErrorMessage}
              </div>
            )}

            {projectSourcesErrorMessage && (
              <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                {projectSourcesErrorMessage}
              </div>
            )}

            {connectSuccessMessage && (
              <div className="flex flex-col gap-3 rounded-2xl border border-app-success-border bg-app-success-bg px-5 py-4 text-sm text-app-success-text sm:flex-row sm:items-center sm:justify-between">
                <p>{connectSuccessMessage}</p>

                <button
                  type="button"
                  onClick={() => setConnectSuccessMessage(null)}
                  className="self-start rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-app-surface sm:self-auto"
                >
                  Dismiss
                </button>
              </div>
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
              <div className="space-y-8">
                {showOverview ? (
                  <OverviewSection
                    sources={sources}
                    totalArtifactCount={totalArtifactCount}
                    runs={runs}
                    onNavigate={handleSectionChange}
                  />
                ) : null}

                {showSources ? (
                  <section aria-label="Sources">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="mr-1 text-base font-bold tracking-tight text-app-text">
                          Sources
                        </h2>
                        {sourceHealth.connected > 0 && (
                          <StatusBadge tone="success">
                            {sourceHealth.connected} connected
                          </StatusBadge>
                        )}
                        {sourceHealth.syncing > 0 && (
                          <StatusBadge tone="brand">
                            {sourceHealth.syncing} syncing
                          </StatusBadge>
                        )}
                        {sourceHealth.attention > 0 && (
                          <StatusBadge tone="warning">
                            {sourceHealth.attention} need
                            {sourceHealth.attention === 1 ? "s" : ""} attention
                          </StatusBadge>
                        )}
                        {sourceHealth.disabled > 0 && (
                          <StatusBadge tone="neutral">
                            {sourceHealth.disabled} disabled
                          </StatusBadge>
                        )}
                      </div>

                      {canManageGithubSyncSettings ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            type="button"
                            onClick={handleOpenConnectorsModal}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text transition hover:border-app-brand-border hover:bg-app-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                          >
                            <Plug className="h-4 w-4" />
                            Manage connectors
                          </button>

                          {hasGithubSources ? (
                            <button
                              type="button"
                              onClick={() => setIsSyncSettingsModalOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text transition hover:border-app-brand-border hover:bg-app-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                            >
                              <CalendarClock className="h-4 w-4" />
                              Manage sync settings
                            </button>
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
                        <h2 className="text-base font-bold tracking-tight text-app-text">
                          Runs
                        </h2>
                        {runPageMeta ? (
                          <span className="rounded-full border border-app-border bg-app-bg-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-app-text-subtle">
                            {runPageMeta.totalElements} total
                          </span>
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
                      sourceLabelByRunId={runSourceLabels}
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
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedSource && (
        <SourceDetailsPanel
          source={selectedSource}
          onUpdateSource={handleUpdateSource}
          onRefreshDetails={refreshSourceDetails}
          canManageSyncSettings={canManageGithubSyncSettings}
          onLoadRepositoryConfig={handleLoadGithubRepositoryConfig}
          onSaveRepositoryConfig={handleSaveGithubRepositoryConfig}
          onLoadJiraConfig={handleLoadJiraConfig}
          onSaveJiraConfig={handleSaveJiraConfig}
          onSetSourceEnabled={handleSetSourceEnabled}
          onSetJiraSourceEnabled={handleSetJiraSourceEnabled}
          onUnlinkSource={
            canIngestIntoSelectedProject ? handleUnlinkSource : undefined
          }
          onClose={closeSourceDetails}
        />
      )}

      {selectedRun && (
        <RunDetailsPanel
          run={selectedRun}
          sourceLabel={getRunSourceLabel(selectedRun, runSourceLabels)}
          onClose={() => setSelectedRunSnapshot(null)}
        />
      )}

      <Modal
        isOpen={isConnectorsModalOpen}
        title="Connectors"
        description="Enable or disable a connector, and choose which sources are in scope for this project."
        size="lg"
        bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
        onClose={() => setIsConnectorsModalOpen(false)}
      >
        {connectorsErrorMessage && (
          <div className="mb-4 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
            {connectorsErrorMessage}
          </div>
        )}

        {connectorsLoadingState === "loading" && !hasLoadedConnectors ? (
          <ConnectorsLoadingState />
        ) : (
          <ConnectorList
            connectors={connectors}
            togglingConnectorId={togglingConnectorId}
            expandedConnectorId={selectedConnectorId}
            projectId={selectedProjectId}
            onToggleEnabled={(connector) => {
              void handleToggleConnectorEnabled(connector);
            }}
            onToggleSources={handleToggleConnectorSources}
            onSourcesSaved={() => {
              void loadConnectors();
              void reloadSourceStatuses();
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isSyncSettingsModalOpen}
        title="GitHub Sync Settings"
        description="Apply one sync policy to all connected GitHub repositories."
        size="lg"
        bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
        onClose={() => setIsSyncSettingsModalOpen(false)}
      >
        <GithubRepositorySyncSettings
          initialConfig={globalGithubSyncConfig}
          onSave={handleSaveGlobalGithubConfig}
          showNextSync={false}
          disclaimer="Applying global settings overwrites the sync settings of every connected GitHub repository."
          autoUpdateOnText="Due checks update all connected GitHub repositories."
          autoUpdateOffText="Due checks only mark connected GitHub repositories out of date."
          toggleAriaLabel="Toggle global GitHub auto update"
          saveLabel="Apply globally"
        />
      </Modal>

      {isAddSourceModalOpen && (
        <AddSourceModal
          projectId={selectedProjectId}
          projectName={selectedProject?.name}
          tokenNames={githubTokenNames}
          jiraDefaultEmail={profile?.email ?? null}
          canIngest={Boolean(selectedProjectId) && canIngestIntoSelectedProject}
          ingestBlockedReason={
            !selectedProjectId
              ? "Select a project before connecting repositories."
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
