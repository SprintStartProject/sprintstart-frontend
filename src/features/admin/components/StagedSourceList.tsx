import { AlertCircle, Check, GitBranch, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { DraftSource, DraftSourceStatus } from "../projectSourcesDraft";

type StagedSourceListProps = {
  sources: DraftSource[];
  /** Blocks the row actions while the parent runs a connect batch. */
  disabled?: boolean;
  onRemove: (sourceId: string) => void;
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

function StatusIcon({ status }: { status: DraftSourceStatus }) {
  if (status === "connecting") {
    return <Loader2 className="h-4 w-4 animate-spin text-app-brand" />;
  }

  if (status === "connected") {
    return <Check className="h-4 w-4 text-app-success-text" />;
  }

  if (status === "failed") {
    return <AlertCircle className="h-4 w-4 text-app-danger-text" />;
  }

  return <GitBranch className="h-4 w-4 text-app-text-muted" />;
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
              <StatusIcon status={source.status} />
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-app-text">
                {source.owner}/{source.name}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  source.status === "failed" ? "text-app-danger-text" : "text-app-text-muted"
                }`}
              >
                {source.status === "failed" && source.errorMessage
                  ? source.errorMessage
                  : `${statusLabels[source.status]} · ${source.tokenName}`}
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

            {source.status !== "connected" && (
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                onClick={() => onRemove(source.id)}
                disabled={disabled}
                aria-label={`Remove ${source.owner}/${source.name}`}
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
