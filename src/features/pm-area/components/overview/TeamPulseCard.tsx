import { Users } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import { daysOnStep, memberStage } from "../../memberStatus";
import { MemberRow } from "../MemberRow";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

const VISIBLE_MEMBERS = 7;

type TeamPulseCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * Who on the team is still on the way — longest on their step first, since that is the order
 * a manager checks in on people.
 *
 * Just the people, no stage breakdown on top: the rows already say where each person is, and
 * the counts per stage are one press away on the team page's filters.
 */
export function TeamPulseCard({ roster, loading, error, onOpenMember }: TeamPulseCardProps) {
  const doneCount = roster.filter((member) => memberStage(member) === "done").length;

  const onTheWay = roster
    .filter((member) => memberStage(member) !== "done")
    .sort((a, b) => (daysOnStep(b) ?? -1) - (daysOnStep(a) ?? -1));
  const visible = onTheWay.slice(0, VISIBLE_MEMBERS);

  return (
    <PmCard aria-label="Team" className="h-full" to="/team-management" linkLabel="Open the team">
      <PmCardHeader
        icon={Users}
        title="Team"
        meta={
          loading || error
            ? undefined
            : `${roster.length} members · ${doneCount} through onboarding`
        }
        action={<PmCardLink to="/team-management">All members</PmCardLink>}
      />

      {loading ? (
        <SkeletonGroup label="Loading team" className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLine key={index} className="h-9 w-full" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <>
          <PmEyebrow className="mb-1 flex items-center justify-between">
            <span>Still on the way</span>
            {onTheWay.length > visible.length && (
              <span className="tracking-normal text-app-text-subtle normal-case">
                longest on their step first · {visible.length} of {onTheWay.length}
              </span>
            )}
          </PmEyebrow>
          {visible.length === 0 ? (
            <p className="py-3 text-sm text-app-text-muted">Everybody is through onboarding.</p>
          ) : (
            <div className="-mx-3">
              {visible.map((member) => (
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
