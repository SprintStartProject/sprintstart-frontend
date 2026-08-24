import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  GitBranch,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import {
  buildRunSourceLabels,
  formatDateTime,
  formatNumber,
  getRunSourceLabel,
  getRunStatusLabel,
  getRunStatusTone,
} from "../data.ts";
import type { DataSource, IngestionRun, SectionKey } from "../types.ts";

type OverviewSectionProps = {
  sources: DataSource[];
  totalArtifactCount: number;
  runs: IngestionRun[];
  /** Jump to another section (e.g. from a KPI tile). */
  onNavigate?: (section: SectionKey) => void;
};

/**
 * Overview band of the Data Ingestion page: at-a-glance health KPIs, a small
 * ingestion sparkline and the most recent run activity — all derived from the
 * same source/run data the rest of the page uses, so the summary can't drift
 * from the detail below it.
 */
export function OverviewSection({
  sources,
  totalArtifactCount,
  runs,
  onNavigate,
}: OverviewSectionProps) {
  const attention = sources.filter((source) => source.statusView.state === "attention").length;
  const syncErrors = sources.reduce((sum, source) => sum + source.errors, 0);

  const recentRuns = useMemo(
    () =>
      [...runs]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 4),
    [runs],
  );

  const runSourceLabels = useMemo(() => buildRunSourceLabels(sources), [sources]);

  const bySource = useMemo(() => {
    const ranked = [...sources]
      .filter((source) => source.totalArtifactCount > 0)
      .sort((a, b) => b.totalArtifactCount - a.totalArtifactCount)
      .slice(0, 6);
    const max = Math.max(...ranked.map((s) => s.totalArtifactCount), 1);
    const shareBase =
      totalArtifactCount > 0
        ? totalArtifactCount
        : Math.max(
            sources.reduce((sum, s) => sum + s.totalArtifactCount, 0),
            1,
          );
    return ranked.map((source) => ({
      id: source.sourceId,
      name: source.name,
      count: source.totalArtifactCount,
      pct: Math.max(4, Math.round((source.totalArtifactCount / max) * 100)),
      share: Math.round((source.totalArtifactCount / shareBase) * 100),
      attention: source.statusView.state === "attention",
    }));
  }, [sources, totalArtifactCount]);

  return (
    <section aria-label="Overview">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-app-text">Overview</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 xl:grid-cols-4">
        <Kpi
          label="Connected sources"
          value={formatNumber(sources.length)}
          foot="View all sources"
          icon={GitBranch}
          onClick={onNavigate ? () => onNavigate("sources") : undefined}
        />
        <Kpi
          label="Artifacts indexed"
          value={formatNumber(totalArtifactCount)}
          foot="stored for this project"
          icon={Database}
        />
        <Kpi
          label="Sync errors"
          value={formatNumber(syncErrors)}
          foot={syncErrors > 0 ? "Review failing sources" : "No failed items"}
          icon={XCircle}
          tone={syncErrors > 0 ? "warning" : "neutral"}
          onClick={onNavigate && syncErrors > 0 ? () => onNavigate("sources") : undefined}
        />
        <Kpi
          label="Needs attention"
          value={formatNumber(attention)}
          foot={attention > 0 ? "Review these sources" : "All healthy"}
          icon={AlertTriangle}
          tone={attention > 0 ? "warning" : "neutral"}
          onClick={onNavigate && attention > 0 ? () => onNavigate("sources") : undefined}
        />
      </div>

      {/* Only splits into two columns at `xl`. Below that the 286px sidebar
          plus the wide page gutters leave the right column too narrow for the
          activity rows, which then pushed the whole page wider (a horizontal
          scrollbar). `minmax(0, …)` keeps the tracks shrink-safe so their
          content can never expand the grid past its container. */}
      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-app-border bg-app-surface p-5">
          <h3 className="text-sm font-bold text-app-text">Artifacts by source</h3>
          <p className="mt-0.5 text-xs text-app-text-subtle">
            How many ingested artifacts each source contributes
          </p>

          {bySource.length > 0 ? (
            <>
              <ul className="mt-4 space-y-3">
                {bySource.map((row) => (
                  <li key={row.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-app-text">{row.name}</span>
                      <span className="shrink-0 font-semibold text-app-text tabular-nums">
                        {formatNumber(row.count)}
                        <span className="ml-1 font-normal text-app-text-subtle">
                          ({row.share}%)
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-app-bg-soft"
                      role="img"
                      aria-label={`${row.name}: ${formatNumber(row.count)} artifacts (${row.share}% of total)`}
                    >
                      <span
                        className={`block h-full rounded-full ${
                          row.attention ? "bg-app-warning-solid" : "bg-app-brand"
                        }`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between border-t border-app-border pt-3 text-xs">
                <span className="text-app-text-subtle">Total artifacts</span>
                <span className="font-semibold text-app-text tabular-nums">
                  {formatNumber(totalArtifactCount)}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-8 text-center text-sm text-app-text-muted">
              No artifacts ingested yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-app-border bg-app-surface p-5">
          <h3 className="text-sm font-bold text-app-text">Recent activity</h3>
          <p className="mt-0.5 text-xs text-app-text-subtle">Latest ingestion runs</p>

          {recentRuns.length > 0 ? (
            <ul className="mt-3">
              {recentRuns.map((run) => (
                <ActivityRow
                  key={run.runId}
                  run={run}
                  sourceLabel={getRunSourceLabel(run, runSourceLabels)}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-sm text-app-text-muted">No ingestion runs yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

const TONE_TILE: Record<string, string> = {
  brand: "text-app-brand-text",
  warning: "text-app-warning-solid",
  success: "text-app-success-text",
  neutral: "text-app-text-muted",
};

function Kpi({
  label,
  value,
  foot,
  icon: Icon,
  tone = "brand",
  iconSpin = false,
  onClick,
}: {
  label: string;
  value: string;
  foot: string;
  icon: LucideIcon;
  tone?: "brand" | "warning" | "success" | "neutral";
  iconSpin?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] text-app-text-muted">{label}</span>
        <Icon
          size={20}
          className={`shrink-0 ${TONE_TILE[tone]} ${iconSpin ? "animate-spin" : ""}`}
        />
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight text-app-text tabular-nums sm:text-3xl">
        {value}
      </p>
      <p
        className={`mt-1 flex items-center gap-1 text-xs ${
          onClick ? "font-medium text-app-brand-text" : "text-app-text-subtle"
        }`}
      >
        <span className="min-w-0 truncate">{foot}</span>
        {onClick && <ArrowRight className="h-3 w-3 shrink-0" />}
      </p>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-[18px]">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-app-border bg-app-surface p-4 text-left transition hover:border-app-brand-border focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none sm:p-[18px]"
    >
      {body}
    </button>
  );
}

function ActivityRow({ run, sourceLabel }: { run: IngestionRun; sourceLabel: string }) {
  const tone = getRunStatusTone(run.status);
  const label = getRunStatusLabel(run.status);

  // Failed/partial runs use the danger palette so the label stays red on red;
  // the warning palette pairs amber-yellow text with a red-looking background.
  const toneClass =
    tone === "success"
      ? "bg-app-success-bg text-app-success-text"
      : tone === "running"
        ? "bg-app-brand-soft text-app-brand-text"
        : "bg-app-danger-bg text-app-danger-text";

  return (
    <li className="flex items-center gap-3 border-t border-app-border py-2 first:border-t-0">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        {tone === "success" ? (
          <CheckCircle2 size={15} />
        ) : tone === "running" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <AlertTriangle size={15} />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-app-text">{sourceLabel}</p>
        <p className="text-[11.5px] text-app-text-subtle">
          {formatNumber(run.ingestedCount)} artifacts
        </p>
      </div>

      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold ${toneClass}`}
        >
          {label}
        </span>
        <span className="text-[11.5px] text-app-text-subtle">{formatDateTime(run.startedAt)}</span>
      </div>
    </li>
  );
}
