import {
    formatDateTime,
    formatNumber,
    formatRunFinishedAt,
    getRunStatusLabel,
    getRunStatusTone,
    getSourceLabel,
} from "../data.ts";
import type { IngestionRun } from "../types.ts";

type RunHistoryProps = {
    runs: IngestionRun[];
};

/**
 * Displays a historical log of all recent ingestion runs.
 * Useful for tracking when syncs occurred and their overall success or failure status.
 */
export function RunHistory({ runs }: RunHistoryProps) {
    if (runs.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
                <h3 className="text-lg font-semibold text-app-text">
                    No ingestion runs found
                </h3>

                <p className="mt-2 text-sm text-app-text-muted">
                    The backend did not return any ingestion runs yet.
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
                {runs.map((run) => (
                    <article
                        key={run.runId}
                        className="grid gap-4 bg-app-surface px-5 py-5 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] lg:items-center"
                    >
                        <div>
                            <p className="text-sm font-semibold text-app-text">
                                {getSourceLabel(run.sourceSystem)}
                            </p>

                            <p className="mt-1 break-all text-xs text-app-text-subtle">
                                {run.runId}
                            </p>
                        </div>

                        <div>
                            <RunStatusBadge status={run.status} />
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
                    </article>
                ))}
            </div>
        </div>
    );
}

function RunStatusBadge({ status }: { status: IngestionRun["status"] }) {
    const label = getRunStatusLabel(status);
    const tone = getRunStatusTone(status);

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
        <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            {label}
        </span>
    );
}
