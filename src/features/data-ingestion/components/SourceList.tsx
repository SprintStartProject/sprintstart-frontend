import { ChevronRight, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import {
  deriveConnectionStatus,
  deriveSyncStatus,
  formatJiraInstanceDomain,
  formatNumber,
} from "../data.ts";
import type { DataSource } from "../types.ts";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { SourceStatusChip } from "./SourceStatusChip.tsx";
import { SourceTypeBadge } from "./SourceTypeBadge.tsx";

type SourceListProps = {
  sources: DataSource[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
  /** When set, the empty state offers a primary "connect" call to action. */
  onAddSource?: () => void;
};

/**
 * Lists all currently connected data sources with their high-level status.
 * Allows users to select a source to view more detailed metrics in the side panel.
 */
export function SourceList({
  sources,
  selectedSourceId,
  onSelectSource,
  onAddSource,
}: SourceListProps) {
  if (sources.length === 0) {
    return (
      <SpotlightCard roundedClassName="rounded-3xl">
        <div className="relative overflow-hidden rounded-3xl p-8 text-center sm:p-10">
          <div className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-app-brand-soft blur-3xl" />

          <div className="relative z-10 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-app-text">Connect your first source</h3>

            <p className="mt-2 max-w-md text-sm text-app-text-muted">
              Discover repositories from a GitHub organization or user and connect them to start
              ingesting artifacts into the knowledge base.
            </p>

            {onAddSource && (
              <Button
                variant="primary"
                size="lg"
                onClick={onAddSource}
                icon={<Plus className="h-4 w-4" />}
                className="mt-6"
              >
                Add sources
              </Button>
            )}
          </div>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sources.map((source) => {
        const Icon = source.icon;
        const isSelected = selectedSourceId === source.sourceId;

        return (
          <button
            key={source.sourceId}
            type="button"
            onClick={() => onSelectSource(source.sourceId)}
            // Same hover language as the dashboard widgets: a small lift, a
            // brand-coloured edge and a shadow, so "this is clickable" reads
            // identically wherever it appears in the app.
            className={`group flex h-full w-full cursor-pointer flex-col rounded-2xl border bg-app-surface p-4 text-left transition duration-200 focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg focus:outline-none motion-reduce:hover:translate-y-0 sm:p-6 ${
              isSelected
                ? "border-app-brand shadow-sm"
                : "border-app-border hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-lg"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft sm:h-14 sm:w-14">
                  <Icon className="h-5 w-5 text-app-text-muted sm:h-6 sm:w-6" />
                </div>

                <div className="min-w-0">
                  <div>
                    <h3 className="text-base font-semibold break-words text-app-text sm:text-lg">
                      {source.name}
                    </h3>

                    {source.githubRepository?.owner && (
                      <p className="mt-0.5 text-xs break-words text-app-text-subtle">
                        {source.githubRepository.owner}
                      </p>
                    )}

                    {source.jiraInstance?.instanceUrl && (
                      <p className="mt-0.5 text-xs break-words text-app-text-subtle">
                        {formatJiraInstanceDomain(source.jiraInstance.instanceUrl)}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SourceTypeBadge type={source.type} />

                      <SourceStatusChip status={deriveConnectionStatus(source)} />

                      <SourceStatusChip status={deriveSyncStatus(source)} />
                    </div>
                  </div>
                </div>
              </div>

              <ChevronRight
                size={20}
                className={`shrink-0 text-app-text-disabled transition ${
                  isSelected ? "rotate-180 text-app-brand" : "group-hover:translate-x-1"
                }`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:mt-6">
              <InfoBlock
                label="Artifacts Ingested"
                value={formatNumber(source.totalArtifactCount)}
              />

              <InfoBlock label="Last Sync" value={source.lastSync} />

              <InfoBlock label="Latest Updated" value={formatNumber(source.latestUpdatedCount)} />

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
                  Open the source details or check the backend response for failed artifact
                  identifiers and reasons.
                </p>
              </div>
            )}
          </button>
        );
      })}
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
      <p className="text-xs tracking-wide text-app-text-subtle uppercase">{label}</p>

      <p
        className={`mt-1 text-base font-semibold break-words sm:mt-2 sm:text-lg ${
          danger ? "text-app-danger-text" : "text-app-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
