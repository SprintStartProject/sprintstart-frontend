import { CalendarClock, Plug } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/Badge.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Pagination } from "../../components/ui/Pagination.tsx";
import { RunHistory } from "../../features/data-ingestion/components/RunHistory.tsx";
import { RunHistoryFilters } from "../../features/data-ingestion/components/RunHistoryFilters.tsx";
import { SourceList } from "../../features/data-ingestion/components/SourceList.tsx";
import type { SourceHealth } from "./ingestionRules";
import type { DataIngestionPageModel } from "./useDataIngestionPage";

/** Count badge in a section heading; the Sources and Runs headings share this size. */
function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "brand" | "warning" | "neutral";
  children: ReactNode;
}) {
  return (
    <Badge variant={tone} className="tabular-nums">
      {children}
    </Badge>
  );
}

function HealthBadges({ health }: { health: SourceHealth }) {
  return (
    <>
      {health.connected > 0 && (
        <StatusBadge tone="success">{health.connected} connected</StatusBadge>
      )}
      {health.syncing > 0 && <StatusBadge tone="brand">{health.syncing} syncing</StatusBadge>}
      {health.attention > 0 && (
        <StatusBadge tone="warning">
          {health.attention} need
          {health.attention === 1 ? "s" : ""} attention
        </StatusBadge>
      )}
      {health.disabled > 0 && <StatusBadge tone="neutral">{health.disabled} disabled</StatusBadge>}
    </>
  );
}

/** The two project-wide settings, for those who may change them. */
function ManageButtons({ model }: { model: DataIngestionPageModel }) {
  const { connectorsModal, syncSettings } = model;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={connectorsModal.open}
        icon={<Plug className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        <span className="min-w-0 truncate">Manage connectors</span>
      </Button>

      {syncSettings.systems.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={syncSettings.open}
          icon={<CalendarClock className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          <span className="min-w-0 truncate">Manage sync settings</span>
        </Button>
      ) : null}
    </div>
  );
}

export function SourcesSection({ model }: { model: DataIngestionPageModel }) {
  const { feed, selection, actions, can } = model;

  return (
    <section aria-label="Sources">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-lg font-semibold tracking-tight text-app-text">Sources</h2>
          <HealthBadges health={feed.health} />
        </div>

        {can.canManageSyncSettings ? <ManageButtons model={model} /> : null}
      </div>

      {!feed.data.isProjectDataLoading ? (
        <SourceList
          sources={feed.sources}
          selectedSourceId={selection.selectedSourceId}
          onSelectSource={selection.select}
          onAddSource={actions.openAddSource}
        />
      ) : null}
    </section>
  );
}

export function RunsSection({ model }: { model: DataIngestionPageModel }) {
  const { feed, runSelection, actions } = model;
  const { runFilter, data } = feed;
  const { runPageMeta } = data;
  const isLoading = data.isRunsLoading || actions.isRefreshing;

  return (
    <section aria-label="Runs">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-text">Runs</h2>
          {runPageMeta ? (
            <StatusBadge tone="neutral">{runPageMeta.totalElements} total</StatusBadge>
          ) : null}
        </div>

        <RunHistoryFilters
          status={runFilter.filter.status}
          sourceValue={runFilter.filter.sourceValue}
          sources={feed.runSourceOptions}
          disabled={isLoading}
          onStatusChange={runFilter.setStatus}
          onSourceChange={(value) => runFilter.setSource(value, feed.runSourceOptions)}
          onReset={runFilter.reset}
        />
      </div>
      <RunHistory
        runs={data.runs}
        selectedRunId={runSelection.selectedRunId}
        onSelectRun={runSelection.select}
        sourceLabelBySourceRef={feed.runSourceLabels}
        isFiltered={runFilter.isActive}
      />

      {runPageMeta && runPageMeta.totalPages > 1 ? (
        <Pagination
          currentPage={runFilter.pageNumber}
          totalPages={runPageMeta.totalPages}
          onPageChange={runFilter.setPageNumber}
        />
      ) : null}
    </section>
  );
}
