import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Database,
  FileText,
  GitBranch,
  History,
  Loader2,
} from "lucide-react";
import type {
  AiSyncStatus,
  BackendProjectSourceStatus,
  DataSource,
  IngestionRun,
  IngestionRunStatus,
  SourceInstanceIngestionStatus,
  SourceMeta,
  SourceStatus,
  SourceStatusPresentation,
  SourceSystem,
} from "./types.ts";

export const SOURCE_SYSTEMS: SourceSystem[] = ["GITHUB", "JIRA", "UPLOAD"];

export const SOURCE_META: Record<SourceSystem, SourceMeta> = {
  GITHUB: {
    name: "GitHub Repository",
    type: "GitHub",
    icon: GitBranch,
    description: "Indexes repositories, README files, pull requests, issues and source files.",
  },
  JIRA: {
    name: "Jira Project Board",
    type: "Jira",
    icon: Database,
    description: "Indexes Jira issues, tasks, epics, comments and project-related metadata.",
  },
  UPLOAD: {
    name: "Uploaded Documentation",
    type: "Upload",
    icon: FileText,
    description: "Indexes manually uploaded documentation, markdown files and project knowledge.",
  },
};

export const INGESTION_RUN_LIMIT = 50;
export const DETAILS_RUN_LIMIT = 10;

/**
 * Turns one per-repo ingestion status row (`/api/v1/ingestion-sources/status`)
 * into a {@link DataSource}. This is the shared mapping used wherever sources
 * are shown per repository rather than per source system — the Data Ingestion
 * page overlays the project source's own id and display name on top of it.
 */
