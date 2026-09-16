import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Clock, FileText, Filter, RefreshCw, User, X } from "lucide-react";

import type { KnowledgeGapSeverity } from "../types";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { useToast } from "../../../context/useToast";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { formatRelativeDate } from "../format";
import { describeEmptyState } from "../emptyState";
import { SEVERITIES, SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { EmptyStateIcon } from "./EmptyStateIcon";
import { KnowledgeGapPanel } from "./KnowledgeGapPanel";
import { SeverityBar, SeveritySummaryBar } from "./SeverityIndicators";
import { Button } from "../../../components/ui/Button";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { queryKeys } from "../../../services/queryKeys";
import { PmSectionHeader } from "../../pm-area/components/PmCard";
import { useProjectContext } from "../../projects/useProjectContext";

type GapSortOption = "severity" | "date" | "component";

const SORT_OPTIONS: FilterSelectOption<GapSortOption>[] = [
  { value: "severity", label: "Severity" },
  { value: "date", label: "Last updated" },
  { value: "component", label: "Component name" },
];

const PAGE_TITLE = "Knowledge Gaps";
const PAGE_SUBTITLE =
  "Documentation gaps identified across the organization and prioritized by impact.";

function GapsOverviewSkeleton() {
  return (
    <SkeletonGroup label="Loading knowledge gaps" className="space-y-2 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-stretch gap-3 px-2 py-3">
          <SkeletonBlock className="w-1 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="w-1/2" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * The knowledge gaps, as one list filtered by severity, with each gap's detail in a side panel.
 *
 * `/insights/knowledge-gaps/:gapId` renders this same page with that gap's panel open, so links
 * to one gap keep working.
 */
export function KnowledgeGapsPage({ gapId }: { gapId?: string }) {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();

  const [severityFilter, setSeverityFilter] = useState<KnowledgeGapSeverity[]>([...SEVERITIES]);
  const [sortBy, setSortBy] = useState<GapSortOption>("severity");
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const {
    data: overview,
    loading,
    error,
    refresh,
  } = useLiveFetch(queryKeys.knowledgeGaps.overview(selectedProjectId), () =>
    knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
  );

  const showLoadingSkeleton = useDelayedFlag(loading);

  // The backend rescans on its own once new documentation is indexed; while it
  // does, the gaps below are the previous result.
  const rescanning = overview?.refreshing ?? false;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await knowledgeGapService.refreshKnowledgeGaps(selectedProjectId);
      refresh();
      // Read off the refresh's own result rather than off the reloaded list:
      // useLiveFetch keeps the previous data on screen while it revalidates.
      if (result.gapCount === 0) {
        toast.info("No knowledge gaps found", {
          description: "Nothing needs attention for this project right now.",
        });
      }
    } catch (err) {
      console.error("Knowledge-gaps refresh failed", err);
      toast.error("Refresh failed. Is the AI service running?");
    } finally {
      setRefreshing(false);
    }
  };

  const gaps = overview?.gaps ?? [];

  // The newest ingestion across the components, i.e. how fresh the documentation
  // these gaps were read from actually is.
  const lastIngestedAt = gaps
    .map((gap) => gap.lastIngested)
    .reduce<string | null>((newest, at) => (!newest || at > newest ? at : newest), null);
  // Falls back to a gap's own stamp for a backend that predates the field; the
  // gaps are rebuilt as one set, so any row's stamp is the set's.
  const lastAnalyzedAt = overview?.refreshedAt ?? gaps[0]?.refreshedAt ?? null;

  const headerActions = (
    <>
      {/* Both, because they answer different questions: how old the documentation is,
          and how old this reading of it is. */}
      {(lastIngestedAt || lastAnalyzedAt) && gaps.length > 0 && (
        <span className="text-xs text-app-text-muted">
          {lastIngestedAt && `Last ingested ${formatRelativeDate(lastIngestedAt)}`}
          {lastIngestedAt && lastAnalyzedAt && " · "}
          {lastAnalyzedAt && `Last analyzed ${formatRelativeDate(lastAnalyzedAt)}`}
        </span>
      )}
      <Button
        variant="primary"
        onClick={() => void handleRefresh()}
        loading={refreshing || rescanning}
        disabled={loading}
        icon={<RefreshCw className="h-4 w-4" />}
        className="shrink-0"
      >
        {refreshing || rescanning ? "Scanning…" : "Rescan now"}
      </Button>
    </>
  );

  const filtered = gaps
    .filter((gap) => severityFilter.includes(gap.severity))
    .sort((a, b) => {
      let primary = 0;
      switch (sortBy) {
        case "severity":
          primary = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
          break;
        case "date":
          primary = new Date(b.lastIngested).getTime() - new Date(a.lastIngested).getTime();
          break;
        case "component":
          primary = a.component.localeCompare(b.component);
          break;
      }

      // Secondary: more missing docs first.
      return primary !== 0 ? primary : b.missingTypes.length - a.missingTypes.length;
    });

  const selectedGap = gaps.find((gap) => gap.id === gapId) ?? null;

  const toggleSeverityFilter = (severity: KnowledgeGapSeverity) => {
    setSeverityFilter((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    );
  };

  const isEmpty = !loading && (error || !overview || gaps.length === 0);
  const empty = isEmpty ? describeEmptyState(overview, error) : null;

  return (
    <div>
      <PmSectionHeader title={PAGE_TITLE} description={PAGE_SUBTITLE} actions={headerActions} />
      <div className="space-y-4">
        {gaps.length > 0 && <SeveritySummaryBar gaps={gaps} />}

        {gaps.length > 0 && (
          // Always visible rather than behind a disclosure: there are only four controls,
          // and hiding them made the active filter state invisible.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div
              role="group"
              aria-label="Filter gaps by severity"
              className="flex flex-wrap items-center gap-2"
            >
              <Filter aria-hidden="true" className="h-4 w-4 text-app-text-muted" />

              {SEVERITIES.map((severity) => {
                const isSelected = severityFilter.includes(severity);
                const { badge, label } = SEVERITY_STYLES[severity];

                return (
                  <button
                    key={severity}
                    type="button"
                    // Toggles, not a single choice -- `aria-pressed` is what tells
                    // assistive tech which severities are currently included.
                    aria-pressed={isSelected}
                    onClick={() => toggleSeverityFilter(severity)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                      isSelected
                        ? `border-transparent ${badge}`
                        : "border-app-border bg-app-surface text-app-text-muted hover:border-app-brand-border-strong hover:text-app-text"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-app-text-muted tabular-nums">
              {filtered.length} of {gaps.length}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {(severityFilter.length < SEVERITIES.length || sortBy !== "severity") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSeverityFilter([...SEVERITIES]);
                    setSortBy("severity");
                  }}
                  icon={<X className="h-3.5 w-3.5" />}
                  className="text-app-brand-text"
                >
                  Reset
                </Button>
              )}

              <FilterSelect
                label="Sort knowledge gaps"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={setSortBy}
                className="w-48"
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
          {showLoadingSkeleton ? (
            <GapsOverviewSkeleton />
          ) : loading ? null : empty ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16">
              <EmptyStateIcon state={empty.state} />
              <p className="max-w-md text-center text-sm text-app-text-muted">{empty.message}</p>
              {/* Only meaningful once a scan has actually produced a result. */}
              {empty.scannedAt && (
                <p className="text-xs text-app-text-muted">
                  Last analyzed {formatRelativeDate(empty.scannedAt)}
                </p>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-app-text-muted">
              No gaps with the selected severities.
            </p>
          ) : (
            // `layout="position"` on the rows only: it animates where a row sits, never its
            // measured size, so no scale correction is ever applied when a filter brings a row
            // back into an emptied list.
            <ul className="divide-y divide-app-border-muted px-3 py-1.5">
              <AnimatePresence initial={false}>
                {filtered.map((gap) => {
                  const { badge, label } = SEVERITY_STYLES[gap.severity];
                  const owner = gap.owners[0] ?? null;
                  const selected = gap.id === gapId;
                  const types =
                    gap.missingTypes.length === 0 ? (gap.presentTypes ?? []) : gap.missingTypes;

                  return (
                    <motion.li
                      key={gap.id}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                      className="py-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => void navigate(`/insights/knowledge-gaps/${gap.id}`)}
                        aria-current={selected ? "true" : undefined}
                        className={`group flex w-full items-stretch gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                          selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
                        }`}
                      >
                        <SeverityBar severity={gap.severity} />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-app-text">
                              {gap.component}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge}`}
                            >
                              {label}
                            </span>
                          </span>

                          {/* Missing document types, or what a covered component has instead. */}
                          <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-app-text-muted">
                            <FileText aria-hidden="true" className="mr-0.5 h-3.5 w-3.5" />
                            <span className="mr-1">
                              {gap.missingTypes.length === 0
                                ? `All expected documentation present (${gap.presentTypes?.length ?? 0})`
                                : `Missing documentation (${gap.missingTypes.length})`}
                            </span>
                            {types.map((type) => (
                              <span
                                key={type}
                                className="rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[11px]"
                              >
                                {type}
                              </span>
                            ))}
                          </span>

                          <span className="mt-2 flex items-center gap-4 text-xs text-app-text-subtle">
                            <span className="flex min-w-0 items-center gap-1">
                              <User aria-hidden="true" className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {owner ? `${owner.firstname} ${owner.lastname}` : "Unassigned"}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <Clock aria-hidden="true" className="h-3 w-3" />
                              {formatRelativeDate(gap.lastIngested)}
                            </span>
                          </span>
                        </span>

                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 self-center text-app-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-app-text"
                        />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      <KnowledgeGapPanel
        gapId={gapId ?? null}
        gap={selectedGap}
        onClose={() => void navigate("/insights/knowledge-gaps")}
      />
    </div>
  );
}
