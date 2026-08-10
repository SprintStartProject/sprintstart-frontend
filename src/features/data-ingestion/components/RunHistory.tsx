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
import type { IngestionRun } from "../types.ts";

type RunHistoryProps = {
    runs: IngestionRun[];
    selectedRunId?: string | null;
    onSelectRun?: (run: IngestionRun) => void;
    /** Maps a run's source reference to its display name; falls back to the raw reference. */
    sourceLabelBySourceRef?: Map<string, string>;
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
    sourceLabelBySourceRef,
    isFiltered = false,
}: RunHistoryProps) {
    if (runs.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
                <h3 className="text-lg font-semibold text-app-text">
                    {isFiltered
                        ? 'No runs match these filters'
                        : 'No ingestion runs found'}
                </h3>

                <p className="mt-2 text-sm text-app-text-muted">
                    {isFiltered
                        ? 'Try a different status or repository, or reset the filters.'
                        : 'The backend did not return any ingestion runs yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-app-border">
            <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-app-border bg-app-bg-soft px-5 py-3 text-xs font-semibold uppercase tracking-wide text-app-text-subtle lg:grid">
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
                                    : "bg-app-surface hover:bg-app-surface-hover"
                            }`}
                        >
                            <div>
                                <p className="text-sm font-semibold text-app-text">
                                    {getRunSourceLabel(run, sourceLabelBySourceRef)}
                                </p>

                                <p className="mt-1 break-all text-xs text-app-text-subtle">
                                    {run.runId}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <RunStatusBadge
                                    status={run.status}
                                    failureReason={run.failureReason}
                                />
                                <AiSyncStatusBadge
                                    status={run.aiSyncStatus}
                                    failureReason={run.aiSyncFailureReason}
                                />
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-app-text-subtle lg:hidden">
                                    Started
                                </p>

                                <p className="mt-1 text-sm text-app-text">
                                    {formatDateTime(run.startedAt)}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-app-text-subtle lg:hidden">
                                    Finished
                                </p>

                                <p className="mt-1 text-sm text-app-text">
                                    {formatRunFinishedAt(
                                        run.finishedAt,
                                        run.status,
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-app-text-subtle lg:hidden">
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
        return (
            <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
                {label}
            </span>
        );
    }

    if (tone === "running") {
        return (
            <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                {label}
            </span>
        );
    }

    return (
        <span
            title={title}
            className="rounded-full border border-app-danger-border bg-app-danger-bg px-3 py-1 text-xs font-medium text-app-danger-text"
        >
            {label}
        </span>
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
    const title =
        status === "FAILED" && failureReason ? failureReason : undefined;

    if (tone === "success") {
        return (
            <span
                title={title}
                className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text"
            >
                {label}
            </span>
        );
    }

    if (tone === "running") {
        return (
            <span
                title={title}
                className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text"
            >
                {label}
            </span>
        );
    }

    return (
        <span
            title={title}
            className="rounded-full border border-app-danger-border bg-app-danger-bg px-3 py-1 text-xs font-medium text-app-danger-text"
        >
            {label}
        </span>
    );
}
