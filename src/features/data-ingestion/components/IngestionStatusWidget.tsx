// ============================================================
// IngestionStatusWidget.tsx
// PM overview card — surfaces ingestion sync health (synced
// sources, ingested artifacts, errors) using the same
// `/api/v1/ingestion-status` endpoint and merge logic as the
// Data Ingestion page, so the PM area never re-implements
// ingestion status handling.
// ============================================================

import { Database } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { createSourceFromInstance } from "../data.ts";
import { getIngestionSourceStatuses } from "../../../services/ingestionService.ts";
import { useQueryFetch } from "../../../hooks/useQueryFetch.ts";
import { queryKeys } from "../../../services/queryKeys.ts";
import { useProjectContext } from "../../projects/useProjectContext.ts";
import { PmCard, PmCardHeader, PmCardLink } from "../../pm-area/components/PmCard";
import { IngestionMetrics } from "./IngestionMetrics.tsx";

/**
 * One row per connected repository, scoped to the selected project — the same
 * granularity the Data Ingestion page shows. The per-source-system aggregate
 * used previously collapsed every GitHub repo into a single row, so a project
 * with three connected repos reported "1/1 synced".
 */
async function fetchIngestionSources(projectId: string) {
  const instances = await getIngestionSourceStatuses(projectId);

  return instances.map(createSourceFromInstance);
}

/**
 * PM overview card showing ingestion sync health at a glance.
 * Reuses {@link IngestionMetrics} in its compact/inline mode so the
 * overview and the full Data Ingestion page always render identical
 * numbers computed from the same source data.
 */
export function IngestionStatusWidget() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: sources,
    loading,
    error,
  } = useQueryFetch(queryKeys.ingestion.sourceStatuses(selectedProjectId), () =>
    fetchIngestionSources(selectedProjectId),
  );

  return (
    <PmCard aria-label="Data ingestion" className="h-full">
      <PmCardHeader
        icon={Database}
        title="Data ingestion"
        meta={sources ? `${sources.length} sources` : undefined}
        action={<PmCardLink to="/data-ingestion">Manage</PmCardLink>}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-4">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : error || !sources ? (
        <EmptyState size="sm">No ingestion status to show right now.</EmptyState>
      ) : sources.length === 0 ? (
        <EmptyState size="sm">No sources connected yet.</EmptyState>
      ) : (
        <IngestionMetrics sources={sources} compact />
      )}
    </PmCard>
  );
}
