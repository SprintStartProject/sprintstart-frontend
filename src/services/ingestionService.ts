import type {
  AiSyncStatus,
  Artifact,
  ArtifactPage,
  ArtifactType,
  ConnectionStatus,
  FailedArtifact,
  IngestionRun,
  IngestionRunFilter,
  IngestionRunPage,
  IngestionRunStatus,
  PageMetadata,
  SourceInstanceIngestionStatus,
  SourceSystem,
} from "../features/data-ingestion/types.ts";
import { apiClient } from "./apiClient.ts";

type CanonicalFailedArtifact = {
  sourceId: string | null;
  artifactType: ArtifactType;
  sourceUrl: string | null;
  reason: string;
};

type CanonicalIngestionRunResponse = {
  runId: string;
  sourceSystem: SourceSystem;
  sourceId?: string | null;
  owner?: string | null;
  name?: string | null;
  repositoryId?: string | null;
  startedAt: string;
  finishedAt: string | null;
  ingestedCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  failedCount?: number;
  failedItems?: CanonicalFailedArtifact[];
  status?: IngestionRunStatus | "SUCCESS" | null;
  failureReason?: string | null;
  aiSyncStatus?: AiSyncStatus | null;
  aiSyncFailureReason?: string | null;
};

type CanonicalIngestionRunPageResponse = {
  items?: CanonicalIngestionRunResponse[];
  page?: Partial<PageMetadata> | null;
};

type CanonicalSourceInstanceIngestionStatusResponse = {
  sourceSystem?: SourceSystem;
  sourceId: string;
  /** Human-readable name; GitHub "owner/name", Jira the instance display name. */
  displayName?: string | null;
  // GitHub-only identity; null for connector-neutral rows such as Jira, whose
  // stable key lives in `sourceId` (the instance URL) instead.
  repositoryId?: string | null;
  owner?: string | null;
  name?: string | null;
  sourceUrl: string;
  connectionStatus?: ConnectionStatus | null;
  enabled?: boolean;
  lastRunTime?: string | null;
  ingestedCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  failedCount?: number;
  failedItems?: CanonicalFailedArtifact[];
  artifactCount?: number;
  lastCommitsSyncAt?: string | null;
  lastIssuesSyncAt?: string | null;
  lastPullRequestsSyncAt?: string | null;
};

type GetProjectArtifactsOptions = {
  page?: number;
  size?: number;
  filter?: string;
};

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_ARTIFACT_PAGE_SIZE = 20;
const SNAPSHOT_ARTIFACT_PAGE_SIZE = 100;

function clampLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), MIN_LIMIT), MAX_LIMIT);
}

function clampPage(page: number) {
  return Math.max(Math.trunc(page), 1);
}

function mapFailedArtifact(item: CanonicalFailedArtifact): FailedArtifact {
  const sourceReference = item.sourceId ?? item.sourceUrl ?? "Unknown artifact";

  return {
    artifactIdentifier: `${item.artifactType}: ${sourceReference}`,
    reason: item.reason,
  };
}

function normalizeRunStatus(
  status: CanonicalIngestionRunResponse["status"],
): IngestionRunStatus | null {
  switch (status) {
    case "CONNECTED":
    case "RUNNING":
    case "COMPLETED":
    case "PARTIAL":
    case "FAILED":
      return status;
    case "SUCCESS":
      return "COMPLETED";
    default:
      return null;
  }
}

function inferRunStatus(run: CanonicalIngestionRunResponse): IngestionRunStatus {
  const normalizedStatus = normalizeRunStatus(run.status);

  if (normalizedStatus) return normalizedStatus;
  if (!run.finishedAt) return "RUNNING";

  const failedCount = run.failedCount ?? 0;
  const failedItemCount = run.failedItems?.length ?? 0;

  return failedCount > 0 || failedItemCount > 0 ? "FAILED" : "COMPLETED";
}

function normalizeAiSyncStatus(
  aiSyncStatus: CanonicalIngestionRunResponse["aiSyncStatus"],
): AiSyncStatus {
  switch (aiSyncStatus) {
    case "PENDING":
    case "SUCCEEDED":
    case "FAILED":
      return aiSyncStatus;
    default:
      // Missing on older/unmigrated backends -- fall back to "not applicable"
      // rather than showing a false "still indexing" state indefinitely.
      return "NOT_APPLICABLE";
  }
}

