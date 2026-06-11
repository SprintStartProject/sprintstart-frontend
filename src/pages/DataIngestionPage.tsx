import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Database,
    GitBranch,
    Plus,
    type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
    SourceDetailsPanel,
    type SourceDetailsSource,
} from "../components/data-ingestion/SourceDetailsPanel.tsx";

type DataSource = SourceDetailsSource & {
    icon: LucideIcon;
};

export function DataIngestionPage() {
    const [activeTab, setActiveTab] = useState("sources");
    const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);

    const sources: DataSource[] = [
        {
            name: "Frontend GitHub Repository",
            type: "GitHub",
            icon: GitBranch,
            status: "connected",
            artifacts: 428,
            lastSync: "12 minutes ago",
            nextSync: "in 48 minutes",
            errors: 0,
            description:
                "Indexes repositories, README files, pull requests, branches and source files.",
        }
    ];

    const isDetailsOpen = selectedSource !== null;

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

                            <select className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-brand sm:w-auto">
                                <option>Project Alpha</option>
                                <option>Project Beta</option>
                            </select>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="space-y-8">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="Connected Sources"
                                value="2/4"
                                subtitle="available for the chatbot"
                                icon={CheckCircle2}
                                iconColor="text-app-success-text"
                            />

                            <MetricCard
                                title="Indexed Artifacts"
                                value="1000"
                                subtitle="docs, tickets, repos"
                                icon={Database}
                                iconColor="text-app-brand"
                            />

                            <MetricCard
                                title="Sync Errors"
                                value="21"
                                subtitle="needs review before next run"
                                icon={AlertTriangle}
                                iconColor="text-app-warning-solid"
                            />

                            <MetricCard
                                title="Stale Artifacts"
                                value="1"
                                subtitle="older than threshold"
                                icon={Clock3}
                                iconColor="text-app-warning-solid"
                            />
                        </div>

                        <section className="overflow-hidden rounded-3xl border border-app-border bg-app-surface">
                            <div className="flex flex-col gap-4 border-b border-app-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="max-w-full overflow-x-auto">
                                    <div className="flex w-max rounded-xl bg-app-bg-soft p-1">
                                        {["sources", "artifacts", "runs"].map((tab) => (
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
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-app-text-inverse transition hover:bg-app-brand-hover"
                                >
                                    <Plus size={16} />
                                    Add Source
                                </button>
                            </div>

                            <div className="space-y-4 p-5 sm:p-6">
                                {activeTab === "sources" ? (
                                    sources.map((source) => {
                                        const Icon = source.icon;
                                        const isSelected = selectedSource?.name === source.name;

                                        return (
                                            <button
                                                key={source.name}
                                                type="button"
                                                onClick={() => setSelectedSource(source)}
                                                className={`group w-full cursor-pointer rounded-2xl border bg-app-surface p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg sm:p-6 ${
                                                    isSelected
                                                        ? "border-app-brand shadow-sm"
                                                        : "border-app-border hover:border-app-brand-border"
                                                }`}
                                            >
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft">
                                                            <Icon
                                                                size={24}
                                                                className="text-app-text-muted"
                                                            />
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h3 className="break-words text-lg font-semibold text-app-text">
                                                                    {source.name}
                                                                </h3>

                                                                <span className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                                                                    {source.type}
                                                                </span>

                                                                {source.status === "connected" ? (
                                                                    <span className="rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-medium text-app-success-text">
                                                                        Connected
                                                                    </span>
                                                                ) : (
                                                                    <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
                                                                        Warning
                                                                    </span>
                                                                )}
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
                                                        label="Artifacts"
                                                        value={source.artifacts.toString()}
                                                    />

                                                    <InfoBlock
                                                        label="Last Sync"
                                                        value={source.lastSync}
                                                    />

                                                    <InfoBlock
                                                        label="Next Sync"
                                                        value={source.nextSync}
                                                    />

                                                    <InfoBlock
                                                        label="Errors"
                                                        value={source.errors.toString()}
                                                        danger={source.errors > 0}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
                                        <h3 className="text-lg font-semibold text-app-text">
                                            {activeTab === "artifacts"
                                                ? "Artifacts overview"
                                                : "Ingestion runs"}
                                        </h3>

                                        <p className="mt-2 text-sm text-app-text-muted">
                                            This tab is ready for your table or list component.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {selectedSource && (
                <SourceDetailsPanel
                    source={selectedSource}
                    onClose={() => setSelectedSource(null)}
                />
            )}
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
                    <p className="text-sm text-app-text-muted">
                        {title}
                    </p>

                    <h3 className="mt-3 text-4xl font-bold text-app-text">
                        {value}
                    </h3>

                    <p className="mt-2 text-sm text-app-text-muted">
                        {subtitle}
                    </p>
                </div>

                <Icon
                    size={22}
                    className={`shrink-0 ${iconColor}`}
                />
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
                    danger
                        ? "text-app-danger-text"
                        : "text-app-text"
                }`}
            >
                {value}
            </p>
        </div>
    );
}