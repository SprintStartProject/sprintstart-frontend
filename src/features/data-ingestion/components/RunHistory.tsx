import {
  formatDateTime,
  formatNumber,
  formatRunFinishedAt,
  getAiSyncStatusLabel,
  getAiSyncStatusTone,
  getRunSourceLabel,
  getRunStatusLabel,
  getRunStatusTone,
} from "../data.ts";
import { ChevronRight } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import type { IngestionRun } from "../types.ts";

type RunHistoryProps = {
  runs: IngestionRun[];
  selectedRunId?: string | null;
  onSelectRun?: (run: IngestionRun) => void;
  /** Maps a run to its repository label; falls back to the source-system label. */
  sourceLabelByRunId?: Map<string, string>;
  /** Shown in the empty state when the emptiness is caused by active filters. */
  isFiltered?: boolean;
};

/**
 * Displays a historical log of all recent ingestion runs.
 * Useful for tracking when syncs occurred and their overall success or failure status.
 */
export function RunHistory({
  runs,
  selectedRunId = null,
  onSelectRun,
  sourceLabelByRunId,
  isFiltered = false,
}: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <EmptyState title={isFiltered ? "No runs match these filters" : "No ingestion runs found"}>
        {isFiltered
          ? "Try a different status or repository, or reset the filters."
          : "The backend did not return any ingestion runs yet."}
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-app-border">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-app-border bg-app-bg-soft px-5 py-3 text-xs font-semibold tracking-wide text-app-text-subtle uppercase lg:grid">
        <span>Source</span>
        <span>Status</span>
        <span>Started</span>
        <span>Finished</span>
        <span>Counts</span>
      </div>

      <div className="divide-y divide-app-border">
        {runs.map((run) => {
          const isSelected = selectedRunId === run.runId;

          return (
            <button
              key={run.runId}
              type="button"
              onClick={() => onSelectRun?.(run)}
              aria-pressed={isSelected}
              className={`grid w-full gap-4 px-5 py-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] lg:items-center ${
                isSelected
                  ? "bg-app-brand-soft"
                  : // Rows sit in a shared grid, so they get an
                    // inset brand edge instead of the cards'
                    // lift -- a translate would break the
                    // column alignment with its neighbours.
                    "bg-app-surface hover:bg-app-surface-hover hover:shadow-[inset_3px_0_0_0_var(--color-app-brand)]"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-app-text">
                  {getRunSourceLabel(run, sourceLabelByRunId)}
                </p>

                <p className="mt-1 text-xs break-all text-app-text-subtle">{run.runId}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <RunStatusBadge status={run.status} failureReason={run.failureReason} />
                <AiSyncStatusBadge
                  status={run.aiSyncStatus}
                  failureReason={run.aiSyncFailureReason}
                />
              </div>

              <div>
                <p className="text-xs tracking-wide text-app-text-subtle uppercase lg:hidden">
                  Started
                </p>

                <p className="mt-1 text-sm text-app-text">{formatDateTime(run.startedAt)}</p>
              </div>

              <div>
                <p className="text-xs tracking-wide text-app-text-subtle uppercase lg:hidden">
                  Finished
                </p>

                <p className="mt-1 text-sm text-app-text">
                  {formatRunFinishedAt(run.finishedAt, run.status)}
                </p>
              </div>

              <div>
                <p className="text-xs tracking-wide text-app-text-subtle uppercase lg:hidden">
                  Counts
                </p>

                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-app-bg-soft px-2.5 py-1 text-app-text-muted">
                    Ingested: {formatNumber(run.ingestedCount)}
                  </span>

                  <span className="rounded-full bg-app-bg-soft px-2.5 py-1 text-app-text-muted">
                    Updated: {formatNumber(run.updatedCount)}
                  </span>

                  {run.deletedCount > 0 && (
                    <span className="rounded-full bg-app-bg-soft px-2.5 py-1 text-app-text-muted">
                      Deleted: {formatNumber(run.deletedCount)}
                    </span>
                  )}

                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      run.failedCount > 0
                        ? "bg-app-warning-bg text-app-warning-text"
                        : "bg-app-bg-soft text-app-text-muted"
                    }`}
                  >
                    Failed: {formatNumber(run.failedCount)}
                  </span>
                </div>
              </div>

              <ChevronRight
                className={`hidden h-5 w-5 justify-self-end text-app-text-disabled transition group-hover:translate-x-1 lg:block ${
                  isSelected ? "text-app-brand" : ""
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RunStatusBadge({
  status,
  failureReason,
}: {
  status: IngestionRun["status"];
  failureReason?: IngestionRun["failureReason"];
}) {
  const label = getRunStatusLabel(status);
  const tone = getRunStatusTone(status);
  // Surfaces the run-level failure reason on hover; the full text is in the drawer.
  const title = failureReason ?? undefined;

  if (tone === "success") {
    return <Badge variant="success">{label}</Badge>;
  }

  if (tone === "running") {
    return <Badge variant="brand">{label}</Badge>;
  }

  return (
    <Badge variant="danger" title={title}>
      {label}
    </Badge>
  );
}

function AiSyncStatusBadge({
  status,
  failureReason,
}: {
  status: IngestionRun["aiSyncStatus"];
  failureReason: IngestionRun["aiSyncFailureReason"];
}) {
  const label = getAiSyncStatusLabel(status);
  if (!label) return null;

  const tone = getAiSyncStatusTone(status);
  const title = status === "FAILED" && failureReason ? failureReason : undefined;

  if (tone === "success") {
    return (
      <Badge variant="success" title={title}>
        {label}
      </Badge>
    );
  }

  if (tone === "running") {
    return (
      <Badge variant="brand" title={title}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="danger" title={title}>
      {label}
    </Badge>
  );
}