function mapIngestionRun(run: CanonicalIngestionRunResponse): IngestionRun {
  const failedItems = run.failedItems ?? [];

  return {
    runId: run.runId,
    sourceSystem: run.sourceSystem,
    sourceId: run.sourceId ?? null,
    owner: run.owner ?? null,
    name: run.name ?? null,
    repositoryId: run.repositoryId ?? null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    ingestedCount: run.ingestedCount ?? 0,
    updatedCount: run.updatedCount ?? 0,
    deletedCount: run.deletedCount ?? 0,
    failedCount: run.failedCount ?? failedItems.length,
    status: inferRunStatus(run),
    failedItems: failedItems.map(mapFailedArtifact),
    failureReason: run.failureReason ?? null,
    aiSyncStatus: normalizeAiSyncStatus(run.aiSyncStatus),
    aiSyncFailureReason: run.aiSyncFailureReason ?? null,
  };
}

function normalizeConnectionStatus(
  status: CanonicalSourceInstanceIngestionStatusResponse["connectionStatus"],
): ConnectionStatus {
  switch (status) {
    case "CONNECTED":
    case "UPDATING":
    case "OUT_OF_DATE":
    case "FAILED":
    case "DISABLED":
      return status;
    default:
      return "CONNECTED";
  }
}

function mapSourceInstanceStatus(
  status: CanonicalSourceInstanceIngestionStatusResponse,
): SourceInstanceIngestionStatus {
  const failedItems = (status.failedItems ?? []).map(mapFailedArtifact);

  return {
    // The backend now labels every row (GitHub and Jira); the fallback only
    // covers legacy rows that predate the field, never a mislabel of Jira.
    sourceSystem: status.sourceSystem ?? "GITHUB",
    sourceId: status.sourceId,
    displayName: status.displayName ?? status.sourceId,
    repositoryId: status.repositoryId ?? null,
    owner: status.owner ?? null,
    name: status.name ?? null,
    sourceUrl: status.sourceUrl,
    connectionStatus: normalizeConnectionStatus(status.connectionStatus),
    enabled: status.enabled ?? true,
    lastRunTime: status.lastRunTime ?? null,
    ingestedCount: status.ingestedCount ?? 0,
    updatedCount: status.updatedCount ?? 0,
    deletedCount: status.deletedCount ?? 0,
    failedCount: status.failedCount ?? failedItems.length,
    failedItems,
    artifactCount: status.artifactCount ?? 0,
    lastCommitsSyncAt: status.lastCommitsSyncAt ?? null,
    lastIssuesSyncAt: status.lastIssuesSyncAt ?? null,
    lastPullRequestsSyncAt: status.lastPullRequestsSyncAt ?? null,
  };
}

function mapRunPageMetadata(
  page: CanonicalIngestionRunPageResponse["page"],
  itemCount: number,
): PageMetadata {
  const number = page?.number ?? 1;
  const size = page?.size ?? Math.max(itemCount, 1);
  const totalElements = page?.totalElements ?? itemCount;
  const totalPages = page?.totalPages ?? (size > 0 ? Math.ceil(totalElements / size) : 1);

  return {
    number,
    size,
    totalElements,
    totalPages,
    hasNext: page?.hasNext ?? number < totalPages,
    hasPrevious: page?.hasPrevious ?? number > 1,
  };
}

function buildArtifactQuery({
  page = 1,
  size = DEFAULT_ARTIFACT_PAGE_SIZE,
  filter = "",
}: GetProjectArtifactsOptions) {
  const params = new URLSearchParams({
    page: String(clampPage(page)),
    size: String(clampLimit(size)),
  });

  const trimmedFilter = filter.trim();
  if (trimmedFilter) {
    params.set("filter", trimmedFilter);
  }

  return params.toString();
}

/**
 * Fetches the most recent ingestion runs.
 *
 * @param limit - Maximum number of ingestion runs to fetch. Must be between 1 and 100.
 * @returns A promise resolving to an array of IngestionRun objects.
 * @throws Error if the backend request fails.
 */
export async function getIngestionRuns(limit = 50): Promise<IngestionRun[]> {
  const safeLimit = clampLimit(limit);
  const data = await apiClient.fetch<CanonicalIngestionRunResponse[]>(
    `/api/v1/ingestion-runs?limit=${safeLimit}`,
  );

  return data.map(mapIngestionRun);
}

