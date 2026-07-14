import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal.tsx";
import { ArtifactTable } from "../features/data-ingestion/components/ArtifactTable.tsx";
import { DataIngestionHeader } from "../features/data-ingestion/components/DataIngestionHeader.tsx";
import { DataIngestionLoadingState } from "../features/data-ingestion/components/DataIngestionLoadingState.tsx";
import { DataIngestionTabs } from "../features/data-ingestion/components/DataIngestionTabs.tsx";
import { IngestionMetrics } from "../features/data-ingestion/components/IngestionMetrics.tsx";
import { RunHistory } from "../features/data-ingestion/components/RunHistory.tsx";
import { GithubRepositorySyncSettings } from "../features/data-ingestion/components/GithubRepositorySyncSettings.tsx";
import { SourceConnectModal } from "../features/data-ingestion/components/SourceConnectModal.tsx";
import { SourceDetailsPanel } from "../features/data-ingestion/components/SourceDetailsPanel.tsx";
import { SourceList } from "../features/data-ingestion/components/SourceList.tsx";
import { ConnectorList } from "../features/connectors/components/ConnectorList.tsx";
import { ConnectorsLoadingState } from "../features/connectors/components/ConnectorsLoadingState.tsx";
import { toConnectorListItems } from "../features/connectors/data.ts";
import type { ConnectorListItem } from "../features/connectors/types.ts";
import {
  connectorService,
  type ConnectorSource,
} from "../services/connectorService.ts";
import {
  formatDateTime,
  getBackendSourceStatusLabel,
  getSourceStatus,
  getSourceStatusFromBackend,
  getSourceStatusLabel,
  INGESTION_RUN_LIMIT,
  isRunInProgress,
  SOURCE_META,
  SOURCE_SYSTEMS,
} from "../features/data-ingestion/data.ts";
import type {
  ActiveTab,
  Artifact,
  ConnectState,
  DataSource,
  GithubRepositoryDetails,
  GithubRepositoryReference,
  IngestionRun,
  LoadingState,
  SourceIngestionStatus,
  SourceSystem,
} from "../features/data-ingestion/types.ts";
import {
  getIngestionRuns,
  getIngestionStatus,
  getProjectArtifactSnapshot,
} from "../services/ingestionService.ts";
import { useAuth } from "../context/useAuth";
import { useProjectSelection } from "../features/projects/useProjectSelection.ts";
import {
  configureAllGithubRepositories,
  configureGithubRepository,
  connectGithubRepository,
  getGithubRepositoryConfig,
  getGithubPatNames,
  updateGithubRepository,
  type ConfigureGithubRepositoryRequest,
} from "../services/sources/githubService.ts";
import type { ProjectSource } from "../services/projectService.ts";

const GITHUB_REPOSITORY_STORAGE_KEY =
  "sprintstart:data-ingestion:last-github-repository";
const DEFAULT_GLOBAL_GITHUB_SYNC_CONFIG: ConfigureGithubRepositoryRequest = {
  autoUpdate: true,
  schedule: { type: "INTERVAL", everyMinutes: 60 },
};

async function fetchIngestionData() {
  const [statusData, runData] = await Promise.all([
    getIngestionStatus(),
    getIngestionRuns(INGESTION_RUN_LIMIT),
  ]);

  return { statusData, runData };
}

function parseGithubRepositoryInput(
  ownerInput: string,
  repositoryInput: string,
) {
  const trimmedOwnerInput = ownerInput.trim();
  const trimmedRepositoryInput = repositoryInput.trim();
  const parsedOwnerInput = parseGithubRepositoryReference(trimmedOwnerInput);

  if (parsedOwnerInput) {
    return parsedOwnerInput;
  }

  if (trimmedOwnerInput && trimmedRepositoryInput) {
    return {
      owner: trimmedOwnerInput,
      name: trimmedRepositoryInput,
    };
  }

  return null;
}

function parseGithubRepositoryReference(value: string) {
  const normalizedInput = value
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const [owner, name] = normalizedInput
    .split("/")
    .filter((segment) => segment.length > 0);

  if (owner && name) {
    return { owner, name };
  }

  return null;
}

