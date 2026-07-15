import type {
  AiSyncStatus,
  Artifact,
  ArtifactPage,
  ArtifactType,
  FailedArtifact,
  IngestionRun,
  IngestionRunStatus,
  SourceIngestionStatus,
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
  startedAt: string;
  finishedAt: string | null;
  ingestedCount?: number;
  updatedCount?: number;
  failedCount?: number;
  failedItems?: CanonicalFailedArtifact[];
  status?: IngestionRunStatus | "SUCCESS" | null;
  aiSyncStatus?: AiSyncStatus | null;
  aiSyncFailureReason?: string | null;
};

type CanonicalSourceIngestionStatusResponse = {
  sourceSystem: SourceSystem;
  lastRunTime: string | null;
  ingestedCount?: number;
  updatedCount?: number;
  failedCount?: number;
  failedItems?: CanonicalFailedArtifact[];
  status?: IngestionRunStatus | "SUCCESS" | null;
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

function inferRunStatus(
  run: CanonicalIngestionRunResponse,
): IngestionRunStatus {
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
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    ingestedCount: run.ingestedCount ?? 0,
    updatedCount: run.updatedCount ?? 0,
    failedCount: run.failedCount ?? failedItems.length,
    status: inferRunStatus(run),
    failedItems: failedItems.map(mapFailedArtifact),
    aiSyncStatus: normalizeAiSyncStatus(run.aiSyncStatus),
    aiSyncFailureReason: run.aiSyncFailureReason ?? null,
  };
}

function mapIngestionStatus(
  status: CanonicalSourceIngestionStatusResponse,
): SourceIngestionStatus {
  const failedItems = (status.failedItems ?? []).map(mapFailedArtifact);

  return {
    sourceSystem: status.sourceSystem,
    lastRunTime: status.lastRunTime,
    ingestedCount: status.ingestedCount ?? 0,
    updatedCount: status.updatedCount ?? 0,
    failedCount: status.failedCount ?? failedItems.length,
    status: normalizeRunStatus(status.status),
    failedItems,
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

/**
 * Fetches the latest ingestion status for all available source systems.
 *
 * @returns A promise resolving to an array of SourceIngestionStatus objects.
 * @throws Error if the backend request fails.
 */
export async function getIngestionStatus(): Promise<SourceIngestionStatus[]> {
  const data = await apiClient.fetch<CanonicalSourceIngestionStatusResponse[]>(
    "/api/v1/ingestion-status",
  );

  return data.map(mapIngestionStatus);
}

export async function getProjectArtifacts(
  projectId: string,
  options: GetProjectArtifactsOptions = {},
): Promise<ArtifactPage> {
  const query = buildArtifactQuery(options);

  return apiClient.fetch<ArtifactPage>(
    `/api/v1/projects/${projectId}/artifacts?${query}`,
  );
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
    artifacts: [
      ...firstPage.items,
      ...remainingPages.flatMap((page) => page.items),
    ],
    totalElements: firstPage.page.totalElements,
  };
}
