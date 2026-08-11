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

export type IngestionRunStatus = "CONNECTED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

/**
 * The connection health a per-repo ingestion source reports (endpoint
 * `/api/v1/ingestion-sources/status`). A narrower, source-instance-scoped set
 * than {@link BackendProjectSourceStatus}; every value here is also a member of
 * that broader union, so it flows through the same status-derivation helpers.
 */
export type ConnectionStatus = "CONNECTED" | "UPDATING" | "OUT_OF_DATE" | "FAILED" | "DISABLED";

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

/**
 * Standard page envelope metadata returned by the backend's paginated
 * endpoints (`{ items, page }`). Shared by artifacts and the paginated
 * ingestion-run history so both agree on the shape.
 */
export type PageMetadata = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ArtifactPageMetadata = PageMetadata;

export type ArtifactPage = {
  items: Artifact[];
  page: ArtifactPageMetadata;
};

export type IngestionRun = {
  runId: string;
  sourceSystem: SourceSystem;
  /** `"owner/name"` for GitHub runs; null for uploads and legacy runs. */
  sourceId: string | null;
  owner: string | null;
  name: string | null;
  repositoryId: string | null;
  startedAt: string;
  finishedAt: string | null;
  ingestedCount: number;
  updatedCount: number;
  deletedCount: number;
  failedCount: number;
  status: IngestionRunStatus;
  failedItems: FailedArtifact[];
  /** Run-level failure reason, distinct from per-item failures. */
  failureReason: string | null;
  aiSyncStatus: AiSyncStatus;
  aiSyncFailureReason: string | null;
};

/**
 * Per-repo ingestion health from `/api/v1/ingestion-sources/status` — one row
 * per connected GitHub repository. This is the authoritative source for the
 * Data Ingestion source cards: it carries the repository identity, connection
 * status, enabled flag, the last run's counters, the total stored artifact
 * count and the per-artifact-type last-sync timestamps in a single call, so the
 * UI no longer has to reconstruct any of it from artifact metadata.
 */
export type SourceInstanceIngestionStatus = {
  sourceSystem: SourceSystem;
  /**
   * Stable, connector-neutral key: GitHub `"owner/name"`, Jira the instance URL.
   */
  sourceId: string;
  /** Display name: GitHub `"owner/name"`, Jira the instance's display name. */
  displayName: string;
  /**
   * GitHub-only repository identity. Null for connector-neutral rows such as
   * Jira, which are identified by {@link sourceId} (the instance URL) instead.
   */
  repositoryId: string | null;
  owner: string | null;
  name: string | null;
  sourceUrl: string;
  /**
   * Connection health of the repo. Deliberately NOT called `status`: an
   * ingestion run also has a `status`, with a different vocabulary, and the two
   * were easy to confuse. Mirrors the backend's `connectionStatus` field.
   */
  connectionStatus: ConnectionStatus;
  enabled: boolean;
  lastRunTime: string | null;
  /** Counters of the LATEST run for this repo. */
  ingestedCount: number;
  updatedCount: number;
  deletedCount: number;
  failedCount: number;
  failedItems: FailedArtifact[];
  /** Total artifacts currently stored for the repo (not just the last run). */
  artifactCount: number;
  lastCommitsSyncAt: string | null;
  lastIssuesSyncAt: string | null;
  lastPullRequestsSyncAt: string | null;
};

/** A page of ingestion runs from `/api/v1/ingestion-runs/page`. */
export type IngestionRunPage = {
  items: IngestionRun[];
  page: PageMetadata;
};

/**
 * Filters for the paginated run-history endpoint. All optional and AND-combined
 * server-side; `projectId` is resolved to that project's connected repos.
 */
