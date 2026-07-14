import {
    RefreshCw,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { SidePanel } from "../../../components/ui/SidePanel";
import {
    getIngestionRuns,
    getIngestionStatus,
} from "../../../services/ingestionService.ts";
import {
    DETAILS_RUN_LIMIT,
    formatDateTime,
    formatNumber,
    formatRunFinishedAt,
    getRunStatusLabel,
    getRunStatusTone,
    getSourceStatus,
    getSourceStatusLabel,
} from "../data.ts";
import type {
    GithubRepositoryReference,
    IngestionRun,
    LoadingState,
    SourceDetailsSource,
    SourceIngestionStatus,
    SourceSystem,
    SourceStatus,
} from "../types.ts";

type SourceDetailsPanelProps = {
    source: SourceDetailsSource;
    githubRepository?: GithubRepositoryReference | null;
    onUpdateSource?: (sourceSystem: SourceSystem) => Promise<void>;
    onClose: () => void;
};

async function fetchSourceDetails(sourceSystem: SourceSystem) {
    const [statusData, runData] = await Promise.all([
        getIngestionStatus(),
        getIngestionRuns(DETAILS_RUN_LIMIT),
    ]);

    const currentSourceStatus =
        statusData.find((status) => status.sourceSystem === sourceSystem) ?? null;

    const currentSourceRuns = runData.filter(
        (run) => run.sourceSystem === sourceSystem,
    );

    return {
        sourceStatus: currentSourceStatus,
        recentRuns: currentSourceRuns,
    };
}

const EMPTY_RECENT_RUNS: IngestionRun[] = [];

/**
 * Slide-out panel showing detailed statistics and recent runs for a specific data source.
 * Allows users to manually trigger a refresh/update of the source.
 */
export function SourceDetailsPanel({
                                       source,
                                       githubRepository = null,
                                       onUpdateSource,
                                       onClose,
                                   }: SourceDetailsPanelProps) {
    const [loadingState, setLoadingState] = useState<LoadingState>("idle");
    const [updateState, setUpdateState] = useState<LoadingState>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);
    const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(
        null,
    );
    const [sourceStatus, setSourceStatus] =
        useState<SourceIngestionStatus | null>(null);
    const [recentRuns, setRecentRuns] = useState<IngestionRun[]>([]);
    const [loadedSourceSystem, setLoadedSourceSystem] =
        useState<SourceSystem | null>(null);

    const loadSourceDetails = useCallback(async () => {
        setLoadingState("loading");
        setErrorMessage(null);

        try {
            const result = await fetchSourceDetails(source.sourceSystem);

            setSourceStatus(result.sourceStatus);
            setRecentRuns(result.recentRuns);
            setLoadedSourceSystem(source.sourceSystem);
            setLoadingState("success");
        } catch (error) {
            setLoadedSourceSystem(source.sourceSystem);
            setLoadingState("error");
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to load source details",
            );
        }
    }, [source.sourceSystem]);

    useEffect(() => {
        let ignore = false;

        void fetchSourceDetails(source.sourceSystem)
            .then((result) => {
                if (ignore) return;

                setSourceStatus(result.sourceStatus);
                setRecentRuns(result.recentRuns);
                setLoadedSourceSystem(source.sourceSystem);
                setErrorMessage(null);
                setLoadingState("success");
            })
            .catch((error: unknown) => {
                if (ignore) return;

                setLoadedSourceSystem(source.sourceSystem);
                setLoadingState("error");
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to load source details",
                );
            });

        return () => {
            ignore = true;
        };
    }, [source.sourceSystem]);

    const hasLoadedSelectedSource = loadedSourceSystem === source.sourceSystem;

    const visibleSourceStatus = hasLoadedSelectedSource ? sourceStatus : null;
    const visibleRecentRuns = hasLoadedSelectedSource
        ? recentRuns
        : EMPTY_RECENT_RUNS;
    const visibleErrorMessage = hasLoadedSelectedSource ? errorMessage : null;

    const isLoading = loadingState === "loading" || !hasLoadedSelectedSource;
    const isUpdating = updateState === "loading";

    const handleUpdateSource = useCallback(async () => {
        if (!onUpdateSource) return;

        setUpdateState("loading");
        setUpdateMessage(null);
        setUpdateErrorMessage(null);

        try {
            await onUpdateSource(source.sourceSystem);
            setUpdateState("success");
            setUpdateMessage("Update started. The page will refresh while ingestion runs.");
            await loadSourceDetails();
        } catch (error) {
            setUpdateState("error");
            setUpdateErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to start source update",
            );
        }
    }, [loadSourceDetails, onUpdateSource, source.sourceSystem]);

    const details = useMemo(() => {
        const latestRun = visibleRecentRuns[0] ?? null;
        const ingestedCount =
            latestRun?.ingestedCount ??
            visibleSourceStatus?.ingestedCount ??
            source.latestIngestedCount ??
            source.artifacts;

        const updatedCount =
            latestRun?.updatedCount ??
            visibleSourceStatus?.updatedCount ??
            source.latestUpdatedCount ??
            0;

        const failedCount =
            latestRun?.failedCount ??
            visibleSourceStatus?.failedCount ??
            source.errors;

        const failedItems =
            latestRun?.failedItems ??
            visibleSourceStatus?.failedItems ??
            source.failedItems ??
            [];

        const lastSync = latestRun
            ? formatDateTime(latestRun.startedAt)
            : visibleSourceStatus?.lastRunTime !== undefined
                ? formatDateTime(visibleSourceStatus.lastRunTime)
                : source.lastSync;

        const hasNeverSynced =
            !latestRun &&
            (visibleSourceStatus?.lastRunTime === null ||
                lastSync === "Never");

        const hasErrors = failedCount > 0;
        const latestStatus =
            visibleSourceStatus?.status ?? latestRun?.status ?? null;
        const status: SourceStatus = getSourceStatus(
            hasNeverSynced,
            hasErrors,
            latestStatus,
        );

        return {
            status,
            statusLabel: getSourceStatusLabel(
                hasNeverSynced,
                hasErrors,
                latestStatus,
            ),
            ingestedCount,
            updatedCount,
            failedCount,
            failedItems,
            lastSync,
            hasNeverSynced,
            hasErrors,
        };
    }, [source, visibleRecentRuns, visibleSourceStatus]);

    return (
        <SidePanel
            isOpen
            onClose={onClose}
            title={source.name}
            description={`Latest ingestion data for ${source.sourceSystem}`}
            widthClassName="w-full max-w-[440px] sm:w-[440px]"
            overlayClassName="bg-app-overlay"
            panelBackgroundClassName="bg-app-surface"
            headerDividerClassName=""
            footerClassName="border-t border-app-border bg-app-surface px-6 py-5"
            closeAriaLabel="Close source details"
            footer={
                <div className="space-y-3">
                    {onUpdateSource && source.sourceSystem === "GITHUB" && (
                        <button
                            type="button"
                            onClick={() => {
                                void handleUpdateSource();
                            }}
                            disabled={isLoading || isUpdating}
                            className="w-full rounded-xl bg-app-brand px-4 py-3 font-medium text-app-text-inverse transition hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <RefreshCw
                                    size={16}
                                    className={isUpdating ? "animate-spin" : ""}
                                />
                                {githubRepository
                                    ? `Update ${githubRepository.owner}/${githubRepository.name}`
                                    : "Update GitHub repositories"}
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            void loadSourceDetails();
                        }}
                        disabled={isLoading || isUpdating}
                        className="w-full rounded-xl border border-app-border bg-app-surface-muted px-4 py-3 font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
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
            }
        >
                    <div className="space-y-7">
                        {visibleErrorMessage && (
                            <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                                {visibleErrorMessage}
                            </div>
                        )}

                        {updateMessage && (
                            <div className="rounded-2xl border border-app-success-border bg-app-success-bg px-4 py-3 text-sm text-app-success-text">
                                {updateMessage}
                            </div>
                        )}

                        {updateErrorMessage && (
                            <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                                {updateErrorMessage}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Badge>{source.type}</Badge>

                            {details.status === "connected" ? (
                                <BadgeSuccess>{details.statusLabel}</BadgeSuccess>
                            ) : details.status === "running" ? (
                                <BadgeRunning>{details.statusLabel}</BadgeRunning>
                            ) : (
                                <BadgeWarning>{details.statusLabel}</BadgeWarning>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard
                                label="Last Sync"
                                value={details.lastSync}
                            />

                            <InfoCard
                                label="Recent Runs"
                                value={formatNumber(visibleRecentRuns.length)}
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

                            {visibleRecentRuns.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleRecentRuns.map((run) => (
                                        <RunCard key={run.runId} run={run} />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState value="No recent ingestion runs found for this source." />
                            )}
                        </div>
                    </div>
        </SidePanel>
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
                Finished: {formatRunFinishedAt(run.finishedAt, run.status)}
            </p>
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

function BadgeRunning({
                          children,
                      }: {
    children: ReactNode;
}) {
    return (
        <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
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
