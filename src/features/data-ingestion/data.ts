import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  FileText,
  GitBranch,
  History,
  Loader2,
  Ticket,
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
import type { JiraInstanceDto } from "../../services/sources/jiraService.ts";

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
    icon: Ticket,
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
    // GitHub rows carry a repositoryId; fall back to the connector-neutral
    // sourceId so the card always has a stable selection key.
    sourceId: instance.repositoryId ?? instance.sourceId,
    sourceSystem: instance.sourceSystem,
    name: instance.displayName,
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
      owner: instance.owner ?? "",
      name: instance.name ?? "",
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

/**
 * Turns one Jira ingestion status row (`/api/v1/ingestion-sources/status`, the
 * connector-neutral rows where `sourceSystem === "JIRA"`) into a
 * {@link DataSource}, the Jira counterpart to {@link createSourceFromInstance}.
 *
 * The status row is now authoritative for health, counters, total artifact count
 * and last-sync time — exactly like GitHub — so no run stitch is needed. The
 * status endpoint carries no credential metadata, though, so the matching
 * {@link JiraInstanceDto} (looked up by instance URL) is merged in for the
 * credential shown in the details panel. `githubRepository` is always null;
 * identity lives in `jiraInstance`, keyed by the instance URL (`sourceId`).
 */
export function createJiraSourceFromInstance(
  status: SourceInstanceIngestionStatus,
  instance?: JiraInstanceDto | null,
  connectorEnabled?: boolean,
): DataSource {
  const meta = SOURCE_META.JIRA;
  const backendStatus: BackendProjectSourceStatus =
    status.enabled === false ? "DISABLED" : status.connectionStatus;
  const hasErrors = status.failedCount > 0;
  const hasNeverSynced = status.lastRunTime === null;

  return {
    sourceId: status.sourceId,
    sourceSystem: "JIRA",
    name: status.displayName,
    type: meta.type,
    icon: meta.icon,
    status: getSourceStatusFromBackend(backendStatus),
    backendStatus,
    statusLabel: getBackendSourceStatusLabel(backendStatus),
    ingestionStatus: getSourceStatus(hasNeverSynced, hasErrors, null),
    ingestionStatusLabel:
      !hasNeverSynced && !hasErrors
        ? "Synced"
        : getSourceStatusLabel(hasNeverSynced, hasErrors, null),
    statusView: deriveSourceStatus({
      backendStatus,
      hasErrors,
      hasNeverSynced,
      connectorEnabled,
    }),
    artifacts: status.artifactCount,
    lastSync: formatDateTime(status.lastRunTime),
    nextSync: "Not available",
    errors: status.failedCount,
    description: meta.description,
    lastRunAt: status.lastRunTime,
    latestIngestedCount: status.ingestedCount,
    latestUpdatedCount: status.updatedCount,
    deletedCount: status.deletedCount,
    totalArtifactCount: status.artifactCount,
    runIds: [],
    sharesSourceSystem: false,
    failedItems: status.failedItems,
    githubRepository: null,
    jiraInstance: {
      instanceUrl: status.sourceId,
      // Prefer the instance DTO's display name/credential; the status row still
      // provides a display name, but only the DTO knows the credential pair.
      displayName: instance?.displayName ?? status.displayName,
      credentialName: instance?.updateCredentialName ?? "",
      credentialUserEmail: instance?.updateCredentialUserEmail ?? "",
    },
    lastCommitsSyncAt: null,
    // Jira's per-type sync timestamp; the backend maps it to the last update.
    lastIssuesSyncAt: status.lastIssuesSyncAt,
    lastPullRequestsSyncAt: null,
  };
}

/**
 * Maps an UPLOAD status row from `/api/v1/ingestion-sources/status` into the
 * full {@link DataSource} model rendered on the ingestion page.
 */
