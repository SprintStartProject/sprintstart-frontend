import { Database } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { useFetch } from "../../../hooks/useFetch";
import { getIngestionSourceStatuses } from "../../../services/ingestionService";
import { createSourceFromInstance, formatNumber } from "../../data-ingestion/data";
import type { DataSource } from "../../data-ingestion/types";
import { useProjectContext } from "../../projects/useProjectContext";
import type { DashboardWidgetSize } from "../layout/types";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

/** Sources listed before the column would run past the bottom of a fixed-height cell. */
const VISIBLE_SOURCE_COUNT = 3;

/**
 * One row per connected repository, scoped to the selected project — the same granularity
 * the Data Ingestion page shows. The per-source-system aggregate used previously collapsed
 * every GitHub repo into a single row, so a project with three connected repos reported
 * "1/1 synced".
 */
async function fetchSources(projectId: string): Promise<DataSource[]> {
  const instances = await getIngestionSourceStatuses(projectId);

  return instances.map(createSourceFromInstance);
}

function metricsFor(sources: readonly DataSource[]): WidgetMetric[] {
  const synced = sources.filter((source) => source.lastRunAt !== null).length;
  const ingested = sources.reduce((total, source) => total + source.latestIngestedCount, 0);
  const errors = sources.reduce((total, source) => total + source.errors, 0);

  return [
    {
      label: "Connected sources",
      value: sources.length,
      hint: sources.length === synced ? "all have run at least once" : `${synced} have ever synced`,
    },
    { label: "Artifacts ingested", value: ingested, hint: "in the latest run of each source" },
    {
      label: "Failed items",
      value: errors,
      needsAttention: errors > 0,
      hint: errors > 0 ? "did not make it into the index" : "nothing failed",
    },
  ];
}

/**
 * A source and what it last did.
 *
 * Two lines rather than one, because a repository name and a status chip fighting over the
 * same line is what made this list unreadable: the name truncated to nothing so the chip
 * could keep its width. The name gets the line it needs, and the state and the counts sit
 * beneath it where they have room to be words.
 */
function SourceRow({ source, inline = false }: { source: DataSource; inline?: boolean }) {
  const StatusIcon = source.statusView.icon;

  return (
    <li className="flex items-start gap-3">
      <source.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-app-text-muted" />

      <div className={`min-w-0 flex-1 ${inline ? "flex items-center justify-between gap-4" : ""}`}>
        <p className="truncate text-sm font-medium text-app-text">{source.name}</p>

        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${inline ? "shrink-0" : "mt-1"}`}
        >
          <Badge variant={source.statusView.tone} size="sm" className="gap-1">
            <StatusIcon aria-hidden="true" className="h-3 w-3" />
            {source.statusView.label}
          </Badge>

          <span className="text-xs text-app-text-muted tabular-nums">
            {formatNumber(source.totalArtifactCount)} artifacts
          </span>

          {source.errors > 0 && (
            <span className="text-xs text-app-warning-text tabular-nums">
              {formatNumber(source.errors)} failed
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The heading and the list of sources, or the sentence that stands in for them.
 *
 * `wide` lays each source on one line: at that width the name has room to be read next to
 * its state, which is exactly what it did not have at half a row.
 */
function SourceColumn({
  sources,
  hidden,
  wide = false,
}: {
  sources: readonly DataSource[];
  hidden: number;
  wide?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center">
      <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
        Sources
      </p>

      {sources.length === 0 ? (
        <p className="text-xs text-app-text-muted">Nothing is connected to this project yet.</p>
      ) : (
        <>
          <ul className={wide ? "space-y-2" : "space-y-3"}>
            {sources.map((source) => (
              <SourceRow key={source.sourceId} source={source} inline={wide} />
            ))}
          </ul>

          {hidden > 0 && <p className="mt-2 text-xs text-app-text-muted">and {hidden} more</p>}
        </>
      )}
    </div>
  );
}

/**
 * Whether the project's connected sources are in sync.
 *
 * Reads the same endpoint as the Data Ingestion page, through the same
 * `createSourceFromInstance` mapping, so the dashboard and the page can never disagree about
 * what is connected or how much of it landed.
 *
 * `small` is the health check — how many sources, how much they brought in, what failed.
 * `medium` adds the sources themselves, because "one source is failing" is only useful once
 * you know which one. `wide` is the same pair given room: the figures keep a third, the
 * sources take the other two and get a line each.
 */
export function IngestionWidget({ size }: { size: DashboardWidgetSize }) {
  const { selectedProjectId } = useProjectContext();

  const { data, loading, error } = useFetch(
    () => fetchSources(selectedProjectId),
    [selectedProjectId],
  );

  const sources = data ?? [];
  const metrics = metricsFor(sources);

  // Whatever is broken is what the reader came for, so it goes to the top of the list.
  const listed = [...sources].sort((a, b) => b.errors - a.errors).slice(0, VISIBLE_SOURCE_COUNT);
  const hidden = sources.length - listed.length;

  return (
    <WidgetShell
      icon={Database}
      title="Data ingestion"
      actionLabel="Open data ingestion"
      to="/data-ingestion"
      isLoading={loading}
      errorMessage={error || !data ? "Could not load the ingestion status." : null}
    >
      {size === "small" ? (
        <WidgetMetrics icon={Database} metrics={metrics} />
      ) : (
        // At full width the figures keep a third and the sources take the rest, each on its
        // own line: that is the width the name and the state needed to stop fighting for a
        // line, and a divider so the two halves stay two halves.
        <div
          className={`grid flex-1 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 ${
            size === "wide" ? "lg:grid-cols-3" : ""
          }`}
        >
          <WidgetMetrics icon={Database} metrics={metrics} />

          <div
            className={
              size === "wide"
                ? "border-t border-app-border-muted pt-5 lg:col-span-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
                : ""
            }
          >
            <SourceColumn sources={listed} hidden={hidden} wide={size === "wide"} />
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
