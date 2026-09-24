import { ChartPie } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import { AT_RISK_AFTER_DAYS } from "../../memberStatus";
import { teamProgressData } from "../../teamProgress";
import { ColumnChart } from "../charts/ColumnChart";
import { DonutChart } from "../charts/DonutChart";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

type TeamProgressCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
};

/**
 * The team as two pictures: where everybody is in onboarding, and how long the ones underway
 * have been sitting on their current step. The first says how far the team has come; the
 * second is where a stuck hire shows up before anybody has to ask — the bins past
 * {@link AT_RISK_AFTER_DAYS} days are drawn in the warning colour and called out beside it.
 */
export function TeamProgressCard({ roster, loading, error }: TeamProgressCardProps) {
  const { stages, stepBins, averageProgress, atRisk } = teamProgressData(roster);

  return (
    <PmCard
      aria-label="Team progress"
      tone="brand"
      className="h-full"
      to="/team-management"
      linkLabel="Open the team"
    >
      <PmCardHeader
        icon={ChartPie}
        tone="brand"
        title="Team progress"
        meta={!loading && !error ? `${roster.length} members` : undefined}
        action={<PmCardLink to="/team-management">Team</PmCardLink>}
      />

      {loading ? (
        <SkeletonGroup label="Loading team progress" className="flex gap-6">
          <SkeletonLine className="h-32 w-32 rounded-full" />
          <SkeletonLine className="h-32 flex-1" />
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team could not be loaded.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody on this project yet.</EmptyState>
      ) : (
        <div className="grid flex-1 content-center items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div>
            <PmEyebrow className="mb-3">Onboarding stage</PmEyebrow>
            <DonutChart
              data={stages}
              ariaLabel="Team by onboarding stage"
              center={
                <>
                  <span className="text-2xl leading-none font-bold text-app-text">
                    {averageProgress}%
                  </span>
                  <span className="mt-1 text-[11px] text-app-text-muted">avg. progress</span>
                </>
              }
            />
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <PmEyebrow>Time on current step</PmEyebrow>
              {atRisk > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-app-text-muted">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-app-warning-solid" />
                  {atRisk} over {AT_RISK_AFTER_DAYS} days
                </span>
              )}
            </div>
            <ColumnChart data={stepBins} ariaLabel="Members underway by time on their step" />
          </div>
        </div>
      )}
    </PmCard>
  );
}