function storeGithubRepository(repository: GithubRepositoryReference) {
  window.localStorage.setItem(
    GITHUB_REPOSITORY_STORAGE_KEY,
    JSON.stringify(repository),
  );
}

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

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getArtifactSearchText(artifact: Artifact) {
  return [
    artifact.title,
    artifact.sourceUrl,
    artifact.metadata,
    artifact.sourceSystem,
    artifact.artifactType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getProjectSourceArtifacts(
  artifacts: Artifact[],
  projectSource: ProjectSource,
  sourceSystem: SourceSystem,
  sourceCountForSystem: number,
) {
  const sourceArtifacts = artifacts.filter(
    (artifact) => artifact.sourceSystem === sourceSystem,
  );

  if (sourceCountForSystem <= 1) {
    return sourceArtifacts;
  }

  const candidates = [projectSource.name, projectSource.id]
    .map(normalizeSearchValue)
    .filter((value) => value.length > 0);

  return sourceArtifacts.filter((artifact) => {
    const artifactSearchText = getArtifactSearchText(artifact);
    return candidates.some((candidate) =>
      artifactSearchText.includes(candidate),
    );
  });
}

function getLatestArtifactIngestedAt(artifacts: Artifact[]) {
  return artifacts.reduce<string | null>((latest, artifact) => {
    if (!latest) return artifact.ingestedAt;

    return new Date(artifact.ingestedAt).getTime() > new Date(latest).getTime()
      ? artifact.ingestedAt
      : latest;
  }, null);
}

type GithubArtifactMetadataPayload = {
  repositoryId?: string;
  repositoryFullName?: string;
};

function parseGithubArtifactMetadata(
  artifact: Artifact,
): GithubArtifactMetadataPayload | null {
  try {
    const metadata = JSON.parse(
      artifact.metadata,
    ) as GithubArtifactMetadataPayload;

    if (metadata.repositoryId || metadata.repositoryFullName) {
      return metadata;
    }
  } catch {
    return null;
  }

  return null;
}

function getGithubMetadataForSource(
  artifacts: Artifact[],
  projectSource: ProjectSource,
) {
  const parsedMetadata = artifacts
    .map(parseGithubArtifactMetadata)
    .filter((metadata): metadata is GithubArtifactMetadataPayload =>
      Boolean(metadata),
    );

  return (
    parsedMetadata.find(
      (metadata) => metadata.repositoryId === projectSource.id,
    ) ??
    parsedMetadata[0] ??
    null
  );
}

function getConnectorSourceForGithubRepository(
  projectSource: ProjectSource,
  connectorSources: ConnectorSource[],
  repositoryFullName?: string,
) {
  const normalizedProjectSourceName = normalizeSearchValue(projectSource.name);
  const normalizedFullName = repositoryFullName
    ? normalizeSearchValue(repositoryFullName)
    : null;

  if (normalizedFullName) {
    const exactMatch = connectorSources.find((source) => {
      const normalizedSourceId = normalizeSearchValue(source.id);
      const normalizedSourceUrl = normalizeSearchValue(source.url);

      return (
        normalizedSourceId === normalizedFullName ||
        normalizedSourceUrl.includes(`github.com/${normalizedFullName}`)
      );
    });

    if (exactMatch) return exactMatch;
  }

  return connectorSources.find(
    (source) =>
      normalizeSearchValue(source.name) === normalizedProjectSourceName,
  );
}

function getGithubRepositoryDetails(
  projectSource: ProjectSource,
  artifacts: Artifact[],
  connectorSources: ConnectorSource[],
): GithubRepositoryDetails | null {
  const metadata = getGithubMetadataForSource(artifacts, projectSource);
  const metadataReference = metadata?.repositoryFullName
    ? parseGithubRepositoryReference(metadata.repositoryFullName)
    : null;
  const connectorSource = getConnectorSourceForGithubRepository(
    projectSource,
    connectorSources,
    metadata?.repositoryFullName,
  );
  const connectorReference = connectorSource
    ? (parseGithubRepositoryReference(connectorSource.id) ??
      parseGithubRepositoryReference(connectorSource.url))
    : null;
  const artifactReference =
    artifacts
      .map((artifact) =>
        parseGithubRepositoryReference(artifact.sourceUrl ?? ""),
      )
      .find((reference): reference is GithubRepositoryReference =>
        Boolean(reference),
      ) ?? null;
  const sourceIdReference = parseGithubRepositoryReference(projectSource.id);
  const repositoryReference =
    metadataReference ??
    connectorReference ??
    artifactReference ??
    sourceIdReference;

  if (!repositoryReference) return null;

  const fullName = `${repositoryReference.owner}/${repositoryReference.name}`;
  const hasRepositorySourceId = sourceIdReference !== null;

  return {
    ...repositoryReference,
    repositoryId:
      metadata?.repositoryId ??
      (hasRepositorySourceId ? null : projectSource.id),
    fullName,
    url: connectorSource?.url ?? `https://github.com/${fullName}`,
    enabled: connectorSource?.enabled ?? null,
  };
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

function buildProjectDataSources(
  projectSources: ProjectSource[],
  sourceStatuses: SourceIngestionStatus[],
  runs: IngestionRun[],
  artifacts: Artifact[],
  githubConnectorSources: ConnectorSource[],
): DataSource[] {
  const statusBySource = new Map<SourceSystem, SourceIngestionStatus>();
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

  sourceStatuses.forEach((status) => {
    statusBySource.set(status.sourceSystem, status);
  });

  runs.forEach((run) => {
    if (!latestRunBySource.has(run.sourceSystem)) {
      latestRunBySource.set(run.sourceSystem, run);
    }
  });

  return projectSources.flatMap((projectSource) => {
    const sourceSystem = toSourceSystem(projectSource.type);
    if (!sourceSystem) return [];

    const meta = SOURCE_META[sourceSystem];
    const status = statusBySource.get(sourceSystem);
    const latestRun = latestRunBySource.get(sourceSystem);
    const backendStatus = projectSource.status;
    const matchedArtifacts = getProjectSourceArtifacts(
      artifacts,
      projectSource,
      sourceSystem,
      sourceCountBySystem.get(sourceSystem) ?? 1,
    );
    const githubRepository =
      sourceSystem === "GITHUB"
        ? getGithubRepositoryDetails(
            projectSource,
            matchedArtifacts,
            githubConnectorSources,
          )
        : null;
    const totalArtifactCount = matchedArtifacts.length;
    const runIds = Array.from(
      new Set(
        matchedArtifacts.flatMap((artifact) =>
          artifact.ingestionRunId ? [artifact.ingestionRunId] : [],
        ),
      ),
    );
    const sharesSourceSystem = (sourceCountBySystem.get(sourceSystem) ?? 1) > 1;
    const latestArtifactIngestedAt =
      getLatestArtifactIngestedAt(matchedArtifacts);
    const latestIngestedCount = totalArtifactCount;
    const latestUpdatedCount =
      latestRun?.updatedCount ?? status?.updatedCount ?? 0;
    const failedItems = latestRun?.failedItems ?? status?.failedItems ?? [];
    const errors =
      latestRun?.failedCount ?? status?.failedCount ?? failedItems.length;
    const lastRunAt =
      latestArtifactIngestedAt ??
      latestRun?.startedAt ??
      status?.lastRunTime ??
      null;
    const hasNeverSynced = lastRunAt === null;
    const runStatus = latestRun?.status ?? status?.status ?? null;
    const runtimeStatus = getSourceStatus(
      hasNeverSynced,
      errors > 0,
      runStatus,
    );
    const backendDerivedStatus = getSourceStatusFromBackend(backendStatus);

    return [
      {
        sourceId: projectSource.id,
        sourceSystem,
        name: projectSource.name,
        type: meta.type,
        icon: meta.icon,
        status: backendDerivedStatus,
        backendStatus,
        statusLabel: getBackendSourceStatusLabel(backendStatus),
        ingestionStatus: runtimeStatus,
        ingestionStatusLabel: getIngestionStatusLabel(
          hasNeverSynced,
          errors > 0,
          runStatus,
        ),
        artifacts: totalArtifactCount,
        lastSync: formatDateTime(lastRunAt),
        nextSync: "Not available",
        errors,
        description: meta.description,
        lastRunAt,
        latestIngestedCount,
        latestUpdatedCount,
        totalArtifactCount,
        runIds,
        sharesSourceSystem,
        failedItems,
        githubRepository,
      },
    ];
  });
}
function hasSourceId(sources: DataSource[], sourceId: string) {
  return sources.some((source) => source.sourceId === sourceId);
}

export function DataIngestionPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>("sources");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const [sourceStatuses, setSourceStatuses] = useState<SourceIngestionStatus[]>(
    [],
  );
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [projectArtifacts, setProjectArtifacts] = useState<Artifact[]>([]);
  const [projectArtifactTotal, setProjectArtifactTotal] = useState(0);
  const [artifactSnapshotVersion, setArtifactSnapshotVersion] = useState(0);
  const [artifactSummaryErrorMessage, setArtifactSummaryErrorMessage] =
    useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isSyncSettingsModalOpen, setIsSyncSettingsModalOpen] =
    useState(false);
  const [globalGithubSyncConfig, setGlobalGithubSyncConfig] =
    useState<ConfigureGithubRepositoryRequest>(
      DEFAULT_GLOBAL_GITHUB_SYNC_CONFIG,
    );
  const [selectedConnectSourceSystem, setSelectedConnectSourceSystem] =
    useState<SourceSystem>("GITHUB");

  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepositoryName, setGithubRepositoryName] = useState("");
  const [githubTokenName, setGithubTokenName] = useState("");
  const [githubTokenNames, setGithubTokenNames] = useState<string[]>([]);
  const [githubConnectorSources, setGithubConnectorSources] = useState<
    ConnectorSource[]
  >([]);

  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [connectErrorMessage, setConnectErrorMessage] = useState<string | null>(
    null,
  );
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

  const {
    projects,
    selectedProject,
    selectedProjectId,
    isLoading: isLoadingProjects,
    errorMessage: projectErrorMessage,
    setSelectedProjectId,
    reloadProjects,
  } = useProjectSelection();

  const requestedProjectId = searchParams.get("projectId") ?? "";
  const requestedSourceId = searchParams.get("sourceId") ?? "";

  useEffect(() => {
    if (!requestedProjectId || requestedProjectId === selectedProjectId) {
      return;
    }

    void Promise.resolve().then(() => {
      setSelectedProjectId(requestedProjectId);
    });
  }, [requestedProjectId, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      if (!selectedProjectId) {
        if (!isMounted) return;

        setProjectArtifacts([]);
        setProjectArtifactTotal(0);
        setArtifactSummaryErrorMessage(null);
        return;
      }

      if (!isMounted) return;
      setArtifactSummaryErrorMessage(null);

      try {
        const snapshot = await getProjectArtifactSnapshot(selectedProjectId);

        if (!isMounted) return;

        setProjectArtifacts(snapshot.artifacts);
        setProjectArtifactTotal(snapshot.totalElements);
      } catch (error) {
        if (!isMounted) return;

        setProjectArtifacts([]);
        setProjectArtifactTotal(0);
        setArtifactSummaryErrorMessage(
          error instanceof Error
            ? error.message
            : "Artifact summary could not be loaded.",
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [artifactSnapshotVersion, selectedProjectId]);

  const commitIngestionData = useCallback(
    (statusData: SourceIngestionStatus[], runData: IngestionRun[]) => {
      setSourceStatuses(statusData);
      setRuns(runData);
    },
    [],
  );

  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoadingState("loading");
      }
      setErrorMessage(null);

      try {
        const { statusData, runData } = await fetchIngestionData();

        commitIngestionData(statusData, runData);
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
    [commitIngestionData],
  );

  const loadGithubConnectorSources = useCallback(async () => {
    try {
      const response = await connectorService.getConnectorSources("github");
      setGithubConnectorSources(response.sources);
    } catch {
      setGithubConnectorSources([]);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadGithubConnectorSources());
  }, [loadGithubConnectorSources]);

  useEffect(() => {
    let isMounted = true;

    void fetchIngestionData()
      .then(({ statusData, runData }) => {
        if (!isMounted) return;

        commitIngestionData(statusData, runData);
        setLoadingState("success");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setLoadingState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load ingestion data",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [commitIngestionData]);

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

  const sources = useMemo<DataSource[]>(() => {
    return buildProjectDataSources(
      selectedProject?.sources ?? [],
      sourceStatuses,
      runs,
      projectArtifacts,
      githubConnectorSources,
    );
  }, [
    githubConnectorSources,
    projectArtifacts,
    runs,
    selectedProject?.sources,
    sourceStatuses,
  ]);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (!isMounted) return;

      const requestedSourceExists =
        requestedSourceId.length > 0 && hasSourceId(sources, requestedSourceId);

      if (requestedSourceExists) {
        setActiveTab("sources");
      }

      setSelectedSourceId((currentSourceId) => {
        if (requestedSourceExists) {
          return requestedSourceId;
        }

        return currentSourceId && hasSourceId(sources, currentSourceId)
          ? currentSourceId
          : null;
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
  const canManageGithubSyncSettings =
    profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  const visibleRuns = useMemo(
    () => runs.filter((run) => visibleSourceSystems.has(run.sourceSystem)),
    [runs, visibleSourceSystems],
  );

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

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);

      if (
        tab === "connectors" &&
        !hasLoadedConnectors &&
        connectorsLoadingState !== "loading"
      ) {
        void loadConnectors();
      }
    },
    [connectorsLoadingState, hasLoadedConnectors, loadConnectors],
  );

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

  const handleOpenSourceModal = () => {
    setConnectState("idle");
    setConnectErrorMessage(null);
    setSelectedConnectSourceSystem("GITHUB");
    setIsSourceModalOpen(true);

    void getGithubPatNames()
      .then((tokenNames) => {
        setGithubTokenNames(tokenNames);
        setGithubTokenName((currentTokenName) =>
          currentTokenName.trim() ? currentTokenName : (tokenNames[0] ?? ""),
        );
      })
      .catch(() => {
        setGithubTokenNames([]);
      });
  };

  const handleCloseSourceModal = () => {
    if (connectState === "loading") return;

    setIsSourceModalOpen(false);
    setConnectState("idle");
    setConnectErrorMessage(null);
  };

  const handleConnectSource = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setConnectState("loading");
      setConnectErrorMessage(null);
      setConnectSuccessMessage(null);

      try {
        if (!selectedProjectId) {
          throw new Error(
            "Please select a project before connecting a source.",
          );
        }

        if (selectedConnectSourceSystem !== "GITHUB") {
          throw new Error(
            `${SOURCE_META[selectedConnectSourceSystem].type} connection is not available yet.`,
          );
        }

        const parsedRepository = parseGithubRepositoryInput(
          githubOwner,
          githubRepositoryName,
        );

        if (!parsedRepository) {
          throw new Error(
            "Please enter a GitHub repository as owner/name, a GitHub URL, or owner and repository name.",
          );
        }

        const trimmedTokenName = githubTokenName.trim();

        if (!trimmedTokenName) {
          throw new Error("Please choose a saved GitHub access token.");
        }

        await connectGithubRepository({
          ...parsedRepository,
          tokenName: trimmedTokenName,
          projectId: selectedProjectId,
        });
        storeGithubRepository(parsedRepository);

        setConnectState("success");
        setConnectSuccessMessage(
          `GitHub repository "${parsedRepository.owner}/${parsedRepository.name}" connected to ${selectedProject?.name ?? "the selected project"}. Initial ingestion is running in the background.`,
        );
        setPollingUntil(Date.now() + 60000);

        setGithubOwner("");
        setGithubRepositoryName("");
        setIsSourceModalOpen(false);
        setActiveTab("sources");

        await Promise.all([
          loadData(),
          reloadProjects(),
          loadGithubConnectorSources(),
        ]);
        setArtifactSnapshotVersion((version) => version + 1);

        window.setTimeout(() => {
          void loadData(false);
          void reloadProjects();
          void loadGithubConnectorSources();
          setArtifactSnapshotVersion((version) => version + 1);
        }, 1500);
      } catch (error) {
        setConnectState("error");
        setConnectErrorMessage(
          error instanceof Error ? error.message : "Failed to connect source",
        );
      }
    },
    [
      githubOwner,
      githubRepositoryName,
      githubTokenName,
      loadData,
      loadGithubConnectorSources,
      reloadProjects,
      selectedConnectSourceSystem,
      selectedProject,
      selectedProjectId,
    ],
  );

  const handleUpdateSource = useCallback(
    async (source: DataSource) => {
      if (source.sourceSystem !== "GITHUB" || !source.githubRepository) {
        throw new Error(
          "Repository details are not available for this source.",
        );
      }

      await updateGithubRepository(source.githubRepository);

      setPollingUntil(Date.now() + 60000);
      setConnectSuccessMessage(
        `Update for ${source.githubRepository.fullName} started.`,
      );

      await Promise.all([loadData(false), loadGithubConnectorSources()]);
      setArtifactSnapshotVersion((version) => version + 1);

      window.setTimeout(() => {
        void loadData(false);
        void loadGithubConnectorSources();
        setArtifactSnapshotVersion((version) => version + 1);
      }, 1500);
    },
    [loadData, loadGithubConnectorSources],
  );

  const handleSaveGlobalGithubConfig = useCallback(
    async (request: ConfigureGithubRepositoryRequest) => {
      await configureAllGithubRepositories(request);
      setGlobalGithubSyncConfig(request);
      await Promise.all([
        loadData(false),
        reloadProjects(),
        loadGithubConnectorSources(),
      ]);
    },
    [loadData, loadGithubConnectorSources, reloadProjects],
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
      await Promise.all([
        loadData(false),
        reloadProjects(),
        loadGithubConnectorSources(),
      ]);
    },
    [loadData, loadGithubConnectorSources, reloadProjects],
  );

  const refreshSourceDetails = useCallback(async () => {
    await Promise.all([
      loadData(false),
      reloadProjects(),
      loadGithubConnectorSources(),
    ]);
    setArtifactSnapshotVersion((version) => version + 1);
  }, [loadData, loadGithubConnectorSources, reloadProjects]);

  const isLoading = loadingState === "loading" || isLoadingProjects;
  const shouldShowInitialLoading =
    isLoading && sources.every((source) => source.lastRunAt === null);

  const closeSourceDetails = () => {
    setSelectedSourceId(null);

    if (!searchParams.has("sourceId")) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("sourceId");
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-app-bg [scrollbar-gutter:stable] lg:h-screen">
      <div>
        <DataIngestionHeader
          isLoading={isLoading}
          projects={projects}
          selectedProjectId={selectedProjectId}
          isLoadingProjects={isLoadingProjects}
          projectErrorMessage={projectErrorMessage}
          onProjectChange={setSelectedProjectId}
          onRefresh={() => {
            void loadData();
            void reloadProjects();
            void loadGithubConnectorSources();
            if (activeTab === "connectors") {
              void loadConnectors();
            }
            setArtifactSnapshotVersion((version) => version + 1);
          }}
          showProjectSelect={profile?.permissionGroup === "ADMIN"}
        />

        <main className="app-page-shell">
          <div className="space-y-8">
            {errorMessage && (
              <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                {errorMessage}
              </div>
            )}

            {artifactSummaryErrorMessage && (
              <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                {artifactSummaryErrorMessage}
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

            <IngestionMetrics
              sources={sources}
              totalArtifactCount={projectArtifactTotal}
            />

            <section className="overflow-hidden rounded-3xl border border-app-border bg-app-surface">
              <DataIngestionTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onAddSource={handleOpenSourceModal}
                onOpenSyncSettings={
                  canManageGithubSyncSettings && hasGithubSources
                    ? () => setIsSyncSettingsModalOpen(true)
                    : undefined
                }
              />

              <div className="space-y-4 p-5 sm:p-6">
                {shouldShowInitialLoading ? (
                  <DataIngestionLoadingState />
                ) : null}

                {!isLoading && activeTab === "sources" ? (
                  <SourceList
                    sources={sources}
                    selectedSourceId={selectedSourceId}
                    onSelectSource={setSelectedSourceId}
                  />
                ) : null}

                {!isLoading && activeTab === "artifacts" ? (
                  <ArtifactTable
                    projectId={selectedProjectId}
                    sources={sources}
                  />
                ) : null}

                {!isLoading && activeTab === "runs" ? (
                  <RunHistory runs={visibleRuns} />
                ) : null}
                {activeTab === "connectors" ? (
                  <>
                    {connectorsErrorMessage && (
                      <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                        {connectorsErrorMessage}
                      </div>
                    )}

                    {connectorsLoadingState === "loading" &&
                    !hasLoadedConnectors ? (
                      <ConnectorsLoadingState />
                    ) : (
                      <ConnectorList
                        connectors={connectors}
                        togglingConnectorId={togglingConnectorId}
                        expandedConnectorId={selectedConnectorId}
                        onToggleEnabled={(connector) => {
                          void handleToggleConnectorEnabled(connector);
                        }}
                        onToggleSources={handleToggleConnectorSources}
                        onSourcesSaved={() => {
                          void loadConnectors();
                          void loadGithubConnectorSources();
                        }}
                      />
                    )}
                  </>
                ) : null}
              </div>
            </section>
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
          onClose={closeSourceDetails}
        />
      )}

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

      {isSourceModalOpen && (
        <SourceConnectModal
          selectedSourceSystem={selectedConnectSourceSystem}
          sourceSystems={SOURCE_SYSTEMS}
          sourceMeta={SOURCE_META}
          owner={githubOwner}
          repositoryName={githubRepositoryName}
          tokenName={githubTokenName}
          tokenNames={githubTokenNames}
          connectState={connectState}
          errorMessage={connectErrorMessage}
          onSourceSystemChange={(sourceSystem) => {
            setSelectedConnectSourceSystem(sourceSystem);
            setConnectState("idle");
            setConnectErrorMessage(null);
          }}
          onOwnerChange={setGithubOwner}
          onRepositoryNameChange={setGithubRepositoryName}
          onTokenNameChange={setGithubTokenName}
          onClose={handleCloseSourceModal}
          onSubmit={(event) => {
            void handleConnectSource(event);
          }}
        />
      )}
    </div>
  );
}