export type IngestionRunFilter = {
  page?: number;
  size?: number;
  sourceSystem?: SourceSystem;
  /** GitHub repository UUID; matches runs of that repository. */
  repositoryId?: string;
  /**
   * Connector-neutral source-instance reference (the run's `sourceInstanceRef`).
   * For Jira this is the instance URL, letting the history be scoped to a single
   * Jira instance the way `repositoryId` scopes it to a GitHub repository.
   */
  sourceRef?: string;
  projectId?: string;
  status?: IngestionRunStatus;
  /** ISO datetime; inclusive lower bound on `startedAt`. */
  since?: string;
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

/**
 * Jira-specific identity for a source card, mirroring
 * {@link GithubRepositoryDetails} for the Jira connector. A connected Jira
 * instance is identified by its URL (its primary key); the credential is the
 * `(credentialUserEmail, credentialName)` pair used to authenticate.
 */
export type JiraInstanceSourceDetails = {
  instanceUrl: string;
  displayName: string;
  credentialName: string;
  credentialUserEmail: string;
};

export type ActiveTab = "sources" | "artifacts" | "runs" | "connectors";

/**
 * The section the overview-first Data Ingestion page is filtered to. `overview`
 * is the dashboard view and shows everything (overview + sources + runs); the
 * other two narrow to a single section.
 */
export type SectionKey = "overview" | "sources" | "runs";

/**
 * Left-to-right order of the section filter. Single source of truth: the filter
 * renders in this order and the page derives the slide direction from it, so
 * the content always travels the same way the active pill does.
 */
export const SECTION_ORDER: SectionKey[] = ["overview", "sources", "runs"];

export type LoadingState = "idle" | "loading" | "success" | "error";

export type ConnectState = "idle" | "loading" | "success" | "error";

export type SourceStatus = "connected" | "running" | "warning" | "disabled";

/**
 * The single, user-facing status a source is collapsed to. The backend exposes
 * three overlapping status concepts (backend source status, ingestion-run status
 * and AI-sync status); {@link SourceStatusView} unifies them into one so the UI
 * never shows two competing badges for the same source.
 */
export type SourceStatusView =
  | "connected"
  | "syncing"
  /**
   * Connected and healthy, but the backend has flagged newer upstream changes
   * that have not been pulled yet. Deliberately separate from `attention`:
   * with auto-update off this is the *expected* state between syncs, so it must
   * not read as a failure.
   */
  | "stale"
  | "attention"
  | "disabled";

/** Presentation payload for a {@link SourceStatusView}: what to render. */
export type SourceStatusPresentation = {
  state: SourceStatusView;
  label: string;
  icon: LucideIcon;
  tone: "success" | "brand" | "warning" | "danger" | "neutral";
  /** True while `state === "syncing"`, so callers can spin the icon. */
  spinning: boolean;
};

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
  failedItems?: FailedArtifact[];
  githubRepository?: GithubRepositoryDetails | null;
  /** Jira instance identity; null/absent for non-Jira sources. */
  jiraInstance?: JiraInstanceSourceDetails | null;
  description?: string;
  nextSync?: string;
};

export type DataSource = SourceDetailsSource & {
  icon: LucideIcon;
  statusLabel: string;
  ingestionStatus: SourceStatus;
  ingestionStatusLabel: string;
  /** The single unified status shown in the list and details drawer. */
  statusView: SourceStatusPresentation;
  lastRunAt: string | null;
  latestIngestedCount: number;
  latestUpdatedCount: number;
  /** Artifacts removed by the latest run (from the per-repo status endpoint). */
  deletedCount: number;
  totalArtifactCount: number;
  runIds: string[];
  sharesSourceSystem: boolean;
  failedItems: FailedArtifact[];
  githubRepository: GithubRepositoryDetails | null;
  /** Per-artifact-type last-sync timestamps (GitHub, from endpoint #5). */
  lastCommitsSyncAt: string | null;
  lastIssuesSyncAt: string | null;
  lastPullRequestsSyncAt: string | null;
};

export type SourceConnectMeta = SourceMeta;
