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
import { fetchIngestionSources } from "../ingestionSources.ts";
import { useQueryFetch } from "../../../hooks/useQueryFetch.ts";
import { queryKeys } from "../../../services/queryKeys.ts";
import { useProjectContext } from "../../projects/useProjectContext.ts";
import { PmCard, PmCardHeader, PmCardLink } from "../../pm-area/components/PmCard";
import { IngestionMetrics } from "./IngestionMetrics.tsx";

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
