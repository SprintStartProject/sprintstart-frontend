import { ChartPie } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import { phaseSpread, teamProgressData } from "../../teamProgress";
import { DonutChart } from "../charts/DonutChart";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";
import { OnboardingHealthSummary, RecentMilestones } from "./InsightCards";

/** How many phases the spread lists before folding the rest into "+n more". */
const PHASES = 4;

type TeamProgressCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
};

/**
 * The team and its onboarding in one band, three readings side by side: where everybody is (the
 * stages, and which phases the ones underway sit in), how far the hires have come towards
 * accepted work (the funnel and its four figures), and what happened lately (the newest
 * milestones, and to whom).
 *
 * It used to be a big card with a ring on one side and the funnel on the other and a lot of air
 * in between; the same height now carries the phases and the latest milestones too.
 */
export function TeamProgressCard({ roster, loading, error }: TeamProgressCardProps) {
  const { stages, averageProgress } = teamProgressData(roster);
  const phases = phaseSpread(roster);
  const shownPhases = phases.slice(0, PHASES);
  const folded = phases.slice(PHASES).reduce((sum, phase) => sum + phase.count, 0);
  const busiest = Math.max(1, ...phases.map((phase) => phase.count));

  return (
    <PmCard aria-label="Team progress" tone="brand" className="h-full">
      <PmCardHeader
        icon={ChartPie}
        tone="brand"
        title="Team progress"
        meta={
          !loading && !error ? `${roster.length} members · ${averageProgress}% avg.` : undefined
        }
        action={<PmCardLink to="/team-management">Team</PmCardLink>}
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] xl:gap-0">
        {/* Where the team is. */}
        <section aria-label="Where the team is" className="min-w-0 xl:pr-6">
          <PmEyebrow className="mb-3">Where the team is</PmEyebrow>
          {loading ? (
            <SkeletonGroup label="Loading team progress">
              <SkeletonLine className="h-24 w-24 rounded-full" />
            </SkeletonGroup>
          ) : error ? (
            <EmptyState size="sm">The team could not be loaded.</EmptyState>
          ) : roster.length === 0 ? (
            <EmptyState size="sm">Nobody on this project yet.</EmptyState>
          ) : (
            <>
              <DonutChart
                data={stages}
                ariaLabel="Team by onboarding stage"
                size={104}
                thickness={11}
                center={
                  <>
                    <span className="text-lg leading-none font-bold text-app-text">
                      {averageProgress}%
                    </span>
                    <span className="mt-0.5 text-[10px] text-app-text-muted">avg.</span>
                  </>
                }
              />
              {shownPhases.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-medium text-app-text-muted">
                    Underway, by phase
                  </p>
                  <ul className="space-y-1.5">
                    {shownPhases.map((phase) => (
                      <li
                        key={phase.title}
                        className="grid grid-cols-[minmax(0,1fr)_4rem_1.25rem] items-center gap-2 text-xs"
                      >
                        <span className="truncate text-app-text" title={phase.title}>
                          {phase.title}
                        </span>
                        <span
                          aria-hidden="true"
                          className="block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
                        >
                          <span
                            className="block h-full rounded-full bg-app-brand"
                            style={{ width: `${(phase.count / busiest) * 100}%` }}
                          />
                        </span>
                        <span className="text-right font-semibold text-app-text tabular-nums">
                          {phase.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {folded > 0 && (
                    <p className="mt-1.5 text-[11px] text-app-text-subtle">
                      +{folded} in {phases.length - PHASES} more{" "}
                      {phases.length - PHASES === 1 ? "phase" : "phases"}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* How far the hires have come. */}
        <div className="min-w-0 xl:border-l xl:border-app-border xl:px-6">
          <OnboardingHealthSummary />
        </div>

        {/* What happened lately. */}
        <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-app-border xl:pl-6">
          <RecentMilestones />
        </div>
      </div>
    </PmCard>
  );
}
