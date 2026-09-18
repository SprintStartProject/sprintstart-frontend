import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  FolderKanban,
  Gauge,
  Hourglass,
  Inbox,
  LayoutGrid,
  RefreshCw,
  Rocket,
  Search,
  Users,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import { Input } from "../../../components/ui/Input";
import { Pagination } from "../../../components/ui/Pagination";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { useToast } from "../../../context/useToast";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { queryKeys } from "../../../services/queryKeys";
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { useProjectContext } from "../../projects/useProjectContext";
import { HireTimelineCard } from "./HireTimelineCard";
import { StatTile } from "./StatTile";
import { formatDuration } from "../format";
import { isAwaitingFirstResponse } from "../hireStatus";
import type { HireTimeline } from "../types";

/** Narrows the per-hire list to those a PM might act on, for a busy project. */
type HireFilter = "all" | "attention";

/** How many hire timelines to show per page before the list paginates. */
const HIRES_PER_PAGE = 8;

/**
 * A hire worth a second look — the same two states the card flags on its face:
 * stalled (the drifting highlight), or genuinely waiting on a first response (the
 * "Waiting … on a response" badge).
 *
 * Deliberately NOT "has any open contribution": an active contributor almost
 * always has work in flight, so that clause flagged healthy hires too and made
 * the filter a no-op (everyone matched). Waiting means a contribution was opened
 * and no response has come back yet.
 */
function needsAttention(hire: HireTimeline): boolean {
  return hire.stalled || isAwaitingFirstResponse(hire);
}

/**
 * Whether any hire has actually done something — distinguishes "no data" from "no hires".
 *
 * Deliberately NOT `joinedAt`: a hire always has a join date the moment they exist,
 * so counting it would make this always true and the "no data yet" state unreachable.
 * "Activity" means claimed, opened, accepted, or open work — something happened.
 */
function hasActivity(hires: HireTimeline[]): boolean {
  return hires.some(
    (hire) =>
      hire.firstTaskClaimedAt !== null ||
      hire.firstContributionOpenedAt !== null ||
      hire.acceptedContributionCount > 0 ||
      hire.openContributionCount > 0,
  );
}

/** Matches the `grid grid-cols-2 gap-3 lg:grid-cols-4` layout of {@link StatTile}. */
function StatTileSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-app-border bg-app-surface p-4 sm:p-[18px]">
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-24" />
        <SkeletonBlock className="h-[18px] w-[18px]" />
      </div>
      <SkeletonLine className="mt-auto h-8 w-16" />
      <SkeletonLine className="mt-1 w-20" />
    </div>
  );
}

/** Matches {@link HireTimelineCard}'s avatar row and five-step moment rail. */
function HireTimelineCardSkeleton() {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5">
      <div className="flex flex-1 items-center gap-3">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-1/4" />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-4 overflow-x-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex w-20 shrink-0 flex-col items-center gap-2">
            <SkeletonBlock className="h-9 w-9 rounded-full" />
            <SkeletonLine className="w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingMetricsSkeleton() {
  return (
    <SkeletonGroup label="Loading onboarding metrics" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <HireTimelineCardSkeleton key={index} />
        ))}
      </div>
    </SkeletonGroup>
  );
}

/**
 * The PM readout for the numbers the onboarding redesign is judged on:
 * time-to-first-accepted-work, response latency, and who is stalled. The
 * aggregates lead, and the per-hire timelines follow, stalled first.
 *
 * Deliberately a measurement readout, not another dashboard: no completion
 * percentages, because progress is what somebody has proven rather than how far
 * through a list they are. Metrics are per-project (onboarding is per-project), so the
 * global project switcher scopes it; PM/HR/ADMIN only. Empty states separate "no hires yet"
 * from "no data yet".
 *
 * Reached from the PM Dashboard "Insights" group; the frame matches its sibling insights
 * pages (`FaqPage`, `KnowledgeGapsPage`): a centered column, a Back button, a header Refresh
 * that refetches (the metrics are derived on request, so there is no pipeline to trigger),
 * and toast feedback.
 */
