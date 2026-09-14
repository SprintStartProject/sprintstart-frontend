import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { KnowledgeGapSeverity } from "../types";

import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { useToast } from "../../../context/useToast";
import { useLiveFetch } from "../../../hooks/useLiveFetch";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { formatRelativeDate } from "../format";
import { describeEmptyState } from "../emptyState";
import { SEVERITIES, SEVERITY_ORDER, SEVERITY_STYLES } from "../severity";
import { EmptyStateIcon } from "./EmptyStateIcon";
import { SeverityBar, SeveritySummaryBar } from "./SeverityIndicators";
import { Button } from "../../../components/ui/Button";
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";

import { ShieldAlert, Clock, Filter, X, RefreshCw, FileText, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageShell } from "../../../components/layout/PageShell";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { queryKeys } from "../../../services/queryKeys";
import { useProjectContext } from "../../projects/useProjectContext";
import { buttonHoverMotion } from "../../../styles/tokens";

type GapSortOption = "severity" | "date" | "component";

const SORT_OPTIONS: FilterSelectOption<GapSortOption>[] = [
  { value: "severity", label: "Severity" },
  { value: "date", label: "Last updated" },
  { value: "component", label: "Component name" },
];

const PAGE_ICON = ShieldAlert;
const PAGE_TITLE = "Knowledge Gaps";
const PAGE_SUBTITLE =
  "Documentation gaps identified across the organization and prioritized by impact.";
const PAGE_BACK = { label: "Back to PM-Dashboard", to: "/pm-dashboard" } as const;

/** Placeholder for one gap row, matching its severity bar, tag chips and owner/date footer. */
function KnowledgeGapRowSkeleton() {
  return (
    <div className="flex w-full items-stretch gap-3 rounded-2xl border border-app-border bg-app-surface p-4">
      <SkeletonBlock className="w-1.5 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="h-5 w-16 rounded-full" />
        </div>
        <div className="mb-3 space-y-1.5">
          <SkeletonLine className="w-1/4" />
          <div className="flex flex-wrap gap-1.5">
            <SkeletonLine className="h-6 w-16" />
            <SkeletonLine className="h-6 w-20" />
            <SkeletonLine className="h-6 w-14" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="w-20" />
        </div>
      </div>
    </div>
  );
}

/** Matches the stacked bar + legend of {@link SeveritySummaryBar} in the header band. */
function GapsSummaryBarSkeleton() {
  return (
    <div>
      <SkeletonLine className="mb-2 h-2 w-full rounded-full" />
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-16" />
      </div>
    </div>
  );
}

function GapsOverviewSkeleton() {
  return (
    <SkeletonGroup label="Loading knowledge gaps" className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <KnowledgeGapRowSkeleton key={index} />
      ))}
    </SkeletonGroup>
  );
}

// ------------------------------------------------------------------
// PAGE
// ------------------------------------------------------------------

