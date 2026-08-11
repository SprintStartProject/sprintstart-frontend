// ============================================================
// IngestionStatusWidget.tsx
// Dashboard widget — surfaces ingestion sync health (last run,
// ingested/updated/failed counts, per-source errors) using the
// same `/api/v1/ingestion-status` + `/api/v1/ingestion-runs`
// endpoints and merge logic as the Data Ingestion page, so the
// PM Dashboard never re-implements ingestion status handling.
// ============================================================

import { ArrowRight, Database } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import { createSourceFromInstance } from "../data.ts";
import { getIngestionSourceStatuses } from "../../../services/ingestionService.ts";
import { useFetch } from "../../../hooks/useFetch.ts";
import { useProjectContext } from "../../projects/useProjectContext.ts";
import { ClickableCard } from "../../../components/common/ClickableCard.tsx";
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
 * PM Dashboard strip showing ingestion sync health at a glance.
 * Reuses {@link IngestionMetrics} in its compact/inline mode so the
 * dashboard and the full Data Ingestion page always render identical
 * numbers computed from the same source data.
 */
export function IngestionStatusWidget() {
  const navigate = useNavigate();
  const { selectedProjectId } = useProjectContext();
  const {
    data: sources,
    loading,
    error,
  } = useFetch(() => fetchIngestionSources(selectedProjectId), [selectedProjectId]);

  // ── LOADING ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl p-4">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────

  if (error || !sources) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl p-4 text-center">
        <Database className="h-4 w-4 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">Could not load ingestion status.</p>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────

  return (
    <ClickableCard
      onClick={() => void navigate("/data-ingestion")}
      aria-label="View data ingestion details"
      className="flex cursor-pointer flex-wrap items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-app-surface-hover sm:justify-between"
    >
      <div className="flex shrink-0 items-center gap-2">
        <Database className="h-4 w-4 text-app-brand" />
        <span className="text-sm font-semibold text-app-text">Data ingestion</span>
      </div>

      <IngestionMetrics sources={sources} compact />

      <span className="flex shrink-0 items-center gap-1 text-xs text-app-text-muted">
        View details
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </ClickableCard>
  );
}
