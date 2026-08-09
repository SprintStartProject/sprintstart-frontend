// ============================================================
// KnowledgeGapWidget.tsx
// Dashboard widget — zeigt Knowledge Gaps sortiert nach Severity
// On click navigiert zu /insights/knowledge-gaps/:gapId
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { useFetch } from "../../../hooks/useFetch";
import { formatRelativeDate } from "../format";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { SeverityBar, SeveritySummaryBar } from "./SeverityIndicators";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { useProjectContext } from "../../projects/useProjectContext";

import {
  ShieldAlert,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// COMPONENT: KnowledgeGapWidget
// ─────────────────────────────────────────────────────────────

export function KnowledgeGapWidget() {
    const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const {
    data: overview,
    loading,
    error,
  } = useFetch(() => knowledgeGapService.fetchKnowledgeGaps(selectedProjectId), [refreshKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await knowledgeGapService.refreshKnowledgeGaps(selectedProjectId);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Knowledge-gaps refresh failed", err);
      setRefreshError("Refresh failed. Is the AI service running?");
    } finally {
      setRefreshing(false);
    }
  };

  // ── LOADING ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex items-center justify-center min-h-48">
        <Loader2 className="w-5 h-5 animate-spin text-app-brand" />
      </div>
    );
  }

  // ── ERROR / EMPTY ──────────────────────────────────────

  if (error || !overview || overview.gaps.length === 0) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 flex flex-col items-center justify-center gap-3 min-h-48 text-center">
        <AlertCircle className="w-5 h-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No knowledge gaps yet. Trigger a refresh to detect them.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-brand hover:bg-app-brand-hover text-white text-xs font-medium transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => void navigate("/insights/knowledge-gaps")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-app-border text-xs text-app-text-muted hover:text-app-text transition-colors"
          >
            Open page
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {refreshError && (
          <p className="text-xs text-app-danger-text max-w-xs">{refreshError}</p>
        )}
      </div>
    );
  }

  const sorted = [...overview.gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  // Show top in widget
  const preview = sorted.slice(0, 4);

  const gapCount = sorted.length;

  // ── RENDER ─────────────────────────────────────────────

  return (
    <ClickableCard
      onClick={() => void navigate("/insights/knowledge-gaps")}
      interactive={false}
      className="rounded-2xl border border-app-border bg-app-surface p-5 cursor-pointer transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-app-brand" />
          <span className="text-sm font-semibold text-app-text">
            Knowledge gaps
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleRefresh();
            }}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center text-app-text-muted hover:text-app-text transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void navigate("/insights/knowledge-gaps");
            }}
            className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
          >
            See all ({gapCount})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stacked severity overview bar */}
      <SeveritySummaryBar gaps={overview.gaps} className="mb-4" />

      {/* Gap list */}
      <div className="space-y-2">
        {preview.map((gap) => {
          const { badge, label } = SEVERITY_STYLES[gap.severity];
          return (
            <button
              key={gap.id}
              onClick={(event) => {
                event.stopPropagation();
                void navigate(`/insights/knowledge-gaps/${gap.id}`);
              }}
              className="w-full text-left flex items-stretch gap-3 rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong transition-colors p-3"
            >
              <SeverityBar severity={gap.severity} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-app-text truncate">
                    {gap.component}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badge}`}
                  >
                    {label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-app-text-muted">
                  {/* Missing types as small chips */}
                  <div className="flex gap-1 flex-wrap">
                    {gap.missingTypes.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="bg-app-surface-muted border border-app-border rounded px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                    {gap.missingTypes.length > 2 && (
                      <span className="bg-app-surface-muted border border-app-border rounded px-1.5 py-0.5">
                        +{gap.missingTypes.length - 2}
                      </span>
                    )}
                  </div>

                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatRelativeDate(gap.lastIngested)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ClickableCard>
  );
}