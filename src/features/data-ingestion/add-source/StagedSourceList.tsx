import { AlertCircle, Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { FilterSelect } from "../../../components/ui/FilterSelect.tsx";
import { getConnector } from "../connectors/registry.ts";
import { NO_OWNER_OPTION, type SourceOwnerOption } from "./sourceOwners.ts";
import type { DraftSource, DraftSourceStatus } from "./projectSourcesDraft.ts";

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
  /**
   * The people a repository's documentation can be handed to — the project's members here,
   * the staged ones in the create-project wizard. Just the people: "No owner" is prepended.
   *
   * Omitted (together with {@link StagedSourceListProps.onOwnerChange}) leaves the picker off
   * entirely, which is what the provisioning screen wants — by then the assignment has either
   * been made or has failed, and there is nothing left to choose.
   */
  ownerOptions?: readonly SourceOwnerOption[];
  onOwnerChange?: (sourceId: string, ownerUserId: string) => void;
  /** Shown in place of the list when there are no staged sources. */
  emptyMessage?: string;
};

const statusLabels: Record<DraftSourceStatus, string> = {
  pending: "Not connected yet",
  connecting: "Connecting...",
  connected: "Connected",
  failed: "Failed",
};

/** The resting icon shown before a run, the connector's own. */
function TypeIcon({ source }: { source: DraftSource }) {
  const { icon: Icon } = getConnector(source.type).meta;

  return <Icon className="h-4 w-4 text-app-text-muted" />;
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

/** Primary line: the human name of the source, as its connector words it. */
function sourceTitle(source: DraftSource): string {
  return getConnector(source.type).draft.title(source);
}

/**
 * Secondary line shown when the source is not in a failed state: the instance
 * URL for Jira, the staged file count for an upload, the credential for a
 * GitHub repository.
 */
function sourceDetail(source: DraftSource): string {
  return getConnector(source.type).draft.detail(source);
}

/**
 * The status line under the title. A staged source that is linked rather than
 * fetched (a GitHub repository that is already ingested elsewhere) would be
 * misdescribed by "Not connected yet", so its connector's own note replaces it —
 * and the same goes for the line after the run.
 *
 * Saying so afterwards matters as much as before: a linked source finishes
 * instantly and starts no ingestion, so a plain "Connected" leaves the PM
 * watching for a run that is never coming and wondering whether the connect
 * worked at all.
 */
function statusDescription(source: DraftSource): string {
  if (source.status === "pending") {
    const note = getConnector(source.type).draft.pendingNote?.(source);
    if (note) return note;
  }

  // The connect worked and the ownership write did not; see `ownerAssignmentFailed`. Said on
  // the row rather than in a toast because it is true of this repository and no other, and it
  // wins over the reuse line below because it is the half the PM may want to put right. It
  // still may not imply an ingestion a linked source never started.
  if (source.status === "connected" && source.ownerAssignmentFailed) {
    return source.wasReused
      ? "Linked · the owner could not be assigned"
      : "Connected · the owner could not be assigned";
  }

  if (source.status === "connected" && source.wasReused) {
    return "Linked · already available, nothing re-ingested";
  }

  return `${statusLabels[source.status]} · ${sourceDetail(source)}`;
}

/** The knowledge-gap component an owner staged on the row is assigned to; null when it has none. */
function ownerComponentOf(source: DraftSource): string | null {
  return getConnector(source.type).draft.ownerComponent?.(source) ?? null;
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
  ownerOptions,
  onOwnerChange,
  emptyMessage,
}: StagedSourceListProps) {
  const canPickOwner = ownerOptions !== undefined && onOwnerChange !== undefined;
  const ownerChoices = ownerOptions ? [NO_OWNER_OPTION, ...ownerOptions] : [];

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

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            {/* Only while the source is still staged: once it has connected the assignment has
                already been written, and a control that no longer changes anything is worse
                than none. The owner is then changed from the knowledge-gaps page. */}
            {canPickOwner && ownerComponentOf(source) && source.status !== "connected" && (
              <FilterSelect
                label={`Owner of ${ownerComponentOf(source)}`}
                value={source.ownerUserId ?? ""}
                options={ownerChoices}
                onChange={(ownerUserId) => onOwnerChange?.(source.id, ownerUserId)}
                disabled={disabled}
                className="w-44"
              />
            )}

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
