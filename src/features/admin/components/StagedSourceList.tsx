import {
  AlertCircle,
  BookOpen,
  Check,
  FileText,
  GitBranch,
  Loader2,
  RefreshCw,
  Trash2,
  Ticket,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { DraftSource, DraftSourceStatus } from "../projectSourcesDraft";

type StagedSourceListProps = {
  sources: DraftSource[];
  /** Blocks the row actions while the parent runs a connect batch. */
  disabled?: boolean;
  /**
   * Removes a staged source. Omitted on the provisioning screen, where the
   * project already exists and dropping a row from the list would do nothing.
   */
  onRemove?: (sourceId: string) => void;
  /** Omitted where retrying makes no sense, e.g. before anything ran. */
  onRetry?: (sourceId: string) => void;
  /** Shown in place of the list when there are no staged sources. */
  emptyMessage?: string;
};

const statusLabels: Record<DraftSourceStatus, string> = {
  pending: "Not connected yet",
  connecting: "Connecting...",
  connected: "Connected",
  failed: "Failed",
};

/** The resting icon shown before a run, chosen by source type. */
function TypeIcon({ source }: { source: DraftSource }) {
  if (source.type === "JIRA") {
    return <Ticket className="h-4 w-4 text-app-text-muted" />;
  }

  if (source.type === "UPLOAD") {
    return <FileText className="h-4 w-4 text-app-text-muted" />;
  }

  if (source.type === "CONFLUENCE") {
    return <BookOpen className="h-4 w-4 text-app-text-muted" />;
  }

  return <GitBranch className="h-4 w-4 text-app-text-muted" />;
}

function StatusIcon({ source }: { source: DraftSource }) {
  if (source.status === "connecting") {
    return <Loader2 className="h-4 w-4 animate-spin text-app-brand" />;
  }

  if (source.status === "connected") {
    return <Check className="h-4 w-4 text-app-success-text" />;
  }

  if (source.status === "failed") {
    return <AlertCircle className="h-4 w-4 text-app-danger-text" />;
  }

  return <TypeIcon source={source} />;
}

/** Primary line: the human name of the source, by type. */
function sourceTitle(source: DraftSource): string {
  if (source.type === "GITHUB") return `${source.owner}/${source.name}`;

  return source.displayName;
}

/**
 * Secondary line shown when the source is not in a failed state: the instance
 * URL for Jira, the staged file count for an upload, or the credential for a
 * GitHub repository.
 */
function sourceDetail(source: DraftSource): string {
  if (source.type === "UPLOAD") {
    return source.files.length === 1 ? "1 file" : `${source.files.length} files`;
  }

  if (source.type === "JIRA") {
    return source.url;
  }

  if (source.type === "CONFLUENCE") {
    return `${source.baseUrl} (${source.spaceId})`;
  }

  return source.tokenName;
}

/**
 * The status line under the title. A staged GitHub repository that is already
 * ingested elsewhere is linked rather than fetched, so "Not connected yet" would
 * misdescribe it — it says so instead.
 */
function statusDescription(source: DraftSource): string {
  if (source.status === "pending" && source.type === "GITHUB" && source.repositoryId) {
    return "Already ingested, will be linked";
  }

  return `${statusLabels[source.status]} · ${sourceDetail(source)}`;
}

/**
 * The staged-repository list with per-repository connect status, retry and
 * remove. Shared by the create-project wizard and the project drawer's
 * "Add sources" section so both render the same outcome list; it owns no
 * connect logic, only the presentation of the draft entries.
 */
export function StagedSourceList({
  sources,
  disabled = false,
  onRemove,
  onRetry,
  emptyMessage,
}: StagedSourceListProps) {
  if (sources.length === 0) {
    if (!emptyMessage) return null;

    return (
      <p className="rounded-2xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-app-text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex flex-col gap-2 rounded-2xl border border-app-border bg-app-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <StatusIcon source={source} />
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-app-text">{sourceTitle(source)}</p>
              <p
                className={`mt-0.5 text-xs ${
                  source.status === "failed" ? "text-app-danger-text" : "text-app-text-muted"
                }`}
              >
                {source.status === "failed" && source.errorMessage
                  ? source.errorMessage
                  : statusDescription(source)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 sm:justify-end">
            {source.status === "failed" && onRetry && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRetry(source.id)}
                disabled={disabled}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Retry
              </Button>
            )}

            {source.status !== "connected" && onRemove && (
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                onClick={() => onRemove(source.id)}
                disabled={disabled}
                aria-label={`Remove ${sourceTitle(source)}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
