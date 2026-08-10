// ============================================================
// KnowledgeGapWidget.tsx
// Dashboard widget — zeigt Knowledge Gaps sortiert nach Severity
// On click navigiert zu /insights/knowledge-gaps/:gapId
// ============================================================

import { useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { useFetch } from "../../../hooks/useFetch";
import { formatRelativeDate } from "../format";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { SeverityBar, SeveritySummaryBar } from "./SeverityIndicators";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Button } from "../../../components/ui/Button";

import { ShieldAlert, ArrowRight, AlertCircle, Clock, RefreshCw } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// COMPONENT: KnowledgeGapWidget
// ─────────────────────────────────────────────────────────────

export function KnowledgeGapWidget() {
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const {
    data: overview,
    loading,
    error,
  } = useFetch(() => knowledgeGapService.fetchKnowledgeGaps(), [refreshKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await knowledgeGapService.refreshKnowledgeGaps();
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
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  // ── ERROR / EMPTY ──────────────────────────────────────

  if (error || !overview || overview.gaps.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          No knowledge gaps yet. Trigger a refresh to detect them.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleRefresh()}
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigate("/insights/knowledge-gaps")}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Open page
          </Button>
        </div>
        {refreshError && <p className="max-w-xs text-xs text-app-danger-text">{refreshError}</p>}
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
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-app-brand" />
          <span className="text-sm font-semibold text-app-text">Knowledge gaps</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={(event) => {
              event.stopPropagation();
              void handleRefresh();
            }}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void navigate("/insights/knowledge-gaps");
            }}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            See all ({gapCount})
          </Button>
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
              className="flex w-full items-stretch gap-3 rounded-xl border border-app-border bg-app-surface p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
            >
              <SeverityBar severity={gap.severity} />

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-app-text">
                    {gap.component}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
                  >
                    {label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-app-text-muted">
                  {/* Missing types as small chips */}
                  <div className="flex flex-wrap gap-1">
                    {gap.missingTypes.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                    {gap.missingTypes.length > 2 && (
                      <span className="rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5">
                        +{gap.missingTypes.length - 2}
                      </span>
                    )}
                  </div>

                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <Clock className="h-3 w-3" />
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
