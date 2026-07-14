import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import type {
  ConfigureGithubRepositoryRequest,
  GithubRepositoryConfig,
} from "../../../services/sources/githubService.ts";
import { formatDateTime, formatNumber, SOURCE_META } from "../data.ts";
import type { DataSource, LoadingState, SourceStatus } from "../types.ts";
import { GithubRepositorySyncSettings } from "./GithubRepositorySyncSettings.tsx";

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
  onClose,
}: SourceDetailsPanelProps) {
  const [updateState, setUpdateState] = useState<LoadingState>("idle");
  const [refreshState, setRefreshState] = useState<LoadingState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const Icon = SOURCE_META[source.sourceSystem].icon;
  const repository = source.githubRepository;
  const isUpdating = updateState === "loading";
  const isRefreshing = refreshState === "loading";
  const canUpdateRepository =
    source.sourceSystem === "GITHUB" &&
    repository !== null &&
    onUpdateSource !== undefined;
  const canManageRepositoryConfig =
    canManageSyncSettings &&
    source.sourceSystem === "GITHUB" &&
    repository !== null &&
    onLoadRepositoryConfig !== undefined &&
    onSaveRepositoryConfig !== undefined;

  const loadRepositoryConfig = useCallback(async () => {
    if (!canManageRepositoryConfig || !repository || !onLoadRepositoryConfig) {
      throw new Error("Repository sync config is not available.");
    }

    return onLoadRepositoryConfig(repository);
  }, [canManageRepositoryConfig, onLoadRepositoryConfig, repository]);

  const saveRepositoryConfig = useCallback(
    async (request: ConfigureGithubRepositoryRequest) => {
      if (
        !canManageRepositoryConfig ||
        !repository ||
        !onSaveRepositoryConfig
      ) {
        throw new Error("Repository sync config is not available.");
      }

      await onSaveRepositoryConfig(repository, request);
    },
    [canManageRepositoryConfig, onSaveRepositoryConfig, repository],
  );

  const handleUpdateSource = useCallback(async () => {
    if (!canUpdateRepository || !onUpdateSource) return;

    setUpdateState("loading");
    setMessage(null);
    setErrorMessage(null);

    try {
      await onUpdateSource(source);
      setUpdateState("success");
      setMessage(
        "Repository update started. Details will refresh while ingestion runs.",
      );
    } catch (error) {
      setUpdateState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to start repository update",
      );
    }
  }, [canUpdateRepository, onUpdateSource, source]);

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
        error instanceof Error
          ? error.message
          : "Failed to refresh repository details",
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
          <Badge>{source.type}</Badge>
          <StatusBadge status={source.status}>{source.statusLabel}</StatusBadge>
          <StatusBadge status={source.ingestionStatus}>
            {source.ingestionStatusLabel}
          </StatusBadge>
        </>
      }
      footer={
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              void handleUpdateSource();
            }}
            disabled={!canUpdateRepository || isUpdating || isRefreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-brand bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:border-app-brand-hover hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            title={
              canUpdateRepository
                ? undefined
                : "Repository updates need GitHub owner and repository name."
            }
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4" />
            )}
            Update repo
          </button>

          <button
            type="button"
            onClick={() => {
              void handleRefreshDetails();
            }}
            disabled={!onRefreshDetails || isUpdating || isRefreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh details
          </button>
        </div>
      }
    >
      {message && <Message tone="success">{message}</Message>}

      {errorMessage && <Message tone="warning">{errorMessage}</Message>}

      <Section title="Repository">
        <dl>
          <DetailRow label="Full name" value={repository?.fullName} />
          <DetailRow label="Owner" value={repository?.owner} />
          <DetailLinkRow label="GitHub URL" value={repository?.url} />
          <DetailRow
            label="Repository ID"
            value={repository?.repositoryId ?? source.sourceId}
            mono
          />
          <DetailRow
            label="Source enabled"
            value={formatEnabled(repository?.enabled)}
          />
        </dl>
      </Section>

      {canManageRepositoryConfig && repository && (
        <Section title="Sync Schedule">
          <GithubRepositorySyncSettings
            loadKey={repository.fullName}
            loadConfig={loadRepositoryConfig}
            onSave={saveRepositoryConfig}
          />
        </Section>
      )}

      <Section title="Ingestion">
        <dl>
          <DetailRow label="Last sync" value={details.lastSync} />
          <DetailRow
            label="Artifacts"
            value={formatNumber(details.artifactCount)}
          />
          <DetailRow
            label="Latest updated"
            value={formatNumber(details.latestUpdatedCount)}
          />
          <DetailRow label="Failed" value={formatNumber(details.errors)} />
        </dl>
      </Section>

      {source.failedItems.length > 0 && (
        <Section title="Failed Items">
          <div className="space-y-3">
            {source.failedItems.map((item) => (
              <div
                key={`${item.artifactIdentifier}-${item.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
              >
                <p className="wrap-break-word text-sm font-medium text-app-warning-text">
                  {item.artifactIdentifier}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </DetailsSideDrawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-app-border pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-text-subtle">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-app-text-muted">{label}</dt>
      <dd
        className={`wrap-break-word text-sm font-medium text-app-text ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

function DetailLinkRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-app-text-muted">{label}</dt>
      <dd className="wrap-break-word text-sm font-medium text-app-text">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-app-brand-text underline decoration-app-brand-border underline-offset-4 hover:text-app-brand"
          >
            {value}
          </a>
        ) : (
          "Not available"
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

function StatusBadge({
  status,
  children,
}: {
  status: SourceStatus;
  children: ReactNode;
}) {
  if (status === "connected") return <BadgeSuccess>{children}</BadgeSuccess>;
  if (status === "running") return <BadgeRunning>{children}</BadgeRunning>;
  if (status === "disabled") return <Badge>{children}</Badge>;
  return <BadgeWarning>{children}</BadgeWarning>;
}

function Message({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-app-success-border bg-app-success-bg text-app-success-text"
      : "border-app-warning-border bg-app-warning-bg text-app-warning-text";

  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-app-neutral-bg px-3 py-1 text-xs font-medium text-app-neutral-text">
      {children}
    </span>
  );
}

function BadgeSuccess({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
      {children}
    </span>
  );
}

function BadgeRunning({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
      {children}
    </span>
  );
}

function BadgeWarning({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
      {children}
    </span>
  );
}