export function createUploadSourceFromInstance(status: SourceInstanceIngestionStatus): DataSource {
  const meta = SOURCE_META.UPLOAD;
  const backendStatus: BackendProjectSourceStatus =
    status.enabled === false ? "DISABLED" : status.connectionStatus;
  const hasErrors = status.failedCount > 0;
  const hasNeverSynced = status.lastRunTime === null;

  return {
    sourceId: status.sourceId,
    sourceSystem: "UPLOAD",
    name: status.displayName,
    type: meta.type,
    icon: meta.icon,
    status: getSourceStatusFromBackend(backendStatus),
    backendStatus,
    statusLabel: getBackendSourceStatusLabel(backendStatus),
    ingestionStatus: getSourceStatus(hasNeverSynced, hasErrors, null),
    ingestionStatusLabel:
      !hasNeverSynced && !hasErrors
        ? "Synced"
        : getSourceStatusLabel(hasNeverSynced, hasErrors, null),
    statusView: deriveSourceStatus({
      backendStatus,
      hasErrors,
      hasNeverSynced,
      connectorEnabled: true,
    }),
    artifacts: status.artifactCount,
    lastSync: formatDateTime(status.lastRunTime),
    nextSync: "Not available",
    errors: status.failedCount,
    description: meta.description,
    lastRunAt: status.lastRunTime,
    latestIngestedCount: status.ingestedCount,
    latestUpdatedCount: status.updatedCount,
    deletedCount: status.deletedCount,
    totalArtifactCount: status.artifactCount,
    runIds: [],
    sharesSourceSystem: false,
    failedItems: status.failedItems,
    githubRepository: null,
    jiraInstance: null,
    lastCommitsSyncAt: null,
    lastIssuesSyncAt: null,
    lastPullRequestsSyncAt: null,
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

/**
 * Splits a source's merged {@link deriveSourceStatus} presentation into the two
 * badges every source card and details drawer shows: a connection badge and a
 * sync-status badge. Splitting here (rather than per connector) keeps GitHub and
 * Jira identical — both always show "Connected/Disabled" next to the live sync
 * status — instead of one collapsing to a single "Syncing" chip.
 *
 * The connection badge answers "is this source linked and enabled?". Only a
 * disabled source (or one under a disabled connector) reads as not-connected;
 * syncing, out-of-date and needs-attention are all still connected states.
 */
export function deriveConnectionStatus(source: DataSource): SourceStatusPresentation {
  if (source.statusView.state === "disabled") {
    return source.statusView;
  }

  return {
    state: "connected",
    label: "Connected",
    icon: CheckCircle2,
    tone: "success",
    spinning: false,
  };
}

/**
 * The sync-status half of the badge pair (see {@link deriveConnectionStatus}):
 * the live ingestion activity and freshness, keeping the spinner while a sync is
 * in flight. Syncing, out-of-date and attention already describe the sync, so
 * they pass through; the connection states (connected/disabled) collapse to the
 * freshness the source last reached — "Synced" once it has run, else "Not synced".
 */
export function deriveSyncStatus(source: DataSource): SourceStatusPresentation {
  const view = source.statusView;

  if (view.state === "syncing" || view.state === "stale" || view.state === "attention") {
    return view;
  }

  return source.lastRunAt !== null
    ? {
        state: "connected",
        label: "Synced",
        icon: CheckCircle2,
        tone: "success",
        spinning: false,
      }
    : {
        state: "attention",
        label: "Not synced",
        icon: AlertTriangle,
        tone: "danger",
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
 * The host of a Jira instance URL without the scheme, e.g.
 * `"acme.atlassian.net"` for `"https://acme.atlassian.net"`. Falls back to
 * stripping the scheme/trailing slash by hand if the value is not a valid URL.
 */
export function formatJiraInstanceDomain(instanceUrl: string): string {
  try {
    return new URL(instanceUrl).host;
  } catch {
    return instanceUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
}

/**
 * Maps a run's source reference (the run's `sourceId`) to the connected source's
 * friendly display name, so run lists can show that name instead of the raw
 * reference — most visibly for Jira, whose `sourceId` is the instance URL.
 *
 * Keyed by the same value the run carries in `sourceId`: GitHub `"owner/name"`
 * (the repository's full name) and Jira the instance URL. Runs whose source is
 * no longer connected won't be in the map and fall back to the raw reference.
 */
export function buildRunSourceLabels(sources: DataSource[]): Map<string, string> {
  const labels = new Map<string, string>();

  sources.forEach((source) => {
    const ref = source.jiraInstance?.instanceUrl ?? source.githubRepository?.fullName;
    if (ref && !labels.has(ref)) {
      labels.set(ref, source.name);
    }
  });

  return labels;
}

/**
 * Display label for a run. Prefers the connected source's friendly display name
 * (resolved from the run's `sourceId` via {@link buildRunSourceLabels}), falling
 * back to the raw `sourceId` the backend persists on the run, and finally to the
 * source-system label for uploads and legacy runs that carry no `sourceId`.
 */
export function getRunSourceLabel(run: IngestionRun, labelBySourceRef?: Map<string, string>) {
  if (run.sourceId) {
    return labelBySourceRef?.get(run.sourceId) ?? run.sourceId;
  }

  return getSourceLabel(run.sourceSystem);
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
