import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { KnowledgeGapSeverity } from "../types";

import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { useFetch } from "../../../hooks/useFetch";
import { formatRelativeDate } from "../format";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { SeverityBar, SeveritySummaryBar } from "./SeverityIndicators";

import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Filter,
  ArrowUpDown,
  X,
  ChevronDown,
  SlidersHorizontal,
  RefreshCw,
  FileText,
  User,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";

// ------------------------------------------------------------------
// PAGE
// ------------------------------------------------------------------

export function KnowledgeGapsPage() {
  const [severityFilter, setSeverityFilter] = useState<KnowledgeGapSeverity[]>([
    "high",
    "medium",
    "low",
  ]);
  const [sortBy, setSortBy] = useState<
    "severity" | "date" | "component"
  >("severity");
  const [expandFilters, setExpandFilters] = useState(false);

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
      setRefreshError(
        "Refresh failed. Is the AI service running?",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const refreshButton = (
    <button
      onClick={() => void handleRefresh()}
      disabled={refreshing}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all disabled:opacity-60 shrink-0"
    >
      <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-app-brand" />
      </div>
    );
  }

  if (error || !overview || overview.gaps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <AlertCircle className="w-5 h-5 text-app-text-muted" />
        <p className="text-app-text-muted">
          No knowledge gaps yet. Trigger a refresh to detect them.
        </p>
        {refreshButton}
        {refreshError && (
          <p className="text-sm text-app-danger-text max-w-md text-center">
            {refreshError}
          </p>
        )}
      </div>
    );
  }

  // Filter by severity
  const filtered = overview.gaps.filter((gap) =>
    severityFilter.includes(gap.severity),
  );

  // Sort based on selected sort option, with the number of missing docs as a
  // secondary tie-breaker (more missing docs ranks higher within the same
  // primary bucket, e.g. same severity).
  filtered.sort((a, b) => {
    let primary = 0;
    switch (sortBy) {
      case "severity":
        primary = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        break;
      case "date":
        primary =
          new Date(b.lastIngested).getTime() -
          new Date(a.lastIngested).getTime();
        break;
      case "component":
        primary = a.component.localeCompare(b.component);
        break;
    }

    if (primary !== 0) return primary;

    // Secondary: more missing docs first.
    return b.missingTypes.length - a.missingTypes.length;
  });

  const toggleSeverityFilter = (severity: KnowledgeGapSeverity) => {
    setSeverityFilter((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity],
    );
  };

  return (
    <div className="min-h-screen bg-app-bg">
      <section aria-label="Page header" className="border-b border-app-border bg-app-bg/90">
        <div className="app-page-content py-8">
          <button
            onClick={() => void navigate("/pm-dashboard")}
            className="inline-flex items-center gap-2 text-sm text-app-text-muted hover:text-app-text transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PM-Dashboard
          </button>
          <div className="flex items-start justify-between gap-4 mb-6">
            <PageHeader
              icon={ShieldAlert}
              title="Knowledge Gaps"
              subtitle="Documentation gaps identified across the organization and prioritized by impact."
            />
            <div className="flex flex-col items-end gap-1 shrink-0">
              {refreshButton}
              {overview.gaps[0] && (
                <span className="text-xs text-app-text-muted">
                  Last analyzed {formatRelativeDate(overview.gaps[0].refreshedAt)}
                </span>
              )}
            </div>
          </div>
          {refreshError && (
            <p className="text-sm text-app-danger-text mb-4">{refreshError}</p>
          )}
          <SeveritySummaryBar gaps={overview.gaps} className="mb-6" />
        </div>
      </section>

      <main className="app-page-content py-8">
        {/* Filter & Sort Controls */}
        <div className="mb-6 rounded-lg border border-app-border bg-app-surface">
          {/* Header / Compact View */}
          <button
            onClick={() => setExpandFilters(!expandFilters)}
            className="w-full flex items-center justify-between p-4 hover:bg-app-surface-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-app-text-muted" />
              <span className="text-sm font-medium text-app-text">
                Filters & Sort
              </span>
              <span className="text-xs text-app-text-muted ml-2">
                ({filtered.length} of {overview.gaps.length})
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-app-text-muted transition-transform ${
                expandFilters ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Expanded Content */}
          {expandFilters && (
            <>
              <div className="border-t border-app-border px-4 py-4 space-y-4">
                {/* Filters */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-app-text-muted" />
                    <span className="text-sm font-medium text-app-text">
                      Severity Filter
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["high", "medium", "low"] as KnowledgeGapSeverity[]).map(
                      (severity) => {
                        const isSelected = severityFilter.includes(severity);
                        const { badge, label } = SEVERITY_STYLES[severity];

                        return (
                          <button
                            key={severity}
                            onClick={() => toggleSeverityFilter(severity)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                              isSelected
                                ? badge
                                : "bg-app-bg text-app-text-muted border border-app-border"
                            }`}
                          >
                            {label}
                            {isSelected && (
                              <span className="ml-1">✓</span>
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Sort Options */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-app-text-muted" />
                    <span className="text-sm font-medium text-app-text">
                      Sort By
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "severity", label: "Severity" },
                        { value: "date", label: "Last Updated" },
                        { value: "component", label: "Component Name" },
                      ] as Array<{ value: typeof sortBy; label: string }>
                    ).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setSortBy(value)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                          sortBy === value
                            ? "bg-app-brand text-white"
                            : "bg-app-bg text-app-text-muted border border-app-border hover:border-app-border-strong"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset Button */}
                {(severityFilter.length < 3 || sortBy !== "severity") && (
                  <div className="flex justify-end pt-2 border-t border-app-border">
                    <button
                      onClick={() => {
                        setSeverityFilter(["high", "medium", "low"]);
                        setSortBy("severity");
                      }}
                      className="text-xs text-app-brand hover:text-app-brand/80 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          {filtered.map((gap) => {
            const { badge, label } = SEVERITY_STYLES[gap.severity];
            const owner = gap.owners[0] ?? null;

            return (
              <button
                key={gap.id}
                onClick={() =>
                  void navigate(`/insights/knowledge-gaps/${gap.id}`)
                }
                className="w-full text-left flex items-stretch gap-3 rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong transition-colors p-4"
              >
                <SeverityBar severity={gap.severity} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-base font-medium text-app-text">
                      {gap.component}
                    </span>

                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${badge}`}
                    >
                      {label}
                    </span>
                  </div>

                  {/* Missing document types for this component */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted mb-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Missing documentation ({gap.missingTypes.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {gap.missingTypes.map((type) => (
                        <span
                          key={type}
                          className="bg-app-surface-muted border border-app-border rounded px-2 py-1 text-xs"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-app-text-muted">
                    <span className="flex items-center gap-1 min-w-0">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {owner
                          ? `${owner.firstname} ${owner.lastname}`
                          : "Unassigned"}
                      </span>
                    </span>

                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatRelativeDate(gap.lastIngested)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
