import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Database,
    FileText,
    GitBranch,
    Plus,
    RefreshCw,
    type LucideIcon,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";
import {
    SourceDetailsPanel,
    type SourceDetailsSource,
} from "../components/data-ingestion/SourceDetailsPanel.tsx";
import { connectGithubRepository } from "../services/sources/githubService.ts";
import {
    getIngestionRuns,
    getIngestionStatus,
} from "../services/ingestionService.ts";
import type {
    IngestionRun,
    SourceIngestionStatus,
    SourceSystem,
} from "../types/ingestionTypes.ts";
import {SourceConnectModal} from "../components/data-ingestion/SourceConnectModal.tsx";

type ActiveTab = "sources" | "artifacts" | "runs";

type DataSourceStatus = "connected" | "warning";

type LoadingState = "idle" | "loading" | "success" | "error";

type ConnectState = "idle" | "loading" | "success" | "error";

type DataSource = SourceDetailsSource & {
    sourceSystem: SourceSystem;
    icon: LucideIcon;
    status: DataSourceStatus;
    statusLabel: string;
    lastRunAt: string | null;
    latestIngestedCount: number;
    latestUpdatedCount: number;
    failedItems: SourceIngestionStatus["failedItems"];
};

type SourceMeta = {
    name: string;
    type: string;
    icon: LucideIcon;
    description: string;
};

const SOURCE_SYSTEMS: SourceSystem[] = ["GITHUB", "JIRA", "UPLOAD"];

const SOURCE_META: Record<SourceSystem, SourceMeta> = {
    GITHUB: {
        name: "GitHub Repository",
        type: "GitHub",
        icon: GitBranch,
        description:
            "Indexes repositories, README files, pull requests, issues and source files.",
    },
    JIRA: {
        name: "Jira Project Board",
        type: "Jira",
        icon: Database,
        description:
            "Indexes Jira issues, tasks, epics, comments and project-related metadata.",
    },
    UPLOAD: {
        name: "Uploaded Documentation",
        type: "Upload",
        icon: FileText,
        description:
            "Indexes manually uploaded documentation, markdown files and project knowledge.",
    },
};

const INGESTION_RUN_LIMIT = 50;

