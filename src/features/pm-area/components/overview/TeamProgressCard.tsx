import { ChartPie } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import { teamProgressData } from "../../teamProgress";
import { DonutChart } from "../charts/DonutChart";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";
import { OnboardingHealthSummary } from "./InsightCards";

type TeamProgressCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
};

/**
 * The team and its onboarding in one picture: where everybody is (a ring of stages with the
 * average progress in the middle) beside how far the hires have come towards accepted work (the
 * onboarding funnel and its four figures).
 *
 * The right half used to chart time on the current step. That is already on every row of the team
 * list below, where the people it is about are, so the space went to the onboarding readout, which
 * used to be a card of its own in another row.
 */
export function TeamProgressCard({ roster, loading, error }: TeamProgressCardProps) {
  const { stages, averageProgress } = teamProgressData(roster);

  return (
    <PmCard aria-label="Team progress" tone="brand" className="h-full">
      <PmCardHeader
        icon={ChartPie}
        tone="brand"
        title="Team progress"
        meta={!loading && !error ? `${roster.length} members` : undefined}
        action={<PmCardLink to="/team-management">Team</PmCardLink>}
      />

      <div className="grid flex-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
        <div>
          <PmEyebrow className="mb-3">Onboarding stage</PmEyebrow>
          {loading ? (
            <SkeletonGroup label="Loading team progress">
              <SkeletonLine className="h-32 w-32 rounded-full" />
            </SkeletonGroup>
          ) : error ? (
            <EmptyState size="sm">The team could not be loaded.</EmptyState>
          ) : roster.length === 0 ? (
            <EmptyState size="sm">Nobody on this project yet.</EmptyState>
          ) : (
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
          )}
        </div>

        {/* A hairline between the two halves on wide screens, where they sit side by side. */}
        <div className="min-w-0 lg:border-l lg:border-app-border lg:pl-8">
          <OnboardingHealthSummary />
        </div>
      </div>
    </PmCard>
  );
}