export function createSourceFromInstance(instance: SourceInstanceIngestionStatus): DataSource {
  const meta = SOURCE_META[instance.sourceSystem];
  const backendStatus: BackendProjectSourceStatus =
    instance.enabled === false ? "DISABLED" : instance.connectionStatus;
  const hasErrors = instance.failedCount > 0;
  const hasNeverSynced = instance.lastRunTime === null;

  return {
    sourceId: instance.repositoryId,
    sourceSystem: instance.sourceSystem,
    name: instance.sourceId,
    type: meta.type,
    icon: meta.icon,
    status: getSourceStatusFromBackend(backendStatus),
    backendStatus,
    statusLabel: getBackendSourceStatusLabel(backendStatus),
    ingestionStatus: getSourceStatus(hasNeverSynced, hasErrors, null),
    ingestionStatusLabel: getSourceStatusLabel(hasNeverSynced, hasErrors, null),
    statusView: deriveSourceStatus({
      backendStatus,
      hasErrors,
      hasNeverSynced,
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
    sharesSourceSystem: false,
    failedItems: instance.failedItems,
    githubRepository: {
      owner: instance.owner,
      name: instance.name,
      repositoryId: instance.repositoryId,
      fullName: instance.sourceId,
      url: instance.sourceUrl,
      enabled: instance.enabled,
    },
    lastCommitsSyncAt: instance.lastCommitsSyncAt,
    lastIssuesSyncAt: instance.lastIssuesSyncAt,
    lastPullRequestsSyncAt: instance.lastPullRequestsSyncAt,
  };
}

export function getSourceStatus(
  hasNeverSynced: boolean,
  hasErrors: boolean,
  runStatus?: IngestionRunStatus | null,
): SourceStatus {
  if (hasNeverSynced) return "warning";
  if (isRunInProgress(runStatus)) return "running";
  if (runStatus === "FAILED" || runStatus === "PARTIAL") return "warning";
  if (hasErrors) return "warning";
  return "connected";
}

export function getSourceStatusFromBackend(
  backendStatus?: BackendProjectSourceStatus,
): SourceStatus {
  switch (backendStatus) {
    case "CONNECTED":
      return "connected";
    case "UPDATING":
    case "INDEXING":
      return "running";
    case "DISABLED":
      return "disabled";
    case "OUT_OF_DATE":
    case "FAILED":
    case "ERROR":
    case "DISCONNECTED":
    default:
      return "warning";
  }
}

type DeriveSourceStatusInput = {
  backendStatus?: BackendProjectSourceStatus;
  runStatus?: IngestionRunStatus | null;
  aiSyncStatus?: AiSyncStatus | null;
  hasErrors: boolean;
  hasNeverSynced: boolean;
  /**
   * Whether the source system's connector is globally enabled. `undefined` means
   * "unknown" (e.g. HR may not read the connector endpoint) and is treated as
   * enabled, so a permission gap never fakes a disabled source.
   */
  connectorEnabled?: boolean;
};

/**
 * Collapses the backend source status, the ingestion-run status and the AI-sync
 * status into the single {@link SourceStatusPresentation} the UI renders.
 *
 * This is the one place the three overlapping status concepts are reconciled, so
 * the list and the details drawer always agree and never show two competing
 * badges. Priority is deliberate: an explicitly disabled source wins over any
 * run state; an in-flight sync (backend UPDATING/INDEXING, a running run, or a
 * pending AI index) wins over "needs attention"; failures / out-of-date /
 * never-synced fall to `attention`; everything else is `connected`.
 */
export function deriveSourceStatus({
  backendStatus,
  runStatus,
  aiSyncStatus,
  hasErrors,
  hasNeverSynced,
  connectorEnabled,
}: DeriveSourceStatusInput): SourceStatusPresentation {
  if (backendStatus === "DISABLED") {
    return {
      state: "disabled",
      label: "Disabled",
      icon: CircleSlash,
      // Red, not grey: a disabled source silently stops feeding the knowledge
      // base, which is a problem state rather than a neutral one.
      tone: "danger",
      spinning: false,
    };
  }

  // Checked right after the source's own switch: the AI drops every chunk of a
  // disabled connector regardless of the per-source flag, so a source under a
  // disabled connector is not feeding chat either — saying "Connected" would be
  // a lie. Distinct label so it is clear the cause is global, not this source.
  if (connectorEnabled === false) {
    return {
      state: "disabled",
      label: "Connector disabled",
      icon: CircleSlash,
      tone: "danger",
      spinning: false,
    };
  }

  // "Syncing" must reflect work that is actually in flight. A finished run whose
  // AI-index status is still reported as PENDING (a stale/never-resolved value)
  // must NOT count as syncing, otherwise the source (and the "Syncing now" KPI)
  // reads as busy while nothing is running.
  const isSyncing =
    backendStatus === "UPDATING" || backendStatus === "INDEXING" || isRunInProgress(runStatus);

  if (isSyncing) {
    return {
      state: "syncing",
      label: backendStatus === "INDEXING" ? "Indexing" : "Syncing",
      icon: Loader2,
      tone: "brand",
      spinning: true,
    };
  }

  const needsAttention =
    hasNeverSynced ||
    hasErrors ||
    aiSyncStatus === "FAILED" ||
    runStatus === "FAILED" ||
    runStatus === "PARTIAL" ||
    backendStatus === "FAILED" ||
    backendStatus === "ERROR" ||
    backendStatus === "DISCONNECTED";

  if (needsAttention) {
    return {
      state: "attention",
      label: hasNeverSynced ? "Not synced" : "Needs attention",
      icon: AlertTriangle,
      // The danger palette keeps the label red on red; the warning palette pairs
      // an amber-yellow text with a red-looking background in dark mode.
      tone: "danger",
      spinning: false,
    };
  }

  // Checked after the failure cases so a repo that is both out of date *and*
  // failing still reads as failing.
  if (backendStatus === "OUT_OF_DATE") {
    return {
      state: "stale",
      label: "Out of date",
      icon: History,
      tone: "warning",
      spinning: false,
    };
  }

  return {
    state: "connected",
    label: "Connected",
    icon: CheckCircle2,
    tone: "success",
    spinning: false,
  };
}

export function getSourceStatusLabel(
  hasNeverSynced: boolean,
  hasErrors: boolean,
  runStatus?: IngestionRunStatus | null,
) {
  if (hasNeverSynced) return "Not synced";
  if (isRunInProgress(runStatus)) return "Running";
  if (runStatus === "FAILED") return "Failed";
  if (runStatus === "PARTIAL") return "Partial";
  if (hasErrors) return "Warning";
  if (runStatus === "COMPLETED") return "Synced";
  return "Connected";
}

export function getBackendSourceStatusLabel(backendStatus?: BackendProjectSourceStatus) {
  switch (backendStatus) {
    case "CONNECTED":
      return "Connected";
    case "UPDATING":
    case "INDEXING":
      return "Updating";
    case "OUT_OF_DATE":
      return "Out of date";
    case "DISABLED":
      return "Disabled";
    case "FAILED":
    case "ERROR":
      return "Failed";
    case "DISCONNECTED":
      return "Disconnected";
    default:
      return "Connected";
  }
}

export function getRunStatusLabel(status: IngestionRunStatus) {
  switch (status) {
    case "CONNECTED":
    case "RUNNING":
      return "Running";
    case "COMPLETED":
      return "Success";
    case "PARTIAL":
      return "Partial";
    case "FAILED":
      return "Failed";
  }
}

export function getRunStatusTone(status: IngestionRunStatus) {
  if (status === "COMPLETED") return "success";
  if (isRunInProgress(status)) return "running";
  return "warning";
}

export function isRunInProgress(status?: IngestionRunStatus | null) {
  return status === "CONNECTED" || status === "RUNNING";
}

/**
 * Label for a run's AI sync stage, distinct from its (local) run status --
 * a run can read "Success" above while this still reads "Indexing...".
 * Returns null for NOT_APPLICABLE so callers can hide the badge entirely.
 */
export function getAiSyncStatusLabel(status: AiSyncStatus) {
  switch (status) {
    case "PENDING":
      return "Indexing...";
    case "SUCCEEDED":
      return "Indexed";
    case "FAILED":
      return "Indexing failed";
    case "NOT_APPLICABLE":
      return null;
  }
}

export function getAiSyncStatusTone(status: AiSyncStatus) {
  if (status === "SUCCEEDED") return "success";
  if (status === "PENDING") return "running";
  return "warning";
}

export function getSourceLabel(sourceSystem: SourceSystem) {
  return SOURCE_META[sourceSystem].type;
}

/**
 * Maps each ingestion run to the connected source it produced artifacts for, so
 * run lists can show the repository (e.g. "sprintstart-frontend") instead of the
 * generic source-system label ("GitHub").
 *
 * The backend does not yet persist a source instance on a run (see
 * backend-ingestion-source-instance-issue.md), so the association is recovered
 * from the source's `runIds`, which are collected from the artifacts each run
 * ingested. Runs that produced no artifacts (empty/failed) won't be in the map
 * and fall back to the source-system label.
 */
export function buildRunSourceLabels(sources: DataSource[]): Map<string, string> {
  const labels = new Map<string, string>();

  sources.forEach((source) => {
    source.runIds.forEach((runId) => {
      if (!labels.has(runId)) {
        labels.set(runId, source.name);
      }
    });
  });

  return labels;
}

/**
 * Repository label for a run. Prefers the repository identity the backend now
 * persists on the run itself (`sourceId` = "owner/name"), falling back to the
 * artifact-derived {@link buildRunSourceLabels} map for legacy runs that predate
 * that field, and finally to the source-system label.
 */
export function getRunSourceLabel(run: IngestionRun, labelByRunId?: Map<string, string>) {
  return run.sourceId ?? labelByRunId?.get(run.runId) ?? getSourceLabel(run.sourceSystem);
}

export function formatDateTime(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRunFinishedAt(value: string | null, status: IngestionRunStatus) {
  if (value) return formatDateTime(value);
  if (isRunInProgress(status)) return "In progress";
  return "Not reported";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined).format(value);
}
