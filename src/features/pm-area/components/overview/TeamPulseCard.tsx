import { Users } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import { WidgetBar } from "../../../dashboard/components/WidgetBar";
import type { TeamOverviewUser } from "../../../team-management/types";
import { daysOnStep, memberStage } from "../../memberStatus";
import { MemberRow } from "../MemberRow";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

const VISIBLE_MEMBERS = 5;

type TeamPulseCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * How the team is spread across the onboarding, and who is still on the way — longest on
 * their step first, since that is the order a manager checks in on people.
 */
export function TeamPulseCard({ roster, loading, error, onOpenMember }: TeamPulseCardProps) {
  const counts = {
    done: roster.filter((member) => memberStage(member) === "done").length,
    underway: roster.filter((member) => memberStage(member) === "underway").length,
    notStarted: roster.filter((member) => memberStage(member) === "not-started").length,
  };

  const onTheWay = roster
    .filter((member) => memberStage(member) !== "done")
    .sort((a, b) => (daysOnStep(b) ?? -1) - (daysOnStep(a) ?? -1))
    .slice(0, VISIBLE_MEMBERS);

  return (
    <PmCard aria-label="Team" className="h-full">
      <PmCardHeader
        icon={Users}
        title="Team"
        meta={loading || error ? undefined : `${roster.length} members`}
        action={<PmCardLink to="/team-management">All members</PmCardLink>}
      />

      {loading ? (
        <SkeletonGroup label="Loading team" className="space-y-3">
          <SkeletonLine className="h-2 w-full rounded-full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLine key={index} className="h-9 w-full" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team overview could not be loaded.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <>
          <WidgetBar
            segments={[
              { label: "done", value: counts.done, className: "bg-app-success-solid" },
              { label: "underway", value: counts.underway, className: "bg-app-brand" },
              { label: "not started", value: counts.notStarted, className: "bg-app-border" },
            ]}
          />

          <PmEyebrow className="mt-5 mb-1">Still on the way</PmEyebrow>
          {onTheWay.length === 0 ? (
            <p className="py-3 text-sm text-app-text-muted">Everybody is through onboarding.</p>
          ) : (
            <div className="-mx-3">
              {onTheWay.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  density="compact"
                  onOpen={onOpenMember}
                />
              ))}
            </div>
          )}
        </>
      )}
    </PmCard>
  );
}
