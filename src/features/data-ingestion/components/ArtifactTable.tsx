import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import {
    formatDateTime,
    formatNumber,
    getRunStatusLabel,
    getRunStatusTone,
    getSourceLabel,
} from "../data.ts";
import type { DataSource, FailedArtifact, IngestionRun } from "../types.ts";

type ArtifactTableProps = {
    sources: DataSource[];
    runs: IngestionRun[];
};

type FailedArtifactRow = FailedArtifact & {
    key: string;
    sourceLabel: string;
    occurredAt?: string;
};

/**
 * Displays the recent ingestion artifacts and failed items across all sources.
 * Helps users identify which specific files or records failed to sync.
 */
export function ArtifactTable({ sources, runs }: ArtifactTableProps) {
    const latestIngestedCount = sources.reduce(
        (sum, source) => sum + source.latestIngestedCount,
        0,
    );
    const latestUpdatedCount = sources.reduce(
        (sum, source) => sum + source.latestUpdatedCount,
        0,
    );
    const latestFailedCount = sources.reduce(
        (sum, source) => sum + source.errors,
        0,
    );

    const failedRows = buildFailedArtifactRows(sources, runs);
    const latestRuns = runs.slice(0, 8);

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                    title="Latest Ingested"
                    value={formatNumber(latestIngestedCount)}
                    description=""
                    tone="success"
                />

                <SummaryCard
                    title="Latest Updated"
                    value={formatNumber(latestUpdatedCount)}
                    description=""
                    tone="neutral"
                />

                <SummaryCard
                    title="Failed Artifacts"
                    value={formatNumber(latestFailedCount)}
                    description=""
                    tone={latestFailedCount > 0 ? "warning" : "success"}
                />
            </div>

            <section className="overflow-hidden rounded-2xl border border-app-border">
                <div className="border-b border-app-border bg-app-bg-soft px-5 py-4">
                    <h3 className="text-sm font-semibold text-app-text">
                        Recent Artifact Activity
                    </h3>
                </div>

                {latestRuns.length > 0 ? (
                    <div className="divide-y divide-app-border">
                        {latestRuns.map((run) => (
                            <article
                                key={run.runId}
                                className="grid gap-4 bg-app-surface px-5 py-5 lg:grid-cols-[1.1fr_1fr_1fr_1fr] lg:items-center"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-app-text">
                                        {getSourceLabel(run.sourceSystem)}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-app-text-subtle">
                                        {run.runId}
                                    </p>
                                </div>

                                <ActivityCounts run={run} />

                                <div>
                                    <p className="text-xs uppercase tracking-wide text-app-text-subtle lg:hidden">
                                        Started
                                    </p>

                                    <p className="mt-1 text-sm text-app-text">
                                        {formatDateTime(run.startedAt)}
                                    </p>
                                </div>

                                <div>
                                    <RunHealth run={run} />
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState value="No ingestion run activity has been returned yet." />
                )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-app-border">
                <div className="border-b border-app-border bg-app-bg-soft px-5 py-4">
                    <h3 className="text-sm font-semibold text-app-text">
                        Failed Artifact Details
                    </h3>
                </div>

                {failedRows.length > 0 ? (
                    <div className="divide-y divide-app-border">
                        {failedRows.map((item) => (
                            <article
                                key={item.key}
                                className="grid gap-4 bg-app-surface px-5 py-5 lg:grid-cols-[1fr_1.4fr_1.6fr] lg:items-start"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-app-text">
                                        {item.sourceLabel}
                                    </p>

                                    {item.occurredAt && (
                                        <p className="mt-1 text-xs text-app-text-subtle">
                                            {formatDateTime(item.occurredAt)}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="break-words text-sm font-medium text-app-warning-text">
                                        {item.artifactIdentifier}
                                    </p>

                                    {item.artifactIdentifier.startsWith(
                                        "http",
                                    ) && (
                                        <a
                                            href={item.artifactIdentifier}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-app-brand hover:text-app-brand-hover"
                                        >
                                            Open source
                                            <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                <p className="break-words text-sm text-app-text-muted">
                                    {item.reason}
                                </p>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState value="No failed artifacts reported in the latest source statuses or recent runs." />
                )}
            </section>
        </div>
    );
}

function buildFailedArtifactRows(
    sources: DataSource[],
    runs: IngestionRun[],
): FailedArtifactRow[] {
    const rows = new Map<string, FailedArtifactRow>();

    sources.forEach((source) => {
        source.failedItems.forEach((item) => {
            const key = `${source.sourceSystem}:status:${item.artifactIdentifier}:${item.reason}`;
            rows.set(key, {
                ...item,
                key,
                sourceLabel: getSourceLabel(source.sourceSystem),
                occurredAt: source.lastRunAt ?? undefined,
            });
        });
    });

    runs.forEach((run) => {
        run.failedItems.forEach((item) => {
            const key = `${run.sourceSystem}:${run.runId}:${item.artifactIdentifier}:${item.reason}`;
            rows.set(key, {
                ...item,
                key,
                sourceLabel: getSourceLabel(run.sourceSystem),
                occurredAt: run.startedAt,
            });
        });
    });

    return Array.from(rows.values()).slice(0, 50);
}

function SummaryCard({
    title,
    value,
    description,
    tone,
}: {
    title: string;
    value: string;
    description: string;
    tone: "neutral" | "success" | "warning";
}) {
    const icon =
        tone === "warning" ? (
            <AlertTriangle size={18} className="text-app-warning-solid" />
        ) : (
            <CheckCircle2 size={18} className="text-app-success-text" />
        );

    return (
        <div className="rounded-2xl border border-app-border bg-app-surface p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-app-text-muted">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-app-text">
                        {value}
                    </p>
                </div>

                {icon}
            </div>

            <p className="mt-3 text-sm text-app-text-muted">{description}</p>
        </div>
    );
}

function ActivityCounts({ run }: { run: IngestionRun }) {
    return (
        <div>
            <p className="text-xs uppercase tracking-wide text-app-text-subtle lg:hidden">
                Counts
            </p>

            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <CountPill label="Ingested" value={run.ingestedCount} />
                <CountPill label="Updated" value={run.updatedCount} />
                <CountPill
                    label="Failed"
                    value={run.failedCount}
                    danger={run.failedCount > 0}
                />
            </div>
        </div>
    );
}

function CountPill({
    label,
    value,
    danger = false,
}: {
    label: string;
    value: number;
    danger?: boolean;
}) {
    return (
        <span
            className={`rounded-full px-2.5 py-1 ${
                danger
                    ? "bg-app-warning-bg text-app-warning-text"
                    : "bg-app-bg-soft text-app-text-muted"
            }`}
        >
            {label}: {formatNumber(value)}
        </span>
    );
}

function RunHealth({ run }: { run: IngestionRun }) {
    const tone = getRunStatusTone(run.status);

    if (tone === "success" && run.failedCount === 0) {
        return (
            <span className="inline-flex items-center gap-2 roundReed-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
                <CheckCircle2 size={13} />
                No failures
            </span>
        );
    }

    if (tone === "running") {
        return (
            <span className="inline-flex items-center gap-2 rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                {getRunStatusLabel(run.status)}
            </span>
        );
    }

    if (run.failedCount > 0) {
        return (
            <span className="inline-flex items-center gap-2 rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
                <AlertTriangle size={13} />
                Needs review
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            <AlertTriangle size={13} />
            {getRunStatusLabel(run.status)}
        </span>
    );
}

function EmptyState({ value }: { value: string }) {
    return (
        <div className="bg-app-surface px-5 py-8 text-center text-sm text-app-text-muted">
            {value}
        </div>
    );
}
