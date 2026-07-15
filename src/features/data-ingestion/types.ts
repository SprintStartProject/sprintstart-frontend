import type { LucideIcon } from "lucide-react";

export type SourceSystem = "GITHUB" | "JIRA" | "UPLOAD";

export type BackendProjectSourceStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "UPDATING"
  | "OUT_OF_DATE"
  | "DISABLED"
  | "FAILED"
  | "INDEXING"
  | "ERROR"
  | (string & {});

export type IngestionRunStatus =
  | "CONNECTED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

/**
 * Whether a run's artifacts have actually reached the AI service's index, separate
 * from `IngestionRunStatus`. A run can show COMPLETED (fetched and saved locally)
 * while this is still PENDING or has moved to FAILED -- that gap is why this exists.
 */
export type AiSyncStatus = "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED";

export type ArtifactType = "COMMIT" | "FILE" | "ISSUE" | "PULL_REQUEST";

export type Artifact = {
  id: string;
  title: string | null;
  sourceSystem: SourceSystem;
  sourceUrl: string | null;
  artifactType: ArtifactType;
  ingestedAt: string;
  metadata: string;
  ingestionRunId?: string | null;
};

export type ArtifactPageMetadata = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ArtifactPage = {
  items: Artifact[];
  page: ArtifactPageMetadata;
};

export type IngestionRun = {
  runId: string;
  sourceSystem: SourceSystem;
  startedAt: string;
  finishedAt: string | null;
  ingestedCount: number;
  updatedCount: number;
  failedCount: number;
  status: IngestionRunStatus;
  failedItems: FailedArtifact[];
  aiSyncStatus: AiSyncStatus;
  aiSyncFailureReason: string | null;
};

export type FailedArtifact = {
  artifactIdentifier: string;
  reason: string;
};

export type GithubRepositoryReference = {
  owner: string;
  name: string;
};

export type GithubRepositoryDetails = GithubRepositoryReference & {
  repositoryId: string | null;
  fullName: string;
  url: string;
  enabled: boolean | null;
};

export type SourceIngestionStatus = {
  sourceSystem: SourceSystem;
  lastRunTime: string | null;
  ingestedCount: number;
  updatedCount: number;
  failedCount: number;
  status: IngestionRunStatus | null;
  failedItems: FailedArtifact[];
};

export type ActiveTab = "sources" | "artifacts" | "runs" | "connectors";

export type LoadingState = "idle" | "loading" | "success" | "error";

export type ConnectState = "idle" | "loading" | "success" | "error";

export type SourceStatus = "connected" | "running" | "warning" | "disabled";

export type SourceMeta = {
  name: string;
  type: string;
  icon: LucideIcon;
  description: string;
};

export type SourceDetailsSource = {
  sourceId: string;
  sourceSystem: SourceSystem;
  name: string;
  type: string;
  status: SourceStatus;
  backendStatus?: BackendProjectSourceStatus;
  artifacts: number;
  lastSync: string;
  errors: number;
  latestIngestedCount?: number;
  latestUpdatedCount?: number;
  totalArtifactCount?: number;
  runIds?: string[];
  sharesSourceSystem?: boolean;
  failedItems?: SourceIngestionStatus["failedItems"];
  githubRepository?: GithubRepositoryDetails | null;
  description?: string;
  nextSync?: string;
};

export type DataSource = SourceDetailsSource & {
  icon: LucideIcon;
  statusLabel: string;
  ingestionStatus: SourceStatus;
  ingestionStatusLabel: string;
  lastRunAt: string | null;
  latestIngestedCount: number;
  latestUpdatedCount: number;
  totalArtifactCount: number;
  runIds: string[];
  sharesSourceSystem: boolean;
  failedItems: SourceIngestionStatus["failedItems"];
  githubRepository: GithubRepositoryDetails | null;
};

export type SourceConnectMeta = SourceMeta;
