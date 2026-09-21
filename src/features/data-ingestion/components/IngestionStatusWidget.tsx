// ============================================================
// IngestionStatusWidget.tsx
// PM overview card — surfaces ingestion sync health (synced
// sources, ingested artifacts, errors) using the same
// `/api/v1/ingestion-status` endpoint and merge logic as the
// Data Ingestion page, so the PM area never re-implements
// ingestion status handling.
// ============================================================

import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { fetchIngestionSources } from "../ingestionSources.ts";
import { formatNumber } from "../data.ts";
import type { DataSource } from "../types.ts";
import { useQueryFetch } from "../../../hooks/useQueryFetch.ts";
import { queryKeys } from "../../../services/queryKeys.ts";
import { formatRelativeDate } from "../../knowledge-gaps/format.ts";
import { useProjectContext } from "../../projects/useProjectContext.ts";
import { PmCard, PmCardHeader, PmCardLink } from "../../pm-area/components/PmCard";
import { SourceStatusChip } from "./SourceStatusChip.tsx";

/** Sources listed by name before the card hands over to the Data Ingestion page. */
const VISIBLE_SOURCES = 4;

/** Troubled sources first — a failing repository is the one line on this card that matters. */
const TONE_RANK: Record<DataSource["statusView"]["tone"], number> = {
  danger: 0,
  warning: 1,
  brand: 2,
  neutral: 3,
  success: 4,
};

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-lg leading-tight font-bold text-app-text tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-app-text-muted">{label}</p>
    </div>
  );
}

/**
 * PM overview card: what the buddy, the questions and the gaps are built from, and whether it
 * is fresh.
 *
 * It used to be three inline numbers — synced, ingested, errors — which said that something had
 * run but not *what* the project knows or where it is going wrong. Now it names the sources, each
 * with its own status and age, troubled ones first, over the three figures a PM actually weighs:
 * how much is in there, how much the last runs brought, and how much failed. Same endpoint and
 * merge logic as the Data Ingestion page, so the two never disagree.
 */
export function IngestionStatusWidget() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: sources,
    loading,
    error,
  } = useQueryFetch(
    queryKeys.ingestion.sourceStatuses(selectedProjectId),
    () => fetchIngestionSources(selectedProjectId),
    { enabled: Boolean(selectedProjectId) },
  );

  const list = sources ?? [];
  const totalArtifacts = list.reduce((sum, source) => sum + source.totalArtifactCount, 0);
  const lastRunChanges = list.reduce(
    (sum, source) => sum + source.latestIngestedCount + source.latestUpdatedCount,
    0,
  );
  const errors = list.reduce((sum, source) => sum + source.errors, 0);
  const troubled = list.filter(
    (source) => source.statusView.tone === "danger" || source.statusView.tone === "warning",
  ).length;
  const syncing = list.some((source) => source.statusView.state === "syncing");
  const lastRunAt =
    list
      .map((source) => source.lastRunAt)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  const ordered = [...list].sort(
    (a, b) =>
      TONE_RANK[a.statusView.tone] - TONE_RANK[b.statusView.tone] ||
      (b.lastRunAt ?? "").localeCompare(a.lastRunAt ?? ""),
  );
  const visible = ordered.slice(0, VISIBLE_SOURCES);

  const health = syncing
    ? {
        icon: RefreshCw,
        text: "Syncing right now",
        className: "bg-app-brand-soft text-app-brand-text",
        spin: true,
      }
    : troubled > 0
      ? {
          icon: AlertTriangle,
          text: `${troubled} of ${list.length} ${list.length === 1 ? "source needs" : "sources need"} a look`,
          className: "bg-app-warning-bg text-app-warning-text",
          spin: false,
        }
      : {
          icon: CheckCircle2,
          text: lastRunAt
            ? `All sources healthy · last run ${formatRelativeDate(lastRunAt)}`
            : "All sources connected · no run yet",
          className: "bg-app-success-bg text-app-success-text",
          spin: false,
        };

  return (
    <PmCard
      aria-label="Data ingestion"
      tone="success"
      className="h-full"
      to="/data-ingestion"
      linkLabel="Manage data ingestion"
    >
      <PmCardHeader
        icon={Database}
        tone="success"
        title="Data ingestion"
        meta={
          sources ? `${sources.length} ${sources.length === 1 ? "source" : "sources"}` : undefined
        }
        action={<PmCardLink to="/data-ingestion">Manage</PmCardLink>}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-4">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : error || !sources ? (
        <EmptyState size="sm">No ingestion status to show right now.</EmptyState>
      ) : sources.length === 0 ? (
        <EmptyState size="sm">
          No sources connected yet — connect a repository, Jira or Confluence so the buddy has
          something to answer from.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <p
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${health.className}`}
          >
            <health.icon
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 ${health.spin ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {health.text}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Figure value={formatNumber(totalArtifacts)} label="artifacts known" />
            <Figure value={`+${formatNumber(lastRunChanges)}`} label="new or updated, last runs" />
            <Figure
              value={formatNumber(errors)}
              label={errors === 1 ? "failed item" : "failed items"}
            />
          </div>

          <ul className="-mx-2 divide-y divide-app-border-muted">
            {visible.map((source) => {
              const Icon = source.icon;

              return (
                <li key={source.sourceId} className="flex items-center gap-3 px-2 py-2">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-app-text-muted"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-app-text">
                      {source.name}
                    </span>
                    <span className="block truncate text-xs text-app-text-muted">
                      {source.type}
                      {" · "}
                      {formatNumber(source.totalArtifactCount)} artifacts
                      {" · "}
                      {source.lastRunAt ? formatRelativeDate(source.lastRunAt) : "never run"}
                    </span>
                  </span>
                  <SourceStatusChip status={source.statusView} size="sm" />
                </li>
              );
            })}
          </ul>

          {ordered.length > visible.length && (
            <Link
              to="/data-ingestion"
              className="block text-xs font-medium text-app-brand-text hover:underline"
            >
              +{ordered.length - visible.length} more{" "}
              {ordered.length - visible.length === 1 ? "source" : "sources"}
            </Link>
          )}
        </div>
      )}
    </PmCard>
  );
}
