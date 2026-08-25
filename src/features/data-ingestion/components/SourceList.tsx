import {
  ArrowUp,
  ChevronRight,
  Clock3,
  Database,
  Plus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
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
            // Mobile: onboarding-style card (scale + brand-soft fill on select).
            // From `sm` up: the original card (subtle lift, 2x2 stat grid below).
            className={`group flex h-full w-full cursor-pointer flex-col rounded-2xl border p-5 text-left transition-all duration-200 focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg focus:outline-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 sm:p-6 ${
              isSelected
                ? "border-app-brand bg-app-brand-soft sm:bg-app-surface sm:shadow-sm"
                : "border-app-border bg-app-surface hover:scale-[1.01] hover:border-app-brand-border-strong hover:shadow-lg sm:hover:-translate-y-0.5 sm:hover:scale-100"
            }`}
          >
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft text-app-text-muted sm:h-14 sm:w-14">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-app-text sm:overflow-visible sm:text-lg sm:break-words sm:whitespace-normal">
                      {source.name}
                    </h3>

                    {source.githubRepository?.owner && (
                      <p className="mt-0.5 truncate text-xs text-app-text-subtle sm:overflow-visible sm:break-words sm:whitespace-normal">
                        {source.githubRepository.owner}
                      </p>
                    )}

                    {source.jiraInstance?.instanceUrl && (
                      <p className="mt-0.5 truncate text-xs text-app-text-subtle sm:overflow-visible sm:break-words sm:whitespace-normal">
                        {formatJiraInstanceDomain(source.jiraInstance.instanceUrl)}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    size={20}
                    className={`mt-0.5 shrink-0 text-app-text-disabled transition ${
                      isSelected ? "rotate-180 text-app-brand" : "group-hover:translate-x-1"
                    }`}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <SourceTypeBadge type={source.type} />

                  <SourceStatusChip status={deriveConnectionStatus(source)} />

                  <SourceStatusChip status={deriveSyncStatus(source)} />
                </div>

                {/* Mobile stats: clean inline metrics + a subtle timestamp line. */}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:hidden">
                  <Metric
                    icon={Database}
                    value={formatNumber(source.totalArtifactCount)}
                    label="artifacts"
                  />

                  <Metric
                    icon={ArrowUp}
                    value={formatNumber(source.latestUpdatedCount)}
                    label="updated"
                  />

                  <Metric
                    icon={XCircle}
                    value={formatNumber(source.errors)}
                    label="errors"
                    danger={source.errors > 0}
                  />
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-xs text-app-text-subtle sm:hidden">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  <span>Last synced</span>
                  <span className="font-medium text-app-text-muted">{source.lastSync}</span>
                </p>
              </div>
            </div>

            {/* Desktop stats (>=sm): the original 2x2 stat grid, full card width. */}
            <div className="mt-6 hidden grid-cols-2 gap-4 sm:grid">
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

            {source.failedItems.length > 0 && <FailedItemsNote count={source.failedItems.length} />}
          </button>
        );
      })}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  danger = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        className={`h-4 w-4 shrink-0 ${danger ? "text-app-danger-text" : "text-app-text-muted"}`}
      />
      <span
        className={`font-semibold tabular-nums ${danger ? "text-app-danger-text" : "text-app-text"}`}
      >
        {value}
      </span>
      <span className="text-app-text-muted">{label}</span>
    </span>
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
        className={`mt-2 text-lg font-semibold break-words ${
          danger ? "text-app-danger-text" : "text-app-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FailedItemsNote({ count }: { count: number }) {
  return (
    <div className="mt-5 rounded-2xl border border-app-warning-border bg-app-warning-bg p-4">
      <p className="text-sm font-semibold text-app-warning-text">
        {count} failed item{count === 1 ? "" : "s"} in latest status
      </p>

      <p className="mt-1 text-sm text-app-text-muted">
        Open the source details or check the backend response for failed artifact identifiers and
        reasons.
      </p>
    </div>
  );
}