export function DataIngestionPage() {
    const [activeTab, setActiveTab] = useState<ActiveTab>("sources");
    const [selectedSourceSystem, setSelectedSourceSystem] =
        useState<SourceSystem | null>(null);

    const [sourceStatuses, setSourceStatuses] = useState<SourceIngestionStatus[]>(
        [],
    );
    const [runs, setRuns] = useState<IngestionRun[]>([]);
    const [loadingState, setLoadingState] = useState<LoadingState>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    const [selectedConnectSourceSystem, setSelectedConnectSourceSystem] =
        useState<SourceSystem>("GITHUB");

    const [githubOwner, setGithubOwner] = useState("");
    const [githubRepositoryName, setGithubRepositoryName] = useState("");

    const [connectState, setConnectState] = useState<ConnectState>("idle");
    const [connectErrorMessage, setConnectErrorMessage] = useState<string | null>(
        null,
    );
    const [connectSuccessMessage, setConnectSuccessMessage] = useState<
        string | null
    >(null);

    const loadData = useCallback(async () => {
        setLoadingState("loading");
        setErrorMessage(null);

        try {
            const [statusData, runData] = await Promise.all([
                getIngestionStatus(),
                getIngestionRuns(INGESTION_RUN_LIMIT),
            ]);

            setSourceStatuses(statusData);
            setRuns(runData);
            setLoadingState("success");
        } catch (error) {
            setLoadingState("error");
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Failed to load ingestion data",
            );
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleOpenSourceModal = () => {
        setConnectState("idle");
        setConnectErrorMessage(null);
        setSelectedConnectSourceSystem("GITHUB");
        setIsSourceModalOpen(true);
    };

    const handleCloseSourceModal = () => {
        if (connectState === "loading") return;

        setIsSourceModalOpen(false);
        setConnectState("idle");
        setConnectErrorMessage(null);
    };

    const handleConnectSource = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            setConnectState("loading");
            setConnectErrorMessage(null);
            setConnectSuccessMessage(null);

            try {
                if (selectedConnectSourceSystem !== "GITHUB") {
                    throw new Error(
                        `${SOURCE_META[selectedConnectSourceSystem].type} connection is not available yet.`,
                    );
                }

                const trimmedOwner = githubOwner.trim();
                const trimmedRepositoryName = githubRepositoryName.trim();

                if (!trimmedOwner || !trimmedRepositoryName) {
                    throw new Error(
                        "Please enter both repository owner and repository name.",
                    );
                }

                await connectGithubRepository({
                    owner: trimmedOwner,
                    name: trimmedRepositoryName,
                });

                setConnectState("success");
                setConnectSuccessMessage(
                    `GitHub repository "${trimmedOwner}/${trimmedRepositoryName}" connected. Initial ingestion is running in the background.`,
                );

                setGithubOwner("");
                setGithubRepositoryName("");
                setIsSourceModalOpen(false);
                setActiveTab("sources");

                await loadData();

                window.setTimeout(() => {
                    void loadData();
                }, 1500);
            } catch (error) {
                setConnectState("error");
                setConnectErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to connect source",
                );
            }
        },
        [
            githubOwner,
            githubRepositoryName,
            loadData,
            selectedConnectSourceSystem,
        ],
    );

    const sources = useMemo<DataSource[]>(() => {
        const statusBySource = new Map<SourceSystem, SourceIngestionStatus>();

        sourceStatuses.forEach((status) => {
            statusBySource.set(status.sourceSystem, status);
        });

        return SOURCE_SYSTEMS.map((sourceSystem) =>
            createDataSource(sourceSystem, statusBySource.get(sourceSystem)),
        );
    }, [sourceStatuses]);

    const selectedSource = useMemo(() => {
        if (!selectedSourceSystem) return null;

        return (
            sources.find((source) => source.sourceSystem === selectedSourceSystem) ??
            null
        );
    }, [selectedSourceSystem, sources]);

    const isDetailsOpen = selectedSource !== null;
    const isLoading = loadingState === "loading";

    const syncedSources = sources.filter((source) => source.lastRunAt !== null).length;
    const latestIngestedArtifacts = sources.reduce(
        (sum, source) => sum + source.latestIngestedCount,
        0,
    );
    const totalErrors = sources.reduce((sum, source) => sum + source.errors, 0);

    return (
        <div className="min-h-screen bg-app-bg">
            <div
                className={`transition-[padding] duration-300 ease-out ${
                    isDetailsOpen ? "xl:pr-[440px]" : ""
                }`}
            >
                <header className="border-b border-app-border bg-app-surface">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="font-heading text-3xl font-bold text-app-text">
                                    Data Ingestion
                                </h1>

                                <p className="mt-2 text-sm text-app-text-muted">
                                    Manage connected sources, indexed artifacts and ingestion runs.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <select
                                    disabled
                                    title="Project selection is currently not provided by the ingestion service."
                                    className="w-full cursor-not-allowed rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-muted outline-none opacity-70 sm:w-auto"
                                >
                                    <option>Current Project</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => {
                                        void loadData();
                                    }}
                                    disabled={isLoading}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RefreshCw
                                        size={16}
                                        className={isLoading ? "animate-spin" : ""}
                                    />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="space-y-8">
                        {errorMessage && (
                            <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-5 py-4 text-sm text-app-warning-text">
                                {errorMessage}
                            </div>
                        )}

                        {connectSuccessMessage && (
                            <div className="flex flex-col gap-3 rounded-2xl border border-app-success-border bg-app-success-bg px-5 py-4 text-sm text-app-success-text sm:flex-row sm:items-center sm:justify-between">
                                <p>{connectSuccessMessage}</p>

                                <button
                                    type="button"
                                    onClick={() => setConnectSuccessMessage(null)}
                                    className="self-start rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-app-surface sm:self-auto"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="Synced Sources"
                                value={`${syncedSources}/${sources.length}`}
                                subtitle="sources with at least one ingestion run"
                                icon={CheckCircle2}
                                iconColor="text-app-success-text"
                            />

                            <MetricCard
                                title="Latest Ingested"
                                value={formatNumber(latestIngestedArtifacts)}
                                subtitle="from latest source statuses"
                                icon={Database}
                                iconColor="text-app-brand"
                            />

                            <MetricCard
                                title="Sync Errors"
                                value={formatNumber(totalErrors)}
                                subtitle="failed items from latest statuses"
                                icon={AlertTriangle}
                                iconColor="text-app-warning-solid"
                            />

                            <MetricCard
                                title="Stale Artifacts"
                                value="N/A"
                                subtitle="not provided by current service"
                                icon={Clock3}
                                iconColor="text-app-warning-solid"
                            />
                        </div>

                        <section className="overflow-hidden rounded-3xl border border-app-border bg-app-surface">
                            <div className="flex flex-col gap-4 border-b border-app-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="max-w-full overflow-x-auto">
                                    <div className="flex w-max rounded-xl bg-app-bg-soft p-1">
                                        {(["sources", "artifacts", "runs"] as ActiveTab[]).map(
                                            (tab) => (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    onClick={() => setActiveTab(tab)}
                                                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                                                        activeTab === tab
                                                            ? "bg-app-brand text-app-text-inverse"
                                                            : "text-app-text-muted hover:text-app-text"
                                                    }`}
                                                >
                                                    {tab}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleOpenSourceModal}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-app-text-inverse transition hover:bg-app-brand-hover"
                                >
                                    <Plus size={16} />
                                    Add Source
                                </button>
                            </div>

                            <div className="space-y-4 p-5 sm:p-6">
                                {isLoading && sources.every((source) => source.lastRunAt === null) ? (
                                    <LoadingState />
                                ) : null}

                                {!isLoading && activeTab === "sources" ? (
                                    <SourcesTab
                                        sources={sources}
                                        selectedSourceSystem={selectedSourceSystem}
                                        onSelectSource={setSelectedSourceSystem}
                                    />
                                ) : null}

                                {!isLoading && activeTab === "artifacts" ? (
                                    <UnsupportedTab
                                        title="Artifacts overview"
                                        description="The current ingestion service does not expose a list of indexed artifacts yet. It only provides aggregated ingestion status values."
                                    />
                                ) : null}

                                {!isLoading && activeTab === "runs" ? (
                                    <RunsTab runs={runs} />
                                ) : null}
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {selectedSource && (
                <SourceDetailsPanel
                    source={selectedSource}
                    onClose={() => setSelectedSourceSystem(null)}
                />
            )}

            {isSourceModalOpen && (
                <SourceConnectModal
                    selectedSourceSystem={selectedConnectSourceSystem}
                    sourceSystems={SOURCE_SYSTEMS}
                    sourceMeta={SOURCE_META}
                    owner={githubOwner}
                    repositoryName={githubRepositoryName}
                    connectState={connectState}
                    errorMessage={connectErrorMessage}
                    onSourceSystemChange={(sourceSystem) => {
                        setSelectedConnectSourceSystem(sourceSystem);
                        setConnectState("idle");
                        setConnectErrorMessage(null);
                    }}
                    onOwnerChange={setGithubOwner}
                    onRepositoryNameChange={setGithubRepositoryName}
                    onClose={handleCloseSourceModal}
                    onSubmit={(event) => {
                        void handleConnectSource(event);
                    }}
                />
            )}
        </div>
    );
}

function SourcesTab({
                        sources,
                        selectedSourceSystem,
                        onSelectSource,
                    }: {
    sources: DataSource[];
    selectedSourceSystem: SourceSystem | null;
    onSelectSource: (sourceSystem: SourceSystem) => void;
}) {
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

function RunsTab({ runs }: { runs: IngestionRun[] }) {
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
                                {formatDateTime(run.finishedAt)}
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

function UnsupportedTab({
                            title,
                            description,
                        }: {
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
            <h3 className="text-lg font-semibold text-app-text">{title}</h3>

            <p className="mx-auto mt-2 max-w-2xl text-sm text-app-text-muted">
                {description}
            </p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-brand border-t-transparent" />

            <h3 className="mt-4 text-lg font-semibold text-app-text">
                Loading ingestion data
            </h3>

            <p className="mt-2 text-sm text-app-text-muted">
                Fetching source statuses and recent ingestion runs from the backend.
            </p>
        </div>
    );
}

function MetricCard({
                        title,
                        value,
                        subtitle,
                        icon: Icon,
                        iconColor,
                    }: {
    title: string;
    value: string;
    subtitle: string;
    icon: LucideIcon;
    iconColor: string;
}) {
    return (
        <div className="rounded-3xl border border-app-border bg-app-surface p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm text-app-text-muted">{title}</p>

                    <h3 className="mt-3 text-4xl font-bold text-app-text">
                        {value}
                    </h3>

                    <p className="mt-2 text-sm text-app-text-muted">{subtitle}</p>
                </div>

                <Icon size={22} className={`shrink-0 ${iconColor}`} />
            </div>
        </div>
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

    return (
        <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
            {source.statusLabel}
        </span>
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

function createDataSource(
    sourceSystem: SourceSystem,
    status?: SourceIngestionStatus,
): DataSource {
    const meta = SOURCE_META[sourceSystem];
    const latestIngestedCount = status?.ingestedCount ?? 0;
    const latestUpdatedCount = status?.updatedCount ?? 0;
    const failedCount = status?.failedCount ?? 0;
    const lastRunAt = status?.lastRunTime ?? null;

    const hasNeverSynced = lastRunAt === null;
    const hasErrors = failedCount > 0;

    return {
        sourceSystem,
        name: meta.name,
        type: meta.type,
        icon: meta.icon,
        status: hasNeverSynced || hasErrors ? "warning" : "connected",
        statusLabel: getSourceStatusLabel(hasNeverSynced, hasErrors),
        artifacts: latestIngestedCount,
        lastSync: formatDateTime(lastRunAt),
        nextSync: "Not available",
        errors: failedCount,
        description: meta.description,
        lastRunAt,
        latestIngestedCount,
        latestUpdatedCount,
        failedItems: status?.failedItems ?? [],
    };
}

function getSourceStatusLabel(hasNeverSynced: boolean, hasErrors: boolean) {
    if (hasNeverSynced) return "Not synced";
    if (hasErrors) return "Warning";
    return "Connected";
}

function getSourceLabel(sourceSystem: SourceSystem) {
    return SOURCE_META[sourceSystem].type;
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