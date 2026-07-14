import { ChevronRight } from "lucide-react";
import { formatNumber } from "../data.ts";
import type { DataSource, SourceSystem } from "../types.ts";

type SourceListProps = {
    sources: DataSource[];
    selectedSourceSystem: SourceSystem | null;
    onSelectSource: (sourceSystem: SourceSystem) => void;
};

/**
 * Lists all currently connected data sources with their high-level status.
 * Allows users to select a source to view more detailed metrics in the side panel.
 */
export function SourceList({
    sources,
    selectedSourceSystem,
    onSelectSource,
}: SourceListProps) {
    if (sources.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
                <h3 className="text-lg font-semibold text-app-text">
                    No connected sources
                </h3>

                <p className="mt-2 text-sm text-app-text-muted">
                    Connect a source to start ingestion and show source details here.
                </p>
            </div>
        );
    }

    return (
        <>
            {sources.map((source) => {
                const Icon = source.icon;
                const isSelected = selectedSourceSystem === source.sourceSystem;

                return (
                    <button
                        key={source.sourceSystem}
                        type="button"
                        onClick={() => onSelectSource(source.sourceSystem)}
                        className={`group w-full cursor-pointer rounded-2xl border bg-app-surface p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg sm:p-6 ${
                            isSelected
                                ? "border-app-brand shadow-sm"
                                : "border-app-border hover:border-app-brand-border"
                        }`}
                    >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft">
                                    <Icon size={24} className="text-app-text-muted" />
                                </div>

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="break-words text-lg font-semibold text-app-text">
                                            {source.name}
                                        </h3>

                                        <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                                            {source.type}
                                        </span>

                                        <SourceStatusBadge source={source} />
                                    </div>

                                    <p className="mt-2 max-w-3xl text-sm text-app-text-muted">
                                        {source.description}
                                    </p>
                                </div>
                            </div>

                            <ChevronRight
                                size={20}
                                className={`shrink-0 text-app-text-disabled transition ${
                                    isSelected
                                        ? "rotate-180 text-app-brand"
                                        : "group-hover:translate-x-1"
                                }`}
                            />
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <InfoBlock
                                label="Latest Ingested"
                                value={formatNumber(source.latestIngestedCount)}
                            />

                            <InfoBlock
                                label="Latest Updated"
                                value={formatNumber(source.latestUpdatedCount)}
                            />

                            <InfoBlock label="Last Sync" value={source.lastSync} />

                            <InfoBlock
                                label="Errors"
                                value={formatNumber(source.errors)}
                                danger={source.errors > 0}
                            />
                        </div>

                        {source.failedItems.length > 0 && (
                            <div className="mt-5 rounded-2xl border border-app-warning-border bg-app-warning-bg p-4">
                                <p className="text-sm font-semibold text-app-warning-text">
                                    {source.failedItems.length} failed item
                                    {source.failedItems.length === 1 ? "" : "s"} in latest status
                                </p>

                                <p className="mt-1 text-sm text-app-text-muted">
                                    Open the source details or check the backend response for failed
                                    artifact identifiers and reasons.
                                </p>
                            </div>
                        )}
                    </button>
                );
            })}
        </>
    );
}

function InfoBlock({
    label,
    value,
    danger = false,
}: {
    label: string;
    value: string;
    danger?: boolean;
}) {
    return (
        <div>
            <p className="text-xs uppercase tracking-wide text-app-text-subtle">
                {label}
            </p>

            <p
                className={`mt-2 break-words text-lg font-semibold ${
                    danger ? "text-app-danger-text" : "text-app-text"
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function SourceStatusBadge({ source }: { source: DataSource }) {
    if (source.status === "connected") {
        return (
            <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
                {source.statusLabel}
            </span>
        );
    }

    if (source.status === "running") {
        return (
            <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                {source.statusLabel}
            </span>
        );
    }

    return (
        <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            {source.statusLabel}
        </span>
    );
}
