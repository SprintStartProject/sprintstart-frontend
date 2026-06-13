import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    RefreshCw,
    X,
    type LucideIcon,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import {
    getIngestionRuns,
    getIngestionStatus,
} from "../../services/ingestionService.ts";
import type {
    IngestionRun,
    SourceIngestionStatus,
    SourceSystem,
} from "../../types/ingestionTypes.ts";

export type SourceStatus = "connected" | "warning";

export type SourceDetailsSource = {
    sourceSystem: SourceSystem;
    name: string;
    type: string;
    status: SourceStatus;
    artifacts: number;
    lastSync: string;
    errors: number;
    latestIngestedCount?: number;
    latestUpdatedCount?: number;
    failedItems?: SourceIngestionStatus["failedItems"];

    /**
     * Optional fields can still exist on the page source object,
     * but this details panel does not render them because the backend
     * does not currently provide them.
     */
    description?: string;
    nextSync?: string;
};

type LoadingState = "idle" | "loading" | "success" | "error";

type SourceDetailsPanelProps = {
    source: SourceDetailsSource;
    onClose: () => void;
};

const DETAILS_RUN_LIMIT = 10;

export function SourceDetailsPanel({
                                       source,
                                       onClose,
                                   }: SourceDetailsPanelProps) {
    const [loadingState, setLoadingState] = useState<LoadingState>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sourceStatus, setSourceStatus] =
        useState<SourceIngestionStatus | null>(null);
    const [recentRuns, setRecentRuns] = useState<IngestionRun[]>([]);

    const loadSourceDetails = useCallback(async () => {
        setLoadingState("loading");
        setErrorMessage(null);

        try {
            const [statusData, runData] = await Promise.all([
                getIngestionStatus(),
                getIngestionRuns(DETAILS_RUN_LIMIT),
            ]);

            const currentSourceStatus =
                statusData.find(
                    (status) => status.sourceSystem === source.sourceSystem,
                ) ?? null;

            const currentSourceRuns = runData.filter(
                (run) => run.sourceSystem === source.sourceSystem,
            );

            setSourceStatus(currentSourceStatus);
            setRecentRuns(currentSourceRuns);
            setLoadingState("success");
        } catch (error) {
            setLoadingState("error");
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to load source details",
            );
        }
    }, [source.sourceSystem]);

    useEffect(() => {
        void loadSourceDetails();
    }, [loadSourceDetails]);

    const details = useMemo(() => {
        const ingestedCount =
            sourceStatus?.ingestedCount ??
            source.latestIngestedCount ??
            source.artifacts;

        const updatedCount =
            sourceStatus?.updatedCount ??
            source.latestUpdatedCount ??
            0;

        const failedCount =
            sourceStatus?.failedCount ??
            source.errors;

        const failedItems =
            sourceStatus?.failedItems ??
            source.failedItems ??
            [];

        const lastSync =
            sourceStatus?.lastRunTime !== undefined
                ? formatDateTime(sourceStatus.lastRunTime)
                : source.lastSync;

        const hasNeverSynced =
            sourceStatus?.lastRunTime === null ||
            lastSync === "Never";

        const hasErrors = failedCount > 0;

        const status: SourceStatus =
            hasNeverSynced || hasErrors ? "warning" : "connected";

        return {
            status,
            statusLabel: getSourceStatusLabel(hasNeverSynced, hasErrors),
            ingestedCount,
            updatedCount,
            failedCount,
            failedItems,
            lastSync,
            hasNeverSynced,
            hasErrors,
        };
    }, [source, sourceStatus]);

    const isLoading = loadingState === "loading";

    return (
        <>
            <button
                type="button"
                aria-label="Close source details overlay"
                onClick={onClose}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden"
            />

            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-app-border bg-app-surface shadow-2xl transition-transform sm:w-[440px]">
                <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-app-brand">
                            Selected Source
                        </p>

                        <h2 className="mt-1 break-words text-xl font-bold text-app-text">
                            {source.name}
                        </h2>

                        <p className="mt-1 text-sm text-app-text-muted">
                            Latest ingestion data for {source.sourceSystem}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close source details"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-2 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-7">
                        {errorMessage && (
                            <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                                {errorMessage}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Badge>{source.type}</Badge>

                            {details.status === "connected" ? (
                                <BadgeSuccess>{details.statusLabel}</BadgeSuccess>
                            ) : (
                                <BadgeWarning>{details.statusLabel}</BadgeWarning>
                            )}

                            <BadgeNeutral>
                                {formatNumber(details.ingestedCount)} Ingested
                            </BadgeNeutral>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard
                                label="Last Sync"
                                value={details.lastSync}
                            />

                            <InfoCard
                                label="Recent Runs"
                                value={formatNumber(recentRuns.length)}
                            />

                            <InfoCard
                                label="Ingested"
                                value={formatNumber(details.ingestedCount)}
                            />

                            <InfoCard
                                label="Updated"
                                value={formatNumber(details.updatedCount)}
                            />

                            <InfoCard
                                label="Failed"
                                value={formatNumber(details.failedCount)}
                                danger={details.failedCount > 0}
                            />

                            <InfoCard
                                label="Source System"
                                value={source.sourceSystem}
                            />
                        </div>

                        {isLoading && (
                            <div className="rounded-xl border border-app-border bg-app-surface-muted p-4">
                                <div className="flex items-center gap-3 text-sm text-app-text-muted">
                                    <RefreshCw
                                        size={16}
                                        className="animate-spin text-app-brand"
                                    />
                                    Loading latest source details...
                                </div>
                            </div>
                        )}

                        <div>
                            <SectionTitle>
                                Ingestion Status
                            </SectionTitle>

                            <div className="space-y-3">
                                {details.hasNeverSynced ? (
                                    <StatusCard
                                        isHealthy={false}
                                        icon={Clock3}
                                        title="Not synced yet"
                                        description="No ingestion run has been reported for this source yet. Connect or sync the source first, then refresh the details."
                                    />
                                ) : details.hasErrors ? (
                                    <StatusCard
                                        isHealthy={false}
                                        icon={AlertTriangle}
                                        title={`${formatNumber(details.failedCount)} failed item${
                                            details.failedCount === 1 ? "" : "s"
                                        }`}
                                        description="The latest ingestion status contains failed items. Review the failed items below."
                                    />
                                ) : (
                                    <StatusCard
                                        isHealthy
                                        icon={CheckCircle2}
                                        title="Source is synced"
                                        description="The latest ingestion status was loaded successfully and does not report failed items."
                                    />
                                )}
                            </div>
                        </div>

                        <div>
                            <SectionTitle>
                                Failed Items
                            </SectionTitle>

                            {details.hasNeverSynced ? (
                                <EmptyState value="No failed items can be shown because this source has not been synced yet." />
                            ) : details.failedItems.length > 0 ? (
                                <div className="space-y-3">
                                    {details.failedItems.map((item) => (
                                        <div
                                            key={`${item.artifactIdentifier}-${item.reason}`}
                                            className="rounded-xl border border-app-warning-border bg-app-warning-bg p-4"
                                        >
                                            <p className="break-words text-sm font-semibold text-app-warning-text">
                                                {item.artifactIdentifier}
                                            </p>

                                            <p className="mt-2 break-words text-sm text-app-text-muted">
                                                {item.reason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState value="No failed items reported for this source." />
                            )}
                        </div>

                        <div>
                            <SectionTitle>
                                Recent Runs
                            </SectionTitle>

                            {recentRuns.length > 0 ? (
                                <div className="space-y-3">
                                    {recentRuns.map((run) => (
                                        <RunCard key={run.runId} run={run} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState value="No recent ingestion runs found for this source." />
                            )}
                        </div>
                    </div>
                </div>

                <div className="border-t border-app-border bg-app-surface px-6 py-5">
                    <button
                        type="button"
                        onClick={() => {
                            void loadSourceDetails();
                        }}
                        disabled={isLoading}
                        className="w-full rounded-xl bg-app-brand px-4 py-3 font-medium text-app-text-inverse transition hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <RefreshCw
                                size={16}
                                className={isLoading ? "animate-spin" : ""}
                            />
                            Refresh Details
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}

function SectionTitle({
                          children,
                      }: {
    children: ReactNode;
}) {
    return (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-subtle">
            {children}
        </p>
    );
}

function InfoCard({
                      label,
                      value,
                      danger = false,
                  }: {
    label: string;
    value: string;
    danger?: boolean;
}) {
    return (
        <div className="rounded-xl border border-app-border bg-app-surface-muted p-4">
            <p className="text-xs uppercase tracking-wide text-app-text-subtle">
                {label}
            </p>

            <p
                className={`mt-2 break-words font-semibold ${
                    danger ? "text-app-danger-text" : "text-app-text"
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function StatusCard({
                        isHealthy,
                        icon: Icon,
                        title,
                        description,
                    }: {
    isHealthy: boolean;
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <div
            className={`flex items-start gap-4 rounded-xl border p-4 ${
                isHealthy
                    ? "border-app-border bg-app-surface-muted"
                    : "border-app-warning-border bg-app-warning-bg"
            }`}
        >
            <Icon
                size={18}
                className={`mt-0.5 shrink-0 ${
                    isHealthy ? "text-app-success-text" : "text-app-warning-solid"
                }`}
            />

            <div>
                <p
                    className={`text-sm font-semibold ${
                        isHealthy ? "text-app-text" : "text-app-warning-text"
                    }`}
                >
                    {title}
                </p>

                <p className="mt-1 text-sm text-app-text-muted">
                    {description}
                </p>
            </div>
        </div>
    );
}

function RunCard({ run }: { run: IngestionRun }) {
    return (
        <div className="rounded-xl border border-app-border bg-app-surface-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-app-text">
                        {formatDateTime(run.startedAt)}
                    </p>

                    <p className="mt-1 break-all text-xs text-app-text-subtle">
                        {run.runId}
                    </p>
                </div>

                <RunStatusBadge status={run.status} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-app-surface px-3 py-2">
                    <p className="text-app-text-subtle">Ingested</p>
                    <p className="mt-1 font-semibold text-app-text">
                        {formatNumber(run.ingestedCount)}
                    </p>
                </div>

                <div className="rounded-lg bg-app-surface px-3 py-2">
                    <p className="text-app-text-subtle">Updated</p>
                    <p className="mt-1 font-semibold text-app-text">
                        {formatNumber(run.updatedCount)}
                    </p>
                </div>

                <div className="rounded-lg bg-app-surface px-3 py-2">
                    <p className="text-app-text-subtle">Failed</p>
                    <p
                        className={`mt-1 font-semibold ${
                            run.failedCount > 0
                                ? "text-app-danger-text"
                                : "text-app-text"
                        }`}
                    >
                        {formatNumber(run.failedCount)}
                    </p>
                </div>
            </div>

            <p className="mt-3 text-xs text-app-text-subtle">
                Finished: {formatDateTime(run.finishedAt)}
            </p>
        </div>
    );
}

function RunStatusBadge({ status }: { status: IngestionRun["status"] }) {
    if (status === "SUCCESS") {
        return (
            <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
                Success
            </span>
        );
    }

    if (status === "RUNNING") {
        return (
            <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                Running
            </span>
        );
    }

    return (
        <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            Failed
        </span>
    );
}

function EmptyState({ value }: { value: string }) {
    return (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface-muted p-4 text-sm text-app-text-muted">
            {value}
        </div>
    );
}

function Badge({
                   children,
               }: {
    children: ReactNode;
}) {
    return (
        <span className="rounded-full bg-app-neutral-bg px-3 py-1 text-xs font-medium text-app-neutral-text">
            {children}
        </span>
    );
}

function BadgeSuccess({
                          children,
                      }: {
    children: ReactNode;
}) {
    return (
        <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
            {children}
        </span>
    );
}

function BadgeWarning({
                          children,
                      }: {
    children: ReactNode;
}) {
    return (
        <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            {children}
        </span>
    );
}

function BadgeNeutral({
                          children,
                      }: {
    children: ReactNode;
}) {
    return (
        <span className="rounded-full bg-app-surface-muted px-3 py-1 text-xs font-medium text-app-text-muted">
            {children}
        </span>
    );
}

function getSourceStatusLabel(hasNeverSynced: boolean, hasErrors: boolean) {
    if (hasNeverSynced) return "Not synced";
    if (hasErrors) return "Warning";
    return "Connected";
}

function formatDateTime(value: string | null) {
    if (!value) return "Never";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatNumber(value: number) {
    return new Intl.NumberFormat(undefined).format(value);
}