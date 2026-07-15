// ============================================================
// IngestionStatusWidget.tsx
// Dashboard widget — surfaces ingestion sync health (last run,
// ingested/updated/failed counts, per-source errors) using the
// same `/api/v1/ingestion-status` + `/api/v1/ingestion-runs`
// endpoints and merge logic as the Data Ingestion page, so the
// PM Dashboard never re-implements ingestion status handling.
// ============================================================

import { ArrowRight, Database, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildDataSources, INGESTION_RUN_LIMIT } from "../data.ts";
import { getIngestionRuns, getIngestionStatus } from "../../../services/ingestionService.ts";
import { useFetch } from "../../../hooks/useFetch.ts";
import { ClickableCard } from "../../../components/common/ClickableCard.tsx";
import { IngestionMetrics } from "./IngestionMetrics.tsx";

async function fetchIngestionSources() {
    const [statusData, runData] = await Promise.all([
        getIngestionStatus(),
        getIngestionRuns(INGESTION_RUN_LIMIT),
    ]);

    return buildDataSources(statusData, runData);
}

/**
 * PM Dashboard strip showing ingestion sync health at a glance.
 * Reuses {@link IngestionMetrics} in its compact/inline mode so the
 * dashboard and the full Data Ingestion page always render identical
 * numbers computed from the same source data.
 */
export function IngestionStatusWidget() {
    const navigate = useNavigate();
    const { data: sources, loading, error } = useFetch(
        () => fetchIngestionSources(),
        [],
    );

    // ── LOADING ──────────────────────────────────────────────

    if (loading) {
        return (
            <div className="rounded-2xl border border-app-border bg-app-surface p-4 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-app-brand" />
            </div>
        );
    }

    // ── ERROR ────────────────────────────────────────────────

    if (error || !sources) {
        return (
            <div className="rounded-2xl border border-app-border bg-app-surface p-4 flex items-center justify-center gap-2 text-center">
                <Database className="w-4 h-4 text-app-text-muted" />
                <p className="text-sm text-app-text-muted">
                    Could not load ingestion status.
                </p>
            </div>
        );
    }

    // ── RENDER ───────────────────────────────────────────────

    return (
        <ClickableCard
            onClick={() => void navigate("/data-ingestion")}
            aria-label="View data ingestion details"
            className="rounded-2xl border border-app-border bg-app-surface p-4 cursor-pointer transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover flex flex-wrap items-center gap-4 sm:justify-between"
        >
            <div className="flex items-center gap-2 shrink-0">
                <Database className="w-4 h-4 text-app-brand" />
                <span className="text-sm font-semibold text-app-text">
                    Data ingestion
                </span>
            </div>

            <IngestionMetrics sources={sources} compact />

            <span className="flex items-center gap-1 text-xs text-app-text-muted shrink-0">
                View details
                <ArrowRight className="w-3.5 h-3.5" />
            </span>
        </ClickableCard>
    );
}
