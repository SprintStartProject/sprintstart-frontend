import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ListTree,
  XCircle,
} from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { formatConfiguredAt } from "../data.ts";
import type { ConnectorListItem } from "../types.ts";
import { ConnectorSourcesSection } from "./ConnectorSourcesSection.tsx";

type ConnectorListProps = {
  connectors: ConnectorListItem[];
  togglingConnectorId: string | null;
  expandedConnectorId: string | null;
  /** Scopes the per-connector source list to a project. */
  projectId?: string | null;
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
  projectId,
  onToggleEnabled,
  onToggleSources,
  onSourcesSaved,
}: ConnectorListProps) {
  if (connectors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
        <p className="text-sm font-medium text-app-text">
          No connectors registered
        </p>
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
                  // Red, matching the source badges: a disabled connector stops
                  // every one of its sources from reaching chat.
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-app-danger-border bg-app-danger-bg px-3 py-1 text-sm font-medium text-app-danger-text">
                    <XCircle className="h-4 w-4" />
                    Disabled
                  </span>
                )}

                <p className="text-xs text-app-text-subtle">
                  Last configured:{" "}
                  {formatConfiguredAt(connector.lastConfiguredAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant={connector.enabled ? "dangerSoft" : "primary"}
                onClick={() => onToggleEnabled(connector)}
                loading={isToggling}
                className="flex-1"
              >
                {isToggling
                  ? "Saving..."
                  : connector.enabled
                    ? "Disable connector"
                    : "Enable connector"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => onToggleSources(connector)}
                aria-expanded={isExpanded}
                icon={<ListTree className="h-4 w-4" />}
                trailingIcon={
                  isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )
                }
                className="flex-1"
              >
                {isExpanded ? "Hide sources" : "Manage sources"}
              </Button>
            </div>

            {isExpanded && (
              <ConnectorSourcesSection
                connector={connector}
                projectId={projectId}
                onSourcesSaved={onSourcesSaved}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
