import {
    ExternalLink,
    RefreshCw,
    Settings,
    X,
} from "lucide-react";
import type { ReactNode } from "react";

export type SourceStatus = "connected" | "warning";

export type SourceDetailsSource = {
    name: string;
    type: string;
    status: SourceStatus;
    artifacts: number;
    lastSync: string;
    nextSync: string;
    errors: number;
    description: string;
};

type SourceDetailsPanelProps = {
    source: SourceDetailsSource;
    onClose: () => void;
};

export function SourceDetailsPanel({
                                       source,
                                       onClose,
                                   }: SourceDetailsPanelProps) {
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
                            Source details and ingestion configuration
                        </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            aria-label="Open source settings"
                            className="rounded-lg p-2 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text"
                        >
                            <Settings size={18} />
                        </button>

                        <button
                            type="button"
                            aria-label="Close source details"
                            onClick={onClose}
                            className="rounded-lg p-2 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-7">
                        <div className="flex flex-wrap gap-2">
                            <Badge>{source.type}</Badge>

                            {source.status === "connected" ? (
                                <BadgeSuccess>Connected</BadgeSuccess>
                            ) : (
                                <span className="rounded-full border border-app-warning-border bg-app-warning-bg px-3 py-1 text-xs font-medium text-app-warning-text">
                                    Warning
                                </span>
                            )}

                            <BadgeNeutral>
                                {source.artifacts} Artifacts
                            </BadgeNeutral>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard
                                label="Last Sync"
                                value={source.lastSync}
                            />

                            <InfoCard
                                label="Next Sync"
                                value={source.nextSync}
                            />

                            <InfoCard
                                label="Artifacts"
                                value={String(source.artifacts)}
                            />

                            <InfoCard
                                label="Errors"
                                value={String(source.errors)}
                                danger={source.errors > 0}
                            />
                        </div>

                        <Section
                            title="Configured Scope"
                            value="org/sprintstart-web, org/shared-ui"
                        />

                        <Section
                            title="Description"
                            value={source.description}
                        />

                        <div>
                            <SectionTitle>
                                Ingestion Pipeline
                            </SectionTitle>

                            <div className="space-y-3">
                                {[
                                    "Fetch source data",
                                    "Extract content",
                                    "Chunk & enrich metadata",
                                    "Index for chatbot",
                                ].map((step, index) => (
                                    <div
                                        key={step}
                                        className="flex items-center gap-4 rounded-xl border border-app-border bg-app-surface-muted p-4"
                                    >
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-brand text-sm font-bold text-app-text-inverse">
                                            {index + 1}
                                        </div>

                                        <span className="text-sm font-medium text-app-text">
                                            {step}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <SectionTitle>
                                Allowed Content
                            </SectionTitle>

                            <div className="flex flex-wrap gap-2">
                                {[
                                    "README",
                                    "Docs",
                                    "Tickets",
                                    "PRs",
                                    "Comments",
                                    "Reports",
                                ].map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-app-border bg-app-surface px-6 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            className="flex-1 rounded-xl bg-app-brand px-4 py-3 font-medium text-app-text-inverse transition hover:bg-app-brand-hover"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <RefreshCw size={16} />
                                Run Sync
                            </span>
                        </button>

                        <button
                            type="button"
                            className="flex-1 rounded-xl border border-app-border px-4 py-3 font-medium text-app-text transition hover:bg-app-surface-hover"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <ExternalLink size={16} />
                                Open Source
                            </span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

function Section({
                     title,
                     value,
                 }: {
    title: string;
    value: string;
}) {
    return (
        <div>
            <SectionTitle>
                {title}
            </SectionTitle>

            <div className="break-words rounded-xl border border-app-border bg-app-surface-muted p-4 text-sm leading-relaxed text-app-text">
                {value}
            </div>
        </div>
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