const DEFAULT_RUN_PAGE_SIZE = 20;
const MAX_RUN_PAGE_SIZE = 100;

function buildRunPageQuery(filter: IngestionRunFilter): string {
  const params = new URLSearchParams();

  params.set("page", String(clampPage(filter.page ?? 1)));
  params.set(
    "size",
    String(
      Math.min(
        Math.max(Math.trunc(filter.size ?? DEFAULT_RUN_PAGE_SIZE), MIN_LIMIT),
        MAX_RUN_PAGE_SIZE,
      ),
    ),
  );

  if (filter.sourceSystem) params.set("sourceSystem", filter.sourceSystem);
  if (filter.repositoryId) params.set("repositoryId", filter.repositoryId);
  if (filter.sourceRef) params.set("sourceRef", filter.sourceRef);
  if (filter.projectId) params.set("projectId", filter.projectId);
  if (filter.status) params.set("status", filter.status);
  if (filter.since) params.set("since", filter.since);

  return params.toString();
}

/**
 * Fetches a filtered, paginated page of ingestion runs. Unlike
 * {@link getIngestionRuns}, each run carries its repository identity and the
 * server applies the {@link IngestionRunFilter} (repo, project, status, since).
 *
 * @throws Error if the backend request fails.
 */
export async function getIngestionRunsPage(
  filter: IngestionRunFilter = {},
): Promise<IngestionRunPage> {
  const query = buildRunPageQuery(filter);
  const data = await apiClient.fetch<CanonicalIngestionRunPageResponse>(
    `/api/v1/ingestion-runs/page?${query}`,
  );

  const items = (data.items ?? []).map(mapIngestionRun);

  return {
    items,
    page: mapRunPageMetadata(data.page, items.length),
  };
}

/**
 * Fetches a single ingestion run by id, for the run drawer / deep links.
 *
 * @throws ApiError with status 404 when the run does not exist.
 */
export async function getIngestionRun(runId: string): Promise<IngestionRun> {
  const data = await apiClient.fetch<CanonicalIngestionRunResponse>(
    `/api/v1/ingestion-runs/${encodeURIComponent(runId)}`,
  );

  return mapIngestionRun(data);
}

/**
 * Fetches per-connected-repo ingestion status, optionally scoped to a project.
 * This is the authoritative source for the Data Ingestion source cards: one row
 * per repository with its identity, connection status, enabled flag, last-run
 * counters, total artifact count and per-artifact-type sync timestamps.
 *
 * @throws Error if the backend request fails.
 */
export async function getIngestionSourceStatuses(
  projectId?: string,
): Promise<SourceInstanceIngestionStatus[]> {
  const query = projectId ? `?${new URLSearchParams({ projectId }).toString()}` : "";
  const data = await apiClient.fetch<CanonicalSourceInstanceIngestionStatusResponse[]>(
    `/api/v1/ingestion-sources/status${query}`,
  );

  return data.map(mapSourceInstanceStatus);
}

export async function getProjectArtifacts(
  projectId: string,
  options: GetProjectArtifactsOptions = {},
): Promise<ArtifactPage> {
  const query = buildArtifactQuery(options);

  return apiClient.fetch<ArtifactPage>(`/api/v1/projects/${projectId}/artifacts?${query}`);
}

export async function getProjectArtifactSnapshot(
  projectId: string,
): Promise<{ artifacts: Artifact[]; totalElements: number }> {
  const firstPage = await getProjectArtifacts(projectId, {
    page: 1,
    size: SNAPSHOT_ARTIFACT_PAGE_SIZE,
  });

  const remainingPageNumbers = Array.from(
    { length: Math.max(firstPage.page.totalPages - 1, 0) },
    (_, index) => index + 2,
  );

  const remainingPages = await Promise.all(
    remainingPageNumbers.map((page) =>
      getProjectArtifacts(projectId, {
        page,
        size: SNAPSHOT_ARTIFACT_PAGE_SIZE,
      }),
    ),
  );

  return {
    artifacts: [...firstPage.items, ...remainingPages.flatMap((page) => page.items)],
    totalElements: firstPage.page.totalElements,
  };
}