export function OnboardingMetricsPage() {
  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const navigate = useNavigate();
  const toast = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [hireFilter, setHireFilter] = useState<HireFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Set when a manual refresh is in flight, so the completion effect can tell the
  // user what the refetch turned up without also firing on the first load.
  const pendingRefreshRef = useRef(false);
  // One load-error toast per failed load, reset once a load succeeds again.
  const errorToastRef = useRef(false);
  // The project we last warned about missing GitHub logins for, so the warning
  // fires once per selection rather than on every refetch.
  const warnedProjectRef = useRef<string | null>(null);

  const {
    data: metrics,
    loading,
    error,
    refetchError,
    isFetching,
    refetch,
  } = useQueryFetch(queryKeys.onboardingMetrics.project(selectedProjectId), () =>
    selectedProjectId
      ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
      : Promise.resolve(null),
  );

  const showLoadingSkeleton = useDelayedFlag(loading);

  const handleRefresh = () => {
    if (!selectedProjectId) return;
    pendingRefreshRef.current = true;
    setRefreshing(true);
    refetch();
  };

  // After a manual refresh settles, say what it found. The empty states below
  // already carry the "no hires" case, so this only speaks up for real outcomes.
  useEffect(() => {
    if (isFetching || !pendingRefreshRef.current) return;
    pendingRefreshRef.current = false;
    setRefreshing(false);
    if (error || refetchError) {
      toast.error("Couldn't refresh onboarding metrics", { description: "Try again shortly." });
      return;
    }
    if (!metrics || metrics.memberCount === 0) return;
    if (!hasActivity(metrics.hires)) {
      toast.info("No onboarding activity yet", {
        description:
          "Nothing has happened on this project yet — that's different from nobody being here.",
      });
    } else {
      toast.success("Metrics refreshed");
    }
  }, [isFetching, error, refetchError, metrics, toast]);

  // A load failure that wasn't a manual refresh still deserves a toast, once.
  useEffect(() => {
    if (isFetching) return;
    if (!error) {
      errorToastRef.current = false;
      return;
    }
    if (!errorToastRef.current && !pendingRefreshRef.current) {
      errorToastRef.current = true;
      toast.error("Couldn't load onboarding metrics", {
        description: "The onboarding metrics couldn't be loaded. Try again shortly.",
      });
    }
  }, [isFetching, error, toast]);

  // Warn once per project when some hires have no GitHub login, since their work
  // can't be attributed and the numbers below quietly exclude it.
  useEffect(() => {
    if (isFetching || error || !metrics) return;
    if (metrics.unattributableMemberCount > 0 && warnedProjectRef.current !== metrics.projectId) {
      warnedProjectRef.current = metrics.projectId;
      toast.warning(
        `${metrics.unattributableMemberCount} hire${
          metrics.unattributableMemberCount === 1 ? "" : "s"
        } can't be attributed`,
        { description: "They have no GitHub login, so their work is left out of these numbers." },
      );
    }
  }, [isFetching, error, metrics, toast]);

  // Stalled hires lead the per-hire list — they are what a PM should act on today.
  const orderedHires = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.hires].sort((a, b) => Number(b.stalled) - Number(a.stalled));
  }, [metrics]);

  const hireFilterOptions: FilterSelectOption<HireFilter>[] = [
    { value: "all", label: "All hires" },
    { value: "attention", label: "Needs attention only" },
  ];

  const filteredHires = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderedHires.filter((hire) => {
      if (hireFilter === "attention" && !needsAttention(hire)) return false;
      if (!query) return true;
      return (
        hire.displayName.toLowerCase().includes(query) ||
        (hire.githubLogin?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [orderedHires, hireFilter, search]);

  // A changed filter or search re-slices the list, so start back at the first
  // page. Done in the change handlers (not an effect) to avoid a cascading render.
  const handleFilterChange = (value: HireFilter) => {
    setHireFilter(value);
    setPage(1);
  };
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredHires.length / HIRES_PER_PAGE));
  // Clamp in case the list shrank under the current page (e.g. after filtering).
  const currentPage = Math.min(page, totalPages);
  const pagedHires = filteredHires.slice(
    (currentPage - 1) * HIRES_PER_PAGE,
    currentPage * HIRES_PER_PAGE,
  );

  const refreshButton = (
    <Button
      variant="primary"
      onClick={handleRefresh}
      loading={refreshing}
      disabled={!selectedProjectId}
      icon={<RefreshCw className="h-4 w-4" />}
      className="shrink-0"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      <section aria-label="Page header" className="border-b border-app-border bg-app-bg/90">
        <div className="app-page-content py-8">
          <Button
            variant="ghost"
            onClick={() => void navigate("/pm-dashboard")}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back to PM-Dashboard
          </Button>

          <div className="flex items-start justify-between gap-4">
            <PageHeader
              icon={Gauge}
              title="Onboarding metrics"
              subtitle="Track each new hire's path from joining to their first accepted contribution, and where they get held up."
            />
            {refreshButton}
          </div>
        </div>
      </section>

      <main className="app-page-content space-y-6 py-8">
        {!projectsLoading && projects.length === 0 ? (
          <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No projects">
            There are no projects to report on yet.
          </EmptyState>
        ) : showLoadingSkeleton ? (
          <OnboardingMetricsSkeleton />
        ) : loading ? null : error ? (
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
            title="Couldn't load metrics"
          >
            The onboarding metrics couldn&apos;t be loaded. Try again shortly.
          </EmptyState>
        ) : !metrics || metrics.memberCount === 0 ? (
          <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="No hires yet">
            Once people join this project, their onboarding shows up here.
          </EmptyState>
        ) : !hasActivity(metrics.hires) ? (
          <EmptyState icon={<Gauge className="h-8 w-8" />} title="No data yet">
            These metrics fill in as hires claim tasks, submit work, and get responses. Nothing has
            happened yet — that&apos;s different from nobody being here.
          </EmptyState>
        ) : (
          <>
            {/* Aggregates. Medians throughout so one outlier can't move the number. */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-app-brand" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-tight text-app-text">Overview</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  icon={<Rocket size={18} />}
                  accent="brand"
                  label="Median time to first accepted work"
                  value={formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
                  hint={`${metrics.hiresWithAcceptedContribution} of ${metrics.memberCount} have had work accepted`}
                />
                <StatTile
                  icon={<Clock size={18} />}
                  accent="brand"
                  label="Median first-review wait"
                  value={formatDuration(metrics.medianHoursToFirstResponse)}
                  hint="Opened → first response"
                />
                <StatTile
                  icon={<Hourglass size={18} />}
                  accent="warning"
                  label="90th-percentile review wait"
                  value={formatDuration(metrics.p90HoursToFirstResponse)}
                  hint="The slow tail, where the barrier bites"
                />
                <StatTile
                  icon={<Inbox size={18} />}
                  accent={metrics.waitingOnResponseCount > 0 ? "warning" : "neutral"}
                  label="Waiting on a review"
                  value={metrics.waitingOnResponseCount}
                  hint={
                    metrics.unattributableMemberCount > 0
                      ? `${metrics.unattributableMemberCount} unattributable (no GitHub login)`
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Per-hire timelines, stalled first. */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-app-brand" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-tight text-app-text">
                  Per-hire timelines
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  size="sm"
                  icon={<Search className="h-4 w-4" />}
                  aria-label="Search hires by name"
                  placeholder="Search hires…"
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="min-w-0 flex-1"
                />
                <FilterSelect
                  label="Filter hires"
                  value={hireFilter}
                  options={hireFilterOptions}
                  onChange={handleFilterChange}
                  className="w-56 shrink-0"
                />
              </div>
              {filteredHires.length === 0 ? (
                <EmptyState size="sm">
                  {search.trim()
                    ? "No hires match your search."
                    : "No hires need attention right now."}
                </EmptyState>
              ) : (
                <>
                  {pagedHires.map((hire) => (
                    <HireTimelineCard key={hire.userId} hire={hire} />
                  ))}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
