import { ChevronDown, ChevronUp, CheckCircle2, ListTree, XCircle } from "lucide-react";
import { formatConfiguredAt } from "../data.ts";
import type { ConnectorListItem } from "../types.ts";
import { ConnectorSourcesSection } from "./ConnectorSourcesSection.tsx";

type ConnectorListProps = {
    connectors: ConnectorListItem[];
    togglingConnectorId: string | null;
    expandedConnectorId: string | null;
    onToggleEnabled: (connector: ConnectorListItem) => void;
    onToggleSources: (connector: ConnectorListItem) => void;
    onSourcesSaved?: () => void;
};

/**
 * Stacked list of registered connectors. Each card lets a PM/Admin globally
 * enable or disable the connector, and expand an inline section to allow/deny
 * individual in-scope sources (e.g. connected repositories).
 *
 * Enabled/disabled state is always conveyed via both an icon and a text
 * label (not color alone), per the app's color-blind accessibility rules.
 */
export function ConnectorList({
    connectors,
    togglingConnectorId,
    expandedConnectorId,
    onToggleEnabled,
    onToggleSources,
    onSourcesSaved,
}: ConnectorListProps) {
    if (connectors.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
                <p className="text-sm font-medium text-app-text">No connectors registered</p>
                <p className="mt-1 text-sm text-app-text-muted">
                    Connectors will appear here once they are registered on the backend.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {connectors.map((connector) => {
                const Icon = connector.meta.icon;
                const isToggling = togglingConnectorId === connector.id;
                const isExpanded = expandedConnectorId === connector.id;

                return (
                    <div
                        key={connector.id}
                        className="flex flex-col gap-4 rounded-2xl border border-app-border bg-app-surface p-5"
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface-muted text-app-text-muted">
                                    <Icon className="h-5 w-5" />
                                </div>

                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-app-text">
                                        {connector.meta.label}
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-app-text-muted">
                                        {connector.id}
                                    </p>
                                    <p className="mt-2 text-sm text-app-text-muted">
                                        {connector.meta.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 sm:items-end">
                                {connector.enabled ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-sm font-medium text-app-success-text">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Enabled
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-app-neutral-border bg-app-neutral-bg px-3 py-1 text-sm font-medium text-app-neutral-text">
                                        <XCircle className="h-4 w-4" />
                                        Disabled
                                    </span>
                                )}

                                <p className="text-xs text-app-text-subtle">
                                    Last configured: {formatConfiguredAt(connector.lastConfiguredAt)}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => onToggleEnabled(connector)}
                                disabled={isToggling}
                                className={[
                                    "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                                    connector.enabled
                                        ? "border-app-danger-border bg-app-danger-bg text-app-danger-text hover:bg-app-danger-solid hover:text-white"
                                        : "border-app-brand-border-strong bg-app-brand text-app-text-inverse hover:bg-app-brand-hover",
                                ].join(" ")}
                            >
                                {isToggling
                                    ? "Saving..."
                                    : connector.enabled
                                        ? "Disable connector"
                                        : "Enable connector"}
                            </button>

                            <button
                                type="button"
                                onClick={() => onToggleSources(connector)}
                                aria-expanded={isExpanded}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface-muted px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover"
                            >
                                <ListTree className="h-4 w-4" />
                                {isExpanded ? "Hide sources" : "Manage sources"}
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                        </div>

                        {isExpanded && (
                            <ConnectorSourcesSection
                                connector={connector}
                                onSourcesSaved={onSourcesSaved}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