export function KnowledgeGapsPage() {
  const { selectedProjectId } = useProjectContext();
  const [severityFilter, setSeverityFilter] = useState<KnowledgeGapSeverity[]>([...SEVERITIES]);
  const [sortBy, setSortBy] = useState<GapSortOption>("severity");

  const navigate = useNavigate();

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
      // Read off the refresh's own result rather than off the reloaded panel:
      // useLiveFetch deliberately keeps the previous data on screen while it
      // revalidates, so no render marks the moment the new result arrived.
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

  const refreshButton = (
    <Button
      variant="primary"
      onClick={() => void handleRefresh()}
      loading={refreshing || rescanning}
      icon={<RefreshCw className="h-4 w-4" />}
      className="shrink-0"
    >
      {refreshing || rescanning ? "Scanning…" : "Rescan now"}
    </Button>
  );

  if (showLoadingSkeleton || loading) {
    // Nothing to rescan from until the fetch resolves.
    return (
      <PageShell
        icon={PAGE_ICON}
        title={PAGE_TITLE}
        subtitle={PAGE_SUBTITLE}
        frame="content"
        back={PAGE_BACK}
        bandExtra={showLoadingSkeleton ? <GapsSummaryBarSkeleton /> : undefined}
        mainClassName="py-8"
      >
        {showLoadingSkeleton && <GapsOverviewSkeleton />}
      </PageShell>
    );
  }

  if (error || !overview || overview.gaps.length === 0) {
    const empty = describeEmptyState(overview, error);

    return (
      <PageShell
        icon={PAGE_ICON}
        title={PAGE_TITLE}
        subtitle={PAGE_SUBTITLE}
        frame="content"
        back={PAGE_BACK}
        actions={refreshButton}
      >
        <div className="flex flex-col items-center gap-3 py-20">
          <EmptyStateIcon state={empty.state} />
          <p className="max-w-md text-center text-app-text-muted">{empty.message}</p>
          {/* Only meaningful once a scan has actually produced a result; before
              that there is no reading whose age a PM could judge. */}
          {empty.scannedAt && (
            <p className="text-xs text-app-text-muted">
              Last analyzed {formatRelativeDate(empty.scannedAt)}
            </p>
          )}
        </div>
      </PageShell>
    );
  }

  // Filter by severity
  const filtered = overview.gaps.filter((gap) => severityFilter.includes(gap.severity));

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
        primary = new Date(b.lastIngested).getTime() - new Date(a.lastIngested).getTime();
        break;
      case "component":
        primary = a.component.localeCompare(b.component);
        break;
    }

    if (primary !== 0) return primary;

    // Secondary: more missing docs first.
    return b.missingTypes.length - a.missingTypes.length;
  });

  // The newest ingestion across the components, i.e. how fresh the documentation
  // these gaps were read from actually is.
  const lastIngestedAt = overview.gaps
    .map((gap) => gap.lastIngested)
    .reduce<string | null>((newest, at) => (!newest || at > newest ? at : newest), null);
  // Falls back to a gap's own stamp for a backend that predates the field; the
  // gaps are rebuilt as one set, so any row's stamp is the set's.
  const lastAnalyzedAt = overview.refreshedAt ?? overview.gaps[0]?.refreshedAt ?? null;

  const toggleSeverityFilter = (severity: KnowledgeGapSeverity) => {
    setSeverityFilter((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    );
  };

  const headerActions = (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {refreshButton}
      {/* Both, because they answer different questions: how old the
          documentation is, and how old this reading of it is. A scan
          is only ever as current as the ingestion behind it. */}
      {lastIngestedAt && (
        <span className="text-xs text-app-text-muted">
          Last ingested {formatRelativeDate(lastIngestedAt)}
        </span>
      )}
      {lastAnalyzedAt && (
        <span className="text-xs text-app-text-muted">
          Last analyzed {formatRelativeDate(lastAnalyzedAt)}
        </span>
      )}
    </div>
  );

  return (
    <PageShell
      icon={PAGE_ICON}
      title={PAGE_TITLE}
      subtitle={PAGE_SUBTITLE}
      frame="content"
      back={PAGE_BACK}
      actions={headerActions}
      bandExtra={<SeveritySummaryBar gaps={overview.gaps} />}
      mainClassName="py-8"
    >
      {/* Filter & sort controls. Always visible rather than behind a
            disclosure: there are only four controls, and hiding them meant the
            active filter state was invisible from the collapsed view. Severity
            toggles sit on the left, the sort order is pushed to the far right
            of the same row. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
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
              <motion.button
                key={severity}
                type="button"
                // These are toggles, not a single choice -- `aria-pressed`
                // is what tells assistive tech which severities are
                // currently included.
                aria-pressed={isSelected}
                onClick={() => toggleSeverityFilter(severity)}
                {...buttonHoverMotion}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? badge
                    : "border border-app-border/70 bg-app-surface/70 text-app-text-muted backdrop-blur-md hover:border-app-brand-border-strong hover:text-app-text"
                }`}
              >
                {label}
              </motion.button>
            );
          })}
        </div>

        <span className="text-xs text-app-text-muted tabular-nums">
          {filtered.length} of {overview.gaps.length}
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

      {/* There is no tab bar on this page, so the moving part is the list
            itself: `layout` makes rows glide to their new position when the
            sort order changes, and AnimatePresence fades out the ones a
            severity filter removes instead of snapping the list shut. */}
      {/* No `layout` on the container on purpose: a layout-animating parent
            counter-scales its layout-animating children, and a row re-entering
            an empty list is measured against a near-zero box, which turns that
            correction into a huge scale that snaps back. The container resizing
            without animation costs nothing visually. */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map((gap) => {
            const { badge, label } = SEVERITY_STYLES[gap.severity];
            const owner = gap.owners[0] ?? null;

            return (
              <motion.button
                key={gap.id}
                // `layout="position"` rather than `layout`: it animates only
                // where the row sits, never its measured size, so no scale
                // correction is ever applied. Plain `layout` is what made a
                // re-appearing row flash at the wrong size.
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                // No scale here either: `scale` is owned by the CSS hover on
                // this same element, and two owners for one property fight.
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => void navigate(`/insights/knowledge-gaps/${gap.id}`)}
                // The transition list is explicit rather than `transition-all`:
                // Framer Motion drives `opacity` and `transform` inline on this
                // element, and a CSS transition covering those properties would
                // try to ease every frame the animation writes -- which is what
                // made a returning row flicker. CSS keeps only what it owns.
                className="flex w-full items-stretch gap-3 rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-[scale,background-color,border-color,box-shadow] duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
              >
                <SeverityBar severity={gap.severity} />

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-base font-medium text-app-text">{gap.component}</span>

                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge}`}>
                      {label}
                    </span>
                  </div>

                  {/* Missing document types, or what a covered component has
                        instead — "Missing documentation (0)" over an empty row
                        would say nothing about a component that is fine. */}
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text-muted">
                      <FileText className="h-3.5 w-3.5" />
                      {gap.missingTypes.length === 0
                        ? `All expected documentation present (${gap.presentTypes?.length ?? 0})`
                        : `Missing documentation (${gap.missingTypes.length})`}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(gap.missingTypes.length === 0
                        ? (gap.presentTypes ?? [])
                        : gap.missingTypes
                      ).map((type) => (
                        <span
                          key={type}
                          className="rounded border border-app-border bg-app-surface-muted px-2 py-1 text-xs"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-app-text-muted">
                    <span className="flex min-w-0 items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {owner ? `${owner.firstname} ${owner.lastname}` : "Unassigned"}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeDate(gap.lastIngested)}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </PageShell>
  );
}
