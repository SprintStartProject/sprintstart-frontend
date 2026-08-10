import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  type LucideIcon,
} from "lucide-react";
import { formatNumber } from "../data.ts";
import type { DataSource } from "../types.ts";

type IngestionMetricsProps = {
  sources: DataSource[];
  totalArtifactCount?: number;
  /**
   * Renders a slim row of inline stat chips (icon + value + label, no
   * card borders) instead of the full metric-card grid, for tight spaces
   * like the PM Dashboard's ingestion strip.
   */
  compact?: boolean;
};

/**
 * Displays high-level summary metrics for all connected data sources.
 * Gives project managers a quick overview of system health and sync status.
 */
export function IngestionMetrics({
  sources,
  totalArtifactCount,
  compact = false,
}: IngestionMetricsProps) {
  const syncedSources = sources.filter(
    (source) => source.lastRunAt !== null,
  ).length;
  const latestIngestedArtifacts = sources.reduce(
    (sum, source) => sum + source.latestIngestedCount,
    0,
  );
  const artifactCount = totalArtifactCount ?? latestIngestedArtifacts;
  const totalErrors = sources.reduce((sum, source) => sum + source.errors, 0);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <StatChip
          label="Synced"
          value={`${syncedSources}/${sources.length}`}
          icon={CheckCircle2}
          iconColor="text-app-success-text"
        />

        <StatChip
          label="Ingested"
          value={formatNumber(latestIngestedArtifacts)}
          icon={Database}
          iconColor="text-app-brand"
        />

        <StatChip
          label="Errors"
          value={formatNumber(totalErrors)}
          icon={AlertTriangle}
          iconColor={
            totalErrors > 0 ? "text-app-warning-solid" : "text-app-text-muted"
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Synced Sources"
        value={`${syncedSources}/${sources.length}`}
        subtitle="sources with at least one ingestion run"
        icon={CheckCircle2}
        iconColor="text-app-success-text"
      />

      <MetricCard
        title={
          totalArtifactCount === undefined
            ? "Latest Ingested"
            : "All Artifacts Ingested"
        }
        value={formatNumber(artifactCount)}
        subtitle={
          totalArtifactCount === undefined
            ? "from latest source statuses"
            : "stored artifacts for this project"
        }
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
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon size={14} className={`shrink-0 ${iconColor}`} />
      <span className="font-semibold text-app-text">{value}</span>
      <span className="text-app-text-muted">{label}</span>
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
    <div className="rounded-2xl border border-app-border bg-app-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-app-text-muted">{title}</p>

          <h3 className="mt-3 text-4xl font-bold text-app-text">{value}</h3>

          <p className="mt-2 text-sm text-app-text-muted">{subtitle}</p>
        </div>

        <Icon size={22} className={`shrink-0 ${iconColor}`} />
      </div>
    </div>
  );
}
