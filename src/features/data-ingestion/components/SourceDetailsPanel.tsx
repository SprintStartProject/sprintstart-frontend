import {
  ArrowUp,
  Clock3,
  Database,
  GitBranch,
  RefreshCw,
  Unlink,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle.tsx";
import type {
  ConfigureGithubRepositoryRequest,
  GithubRepositoryConfig,
} from "../../../services/sources/githubService.ts";
import type {
  ConfigureJiraInstanceRequest,
  GetJiraInstanceConfigResponse,
} from "../../../services/sources/jiraService.ts";
import {
  deriveConnectionStatus,
  deriveSyncStatus,
  formatDateTime,
  formatNumber,
  SOURCE_META,
} from "../data.ts";
import type { DataSource, LoadingState } from "../types.ts";
import { GithubRepositorySyncSettings } from "./GithubRepositorySyncSettings.tsx";
import { SourceStatusChip } from "./SourceStatusChip.tsx";
import { SourceTypeBadge } from "./SourceTypeBadge.tsx";

type SourceDetailsPanelProps = {
  source: DataSource;
  onUpdateSource?: (source: DataSource) => Promise<void>;
  onRefreshDetails?: () => Promise<void>;
  canManageSyncSettings?: boolean;
  onLoadRepositoryConfig?: (
    repository: NonNullable<DataSource["githubRepository"]>,
  ) => Promise<GithubRepositoryConfig>;
  onSaveRepositoryConfig?: (
    repository: NonNullable<DataSource["githubRepository"]>,
    request: ConfigureGithubRepositoryRequest,
  ) => Promise<void>;
  /** Loads the sync schedule of a Jira instance (by URL) for the schedule form. */
  onLoadJiraConfig?: (instanceUrl: string) => Promise<GetJiraInstanceConfigResponse>;
  /** Saves the sync schedule of a Jira instance (by URL). */
  onSaveJiraConfig?: (
    instanceUrl: string,
    request: Omit<ConfigureJiraInstanceRequest, "instanceUrl">,
  ) => Promise<void>;
  /** Enables/disables the source in the connector (allow/deny for ingestion). */
  onSetSourceEnabled?: (
    repository: NonNullable<DataSource["githubRepository"]>,
    enabled: boolean,
  ) => Promise<void>;
  /** Enables/disables a Jira instance as an ingestion source (by instance URL). */
  onSetJiraSourceEnabled?: (instanceUrl: string, enabled: boolean) => Promise<void>;
  /**
   * Removes the repository's link to the current project. Only passed when the
   * caller is allowed to manage the project's sources; its presence gates the
   * "Remove from project" action. The caller closes this drawer on success.
   */
  onUnlinkSource?: (source: DataSource) => Promise<void>;
  onClose: () => void;
};

/**
 * Slide-out panel showing the repository and ingestion details currently exposed by the backend.
 */
export function SourceDetailsPanel({
  source,
  onUpdateSource,
  onRefreshDetails,
  canManageSyncSettings = false,
  onLoadRepositoryConfig,
  onSaveRepositoryConfig,
  onLoadJiraConfig,
  onSaveJiraConfig,
  onSetSourceEnabled,
  onSetJiraSourceEnabled,
  onUnlinkSource,
  onClose,
}: SourceDetailsPanelProps) {
  const [updateState, setUpdateState] = useState<LoadingState>("idle");
  const [refreshState, setRefreshState] = useState<LoadingState>("idle");
  const [enabledState, setEnabledState] = useState<LoadingState>("idle");
  const [unlinkState, setUnlinkState] = useState<LoadingState>("idle");
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const Icon = SOURCE_META[source.sourceSystem].icon;
  const repository = source.githubRepository;
  const jira = source.jiraInstance ?? null;
  const isJira = source.sourceSystem === "JIRA";
  const isUpdating = updateState === "loading";
  const isRefreshing = refreshState === "loading";
  // Update is available for a GitHub repo (needs owner/name) or a Jira instance
  // (needs its URL); enable/disable and unlink stay GitHub-only for now.
  const canUpdate =
    onUpdateSource !== undefined &&
    ((source.sourceSystem === "GITHUB" && repository !== null) || (isJira && jira !== null));
  const canManageRepositoryConfig =
    canManageSyncSettings &&
    source.sourceSystem === "GITHUB" &&
    repository !== null &&
    onLoadRepositoryConfig !== undefined &&
    onSaveRepositoryConfig !== undefined;
  const canManageJiraConfig =
    canManageSyncSettings &&
    isJira &&
    jira !== null &&
    onLoadJiraConfig !== undefined &&
    onSaveJiraConfig !== undefined;
  const canToggleEnabled =
    canManageSyncSettings &&
    source.sourceSystem === "GITHUB" &&
    repository !== null &&
    onSetSourceEnabled !== undefined;
  const canToggleJiraEnabled =
    canManageSyncSettings && isJira && jira !== null && onSetJiraSourceEnabled !== undefined;
  // Jira has no per-source `enabled` field on the card; a disabled instance is
  // exactly the one the status endpoint collapses to DISABLED.
  const jiraEnabled = source.backendStatus !== "DISABLED";
  const isTogglingEnabled = enabledState === "loading";
  // Authorization is presence-based — the parent only passes onUnlinkSource when
  // the caller may manage the project's sources. GitHub needs the connection's
  // repositoryId; Jira is identified by its instance URL.
  const canUnlinkSource =
    onUnlinkSource !== undefined &&
    ((source.sourceSystem === "GITHUB" &&
      repository !== null &&
      repository.repositoryId !== null) ||
      (isJira && jira !== null));
  const isUnlinking = unlinkState === "loading";
  // Noun for the unlink copy: GitHub sources are repositories, Jira sources are
  // instances. Keeps each connector's wording accurate.
  const removableNoun = isJira ? "instance" : "repository";
  // GitHub exposes one timestamp per resource type; Jira refreshes issue data
  // (including comments and change history) as one combined resource.
  const hasResourceSyncTimes =
    source.lastCommitsSyncAt !== null ||
    source.lastIssuesSyncAt !== null ||
    source.lastPullRequestsSyncAt !== null;

  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
      if (!repository || !onSetSourceEnabled) return;

      setEnabledState("loading");
      setMessage(null);
      setErrorMessage(null);

      try {
        await onSetSourceEnabled(repository, enabled);
        setEnabledState("success");
        setMessage(
          enabled
            ? "Source enabled. It is included in ingestion again."
            : "Source disabled. It is excluded from ingestion.",
        );
      } catch (error) {
        setEnabledState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to update the source.");
      }
    },
    [onSetSourceEnabled, repository],
  );

  const handleToggleJiraEnabled = useCallback(
    async (enabled: boolean) => {
      if (!jira || !onSetJiraSourceEnabled) return;

      setEnabledState("loading");
      setMessage(null);
      setErrorMessage(null);

      try {
        await onSetJiraSourceEnabled(jira.instanceUrl, enabled);
        setEnabledState("success");
        setMessage(
          enabled
            ? "Source enabled. It is included in ingestion again."
            : "Source disabled. It is excluded from ingestion.",
        );
      } catch (error) {
        setEnabledState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to update the source.");
      }
    },
    [jira, onSetJiraSourceEnabled],
  );

  const loadRepositoryConfig = useCallback(async () => {
    if (!canManageRepositoryConfig || !repository || !onLoadRepositoryConfig) {
      throw new Error("Repository sync config is not available.");
    }

    return onLoadRepositoryConfig(repository);
  }, [canManageRepositoryConfig, onLoadRepositoryConfig, repository]);

  const saveRepositoryConfig = useCallback(
    async (request: ConfigureGithubRepositoryRequest) => {
      if (!canManageRepositoryConfig || !repository || !onSaveRepositoryConfig) {
        throw new Error("Repository sync config is not available.");
      }

      await onSaveRepositoryConfig(repository, request);
    },
    [canManageRepositoryConfig, onSaveRepositoryConfig, repository],
  );

  const handleUpdateSource = useCallback(async () => {
    if (!canUpdate || !onUpdateSource) return;

    setUpdateState("loading");
    setMessage(null);
    setErrorMessage(null);

    try {
      await onUpdateSource(source);
      setUpdateState("success");
      setMessage("Update started. Details will refresh while ingestion runs.");
    } catch (error) {
      setUpdateState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to start the update");
    }
  }, [canUpdate, onUpdateSource, source]);

  const handleConfirmUnlink = useCallback(async () => {
    if (!onUnlinkSource) return;

    setUnlinkState("loading");
    setUnlinkError(null);

    try {
      await onUnlinkSource(source);
      // The parent closes this drawer on success, so there is nothing to reset
      // here — the component unmounts.
    } catch (error) {
      setUnlinkState("error");
      setUnlinkError(
        error instanceof Error ? error.message : "Failed to remove the source from the project.",
      );
    }
  }, [onUnlinkSource, source]);

  const handleRefreshDetails = useCallback(async () => {
    if (!onRefreshDetails) return;

    setRefreshState("loading");
    setMessage(null);
    setErrorMessage(null);

    try {
      await onRefreshDetails();
      setRefreshState("success");
      setMessage("Repository details refreshed.");
    } catch (error) {
      setRefreshState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to refresh repository details",
      );
    }
  }, [onRefreshDetails]);

  const details = useMemo(() => {
    const artifactCount = source.totalArtifactCount ?? source.artifacts;
    const hasSourceArtifactTimestamp = artifactCount > 0 && source.lastRunAt;
    const lastSync = hasSourceArtifactTimestamp
      ? formatDateTime(source.lastRunAt)
      : source.sharesSourceSystem
        ? "Not available"
        : source.lastSync;

    return {
      artifactCount,
      lastSync,
      latestUpdatedCount: source.latestUpdatedCount,
      errors: source.errors,
      runIds: source.runIds,
    };
  }, [source]);

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      title={source.name}
      closeAriaLabel="Close source details"
      zIndexClassName="z-50"
      showOverlay
      leading={
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-text-muted">
          <Icon className="h-6 w-6" />
        </div>
      }
      badge={
        <>
          <SourceTypeBadge type={source.type} />
          {/* Two badges, identical for every connector: whether the source is
              connected/enabled, and its live sync status (spinner while syncing). */}
          <SourceStatusChip status={deriveConnectionStatus(source)} />
          <SourceStatusChip status={deriveSyncStatus(source)} />
        </>
      }
      footer={
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            onClick={() => {
              void handleUpdateSource();
            }}
            disabled={!canUpdate || isRefreshing}
            loading={isUpdating}
            icon={isJira ? <Database className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
            title={
              canUpdate
                ? undefined
                : isJira
                  ? "Instance updates need the Jira instance URL."
                  : "Repository updates need GitHub owner and repository name."
            }
          >
            {isJira ? "Update instance" : "Update repo"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              void handleRefreshDetails();
            }}
            disabled={!onRefreshDetails || isUpdating}
            loading={isRefreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh details
          </Button>
        </div>
      }
    >
      {message && <Message tone="success">{message}</Message>}

      {errorMessage && <Message tone="warning">{errorMessage}</Message>}

      <Section title="Ingestion">
        {source.statusView.state === "syncing" && (
          <div className="mb-3 rounded-xl border border-app-brand-border bg-app-brand-soft px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-app-brand-text">
              {/* The sentence beside it already says what is happening, so the
                  glyph stays silent rather than announcing a second time. */}
              <Spinner size="sm" silent />
              {source.statusView.label === "Indexing"
                ? "Indexing artifacts into the knowledge base…"
                : "Syncing the latest changes…"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="Artifacts" icon={Database}>
            {formatNumber(details.artifactCount)}
          </Tile>
          <Tile label="Last sync" icon={Clock3}>
            {details.lastSync}
          </Tile>
          <Tile label="Updated" icon={ArrowUp}>
            {formatNumber(details.latestUpdatedCount)}
          </Tile>
          <Tile label="Failed" icon={XCircle} warn={details.errors > 0}>
            {formatNumber(details.errors)}
          </Tile>
        </div>
      </Section>

      {isJira && jira && (
        <Section title="Instance">
          <dl className="overflow-hidden rounded-xl border border-app-border">
            <InfoRow label="Display name" value={jira.displayName} />
            <InfoLinkRow label="URL" value={jira.instanceUrl} />
            {canToggleJiraEnabled ? (
              <div className="flex items-center gap-3 border-t border-app-border px-4 py-2.5">
                <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">Source</dt>
                <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-app-text">
                    {jiraEnabled ? "Enabled" : "Disabled"}
                    <span className="ml-1 font-normal text-app-text-subtle">
                      · {jiraEnabled ? "included in" : "excluded from"} ingestion
                    </span>
                  </span>
                  <AccountEnabledToggle
                    enabled={jiraEnabled}
                    disabled={isTogglingEnabled}
                    ariaLabel={`Toggle ingestion for ${jira.displayName}`}
                    onChange={(next) => {
                      void handleToggleJiraEnabled(next);
                    }}
                  />
                </dd>
              </div>
            ) : (
              <InfoRow label="Source" value={jiraEnabled ? "Enabled" : "Disabled"} />
            )}
          </dl>
        </Section>
      )}

      {!isJira && (
        <Section title="Repository">
          <dl className="overflow-hidden rounded-xl border border-app-border">
            <InfoRow label="Full name" value={repository?.fullName} />
            <InfoRow label="Owner" value={repository?.owner} />
            <InfoLinkRow label="URL" value={repository?.url} />
            <InfoRow
              label="Repository ID"
              value={repository?.repositoryId ?? source.sourceId}
              mono
            />
            {canToggleEnabled && repository ? (
              <div className="flex items-center gap-3 border-t border-app-border px-4 py-2.5">
                <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">Source</dt>
                <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-app-text">
                    {repository.enabled === false ? "Disabled" : "Enabled"}
                    <span className="ml-1 font-normal text-app-text-subtle">
                      · {repository.enabled === false ? "excluded from" : "included in"} ingestion
                    </span>
                  </span>
                  <AccountEnabledToggle
                    enabled={repository.enabled !== false}
                    disabled={isTogglingEnabled}
                    ariaLabel={`Toggle ingestion for ${repository.fullName}`}
                    onChange={(next) => {
                      void handleToggleEnabled(next);
                    }}
                  />
                </dd>
              </div>
            ) : (
              <InfoRow label="Source" value={formatEnabled(repository?.enabled)} />
            )}
          </dl>
        </Section>
      )}

      {hasResourceSyncTimes && (
        <Section title="Last Synced">
          <dl className="overflow-hidden rounded-xl border border-app-border">
            {isJira ? (
              <InfoRow label="Issues" value={formatDateTime(source.lastIssuesSyncAt)} />
            ) : (
              <>
                <InfoRow label="Commits" value={formatDateTime(source.lastCommitsSyncAt)} />
                <InfoRow label="Issues" value={formatDateTime(source.lastIssuesSyncAt)} />
                <InfoRow
                  label="Pull requests"
                  value={formatDateTime(source.lastPullRequestsSyncAt)}
                />
              </>
            )}
          </dl>
        </Section>
      )}

      {canManageRepositoryConfig && repository && (
        <Section title="Sync Schedule">
          <GithubRepositorySyncSettings
            loadKey={repository.fullName}
            loadConfig={loadRepositoryConfig}
            onSave={saveRepositoryConfig}
          />
        </Section>
      )}

      {canManageJiraConfig && jira && onLoadJiraConfig && onSaveJiraConfig && (
        <Section title="Sync Schedule">
          {/* Same control as GitHub: the Jira instance sync schedule shares the
              identical schedule contract, only the load/save endpoints differ. */}
          <GithubRepositorySyncSettings
            loadKey={jira.instanceUrl}
            loadConfig={() => onLoadJiraConfig(jira.instanceUrl)}
            onSave={(request) => onSaveJiraConfig(jira.instanceUrl, request)}
            autoUpdateOnText="Due checks update this Jira instance."
            autoUpdateOffText="Due checks only mark this Jira instance out of date."
            toggleAriaLabel="Toggle Jira instance auto update"
          />
        </Section>
      )}

      {source.failedItems.length > 0 && (
        <Section title="Failed Items">
          <div className="space-y-3">
            {source.failedItems.map((item) => (
              <div
                key={`${item.artifactIdentifier}-${item.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
              >
                <p className="text-sm font-medium wrap-break-word text-app-warning-text">
                  {item.artifactIdentifier}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">{item.reason}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {canUnlinkSource && (
        <Section title="Project link">
          <div className="rounded-xl border border-app-border px-4 py-3">
            <p className="text-sm text-app-text-muted">
              Remove this {removableNoun} from the current project. The {removableNoun} and its
              artifacts are kept. You can re-link it later.
            </p>
            <Button
              variant="dangerSoft"
              onClick={() => setIsUnlinkDialogOpen(true)}
              loading={isUnlinking}
              icon={<Unlink className="h-4 w-4" />}
              className="mt-3"
            >
              Remove from project
            </Button>
          </div>
        </Section>
      )}

      <AlertDialog
        isOpen={isUnlinkDialogOpen}
        title={`Remove ${removableNoun} from project?`}
        description={`"${source.name}" will no longer feed this project's knowledge base. The ${removableNoun} and its artifacts are kept, and you can re-link it later.`}
        confirmLabel="Remove"
        loadingLabel="Removing…"
        variant="danger"
        isLoading={isUnlinking}
        errorMessage={unlinkError ?? undefined}
        onClose={() => {
          if (isUnlinking) return;
          setIsUnlinkDialogOpen(false);
          setUnlinkError(null);
        }}
        onConfirm={() => {
          void handleConfirmUnlink();
        }}
      />
    </DetailsSideDrawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-app-border pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-app-text-subtle uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Tile({
  label,
  icon: Icon,
  warn = false,
  children,
}: {
  label: string;
  icon: LucideIcon;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface-muted px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-app-text-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`mt-1.5 text-lg font-bold break-words tabular-nums ${
          warn ? "text-app-danger-text" : "text-app-text"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-app-border px-4 py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd
        className={`min-w-0 text-[13px] font-semibold wrap-break-word text-app-text ${
          mono ? "font-mono text-xs font-medium" : ""
        }`}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

function InfoLinkRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-app-border px-4 py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd className="min-w-0 text-[13px] font-semibold wrap-break-word">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-app-brand-text underline decoration-app-brand-border underline-offset-4 hover:text-app-brand"
          >
            {value}
          </a>
        ) : (
          <span className="text-app-text">Not available</span>
        )}
      </dd>
    </div>
  );
}

function formatEnabled(value?: boolean | null) {
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  return "Not available";
}

function Message({ tone, children }: { tone: "success" | "warning"; children: ReactNode }) {
  const className =
    tone === "success"
      ? "border-app-success-border bg-app-success-bg text-app-success-text"
      : "border-app-warning-border bg-app-warning-bg text-app-warning-text";

  return <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${className}`}>{children}</div>;
}
