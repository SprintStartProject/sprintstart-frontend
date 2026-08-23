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
  Loader2,
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
import { useFetch } from "../../../hooks/useFetch";
import { useToast } from "../../../context/useToast";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { useProjectContext } from "../../projects/useProjectContext";
import { HireTimelineCard } from "./HireTimelineCard";
import { StatTile } from "./StatTile";
import { formatDuration } from "../format";
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
  const awaitingFirstResponse =
    hire.firstContributionOpenedAt !== null &&
    hire.firstResponseAt === null &&
    hire.openContributionCount > 0;
  return hire.stalled || awaitingFirstResponse;
}

/** Whether any hire has reached any tracked moment — distinguishes "no data" from "no hires". */
function hasActivity(hires: HireTimeline[]): boolean {
  return hires.some(
    (hire) =>
      hire.joinedAt !== null ||
      hire.firstTaskClaimedAt !== null ||
      hire.firstContributionOpenedAt !== null ||
      hire.acceptedContributionCount > 0 ||
      hire.openContributionCount > 0,
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

  const [refreshKey, setRefreshKey] = useState(0);
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
  } = useFetch(
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
    [selectedProjectId, refreshKey],
  );

  const handleRefresh = () => {
    if (!selectedProjectId) return;
    pendingRefreshRef.current = true;
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  // After a manual refresh settles, say what it found. The empty states below
  // already carry the "no hires" case, so this only speaks up for real outcomes.
  useEffect(() => {
    if (loading || !pendingRefreshRef.current) return;
    pendingRefreshRef.current = false;
    setRefreshing(false);
    if (error) {
      toast.error("Couldn't refresh onboarding metrics", { description: "Try again shortly." });
      return;
    }
    if (!metrics || metrics.memberCount === 0) return;
    if (!hasActivity(metrics.hires)) {
      toast.info("No onboarding activity yet", {
        description: "Nothing has happened on this project yet — that's different from nobody being here.",
      });
    } else {
      toast.success("Metrics refreshed");
    }
  }, [loading, error, metrics, toast]);

  // A load failure that wasn't a manual refresh still deserves a toast, once.
  useEffect(() => {
    if (loading) return;
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
  }, [loading, error, toast]);

  // Warn once per project when some hires have no GitHub login, since their work
  // can't be attributed and the numbers below quietly exclude it.
  useEffect(() => {
    if (loading || error || !metrics) return;
    if (metrics.unattributableMemberCount > 0 && warnedProjectRef.current !== metrics.projectId) {
      warnedProjectRef.current = metrics.projectId;
      toast.warning(
        `${metrics.unattributableMemberCount} hire${
          metrics.unattributableMemberCount === 1 ? "" : "s"
        } can't be attributed`,
        { description: "They have no GitHub login, so their work is left out of these numbers." },
      );
    }
  }, [loading, error, metrics, toast]);

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
              subtitle="Time to a first accepted piece of work, response latency, and who is stalled — the measures the onboarding redesign is judged on."
            />
            {refreshButton}
          </div>
        </div>
      </section>

      <main className="app-page-content space-y-6 py-8">
        {!projectsLoading && projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title="No projects"
          >
            There are no projects to report on yet.
          </EmptyState>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-app-brand" aria-hidden="true" />
          </div>
        ) : error ? (
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
            title="Couldn't load metrics"
          >
            The onboarding metrics couldn&apos;t be loaded. Try again shortly.
          </EmptyState>
        ) : !metrics || metrics.memberCount === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title="No hires yet"
          >
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
