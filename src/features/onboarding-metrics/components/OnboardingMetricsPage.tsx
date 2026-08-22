import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Gauge,
  Loader2,
} from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { useFetch } from "../../../hooks/useFetch";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { useProjectContext } from "../../projects/useProjectContext";
import { HireTimelineCard } from "./HireTimelineCard";
import { StatTile } from "./StatTile";
import { formatDuration } from "../format";
import type { HireTimeline } from "../types";

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
 * time-to-first-accepted-work, response latency, and — first, as the call to action —
 * who is stalled.
 *
 * Deliberately a measurement readout, not another dashboard: no completion
 * percentages, because progress is what somebody has proven rather than how far
 * through a list they are. Metrics are per-project (onboarding is per-project), so a switcher
 * scopes it; PM/HR/ADMIN only. Empty states separate "no hires yet" from "no
 * data yet".
 */
export function OnboardingMetricsPage() {
  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();

  const {
    data: metrics,
    loading,
    error,
  } = useFetch(
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
    [selectedProjectId],
  );

  // Stalled hires lead the per-hire list — they are what a PM should act on today.
  const orderedHires = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.hires].sort((a, b) => Number(b.stalled) - Number(a.stalled));
  }, [metrics]);

  const stalledHires = useMemo(
    () => (metrics ? metrics.hires.filter((hire) => hire.stalled) : []),
    [metrics],
  );

  const header = (
    <header className="border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Gauge}
          title="Onboarding metrics"
          subtitle="Time to a first accepted piece of work, response latency, and who is stalled — the measures the onboarding redesign is judged on."
        />
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      {header}

      <main className="app-page-frame space-y-6 py-6 lg:py-8">
        {!projectsLoading && projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8 text-app-text-disabled" />}
            title="No projects"
            body="There are no projects to report on yet."
          />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-app-brand" aria-hidden="true" />
          </div>
        ) : error ? (
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
            title="Couldn't load metrics"
            body="The onboarding metrics couldn't be loaded. Try again shortly."
          />
        ) : !metrics || metrics.memberCount === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8 text-app-text-disabled" />}
            title="No hires yet"
            body="Once people join this project, their onboarding shows up here."
          />
        ) : !hasActivity(metrics.hires) ? (
          <EmptyState
            icon={<Gauge className="h-8 w-8 text-app-text-disabled" />}
            title="No data yet"
            body="These metrics fill in as hires claim tasks, submit work, and get responses. Nothing has happened yet — that's different from nobody being here."
          />
        ) : (
          <>
            {/* Stalls first: the primary call to action, never a footnote. */}
            <section className="rounded-3xl border border-app-border bg-app-bg p-5 shadow-sm">
              {stalledHires.length > 0 ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-app-warning-solid" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-app-text">
                      {stalledHires.length} hire
                      {stalledHires.length === 1 ? "" : "s"} stalled
                    </h2>
                  </div>
                  <p className="mb-4 text-sm text-app-text-muted">
                    The thing to act on today. Where the wait is on a review, the fix is a
                    conversation with the reviewer — not a nudge to the hire.
                  </p>
                  <ul className="space-y-2">
                    {stalledHires.map((hire) => (
                      <li
                        key={hire.userId}
                        className="flex items-start justify-between gap-3 rounded-xl border border-app-warning-border bg-app-warning-bg/40 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-app-text">{hire.displayName}</p>
                          <p className="text-xs text-app-text-muted">
                            {hire.stalledReason ?? "Stalled"}
                          </p>
                        </div>
                        {hire.longestOpenWaitHours !== null && (
                          <span className="shrink-0 text-xs font-medium text-app-warning-text">
                            {formatDuration(hire.longestOpenWaitHours)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-app-success-solid" aria-hidden="true" />
                  <p className="text-sm text-app-text">Nobody is stalled right now.</p>
                </div>
              )}
            </section>

            {/* Aggregates. Medians throughout so one outlier can't move the number. */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Median time to first accepted work"
                value={formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
                hint={`${metrics.hiresWithAcceptedContribution} of ${metrics.memberCount} have had work accepted`}
              />
              <StatTile
                label="Median first-review wait"
                value={formatDuration(metrics.medianHoursToFirstResponse)}
                hint="Opened → first response"
              />
              <StatTile
                label="90th-percentile review wait"
                value={formatDuration(metrics.p90HoursToFirstResponse)}
                hint="The slow tail, where the barrier bites"
              />
              <StatTile
                label="Waiting on a review"
                value={metrics.waitingOnResponseCount}
                hint={
                  metrics.unattributableMemberCount > 0
                    ? `${metrics.unattributableMemberCount} unattributable (no GitHub login)`
                    : undefined
                }
              />
            </section>

            {/* Per-hire timelines, stalled first. */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-app-text">Per-hire timelines</h2>
              {orderedHires.map((hire) => (
                <HireTimelineCard key={hire.userId} hire={hire} />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-app-border bg-app-surface p-16 text-center">
      {icon}
      <h2 className="text-lg font-semibold text-app-text">{title}</h2>
      <p className="max-w-md text-sm text-app-text-muted">{body}</p>
    </div>
  );
}
