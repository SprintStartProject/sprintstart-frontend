import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import {
  STAGE_COLOR,
  STAGE_LABEL,
  daysOnStep,
  memberStage,
  type MemberStage,
} from "../../memberStatus";
import { MemberRow } from "../MemberRow";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

const VISIBLE_MEMBERS = 6;

/** The three stages, in the order a hire moves through them. */
const STAGES: MemberStage[] = ["not-started", "underway", "done"];

type TeamPulseCardProps = {
  roster: TeamOverviewUser[];
  loading: boolean;
  error: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * How the team is spread across the onboarding, and who is still on the way — longest on
 * their step first, since that is the order a manager checks in on people.
 *
 * The spread used to be a bar with a legend underneath ("3 done · 1 underway"), which read as a
 * footnote. The counts are the point, so they are figures now, one per stage and in the order a
 * hire passes through them — and each is a shortcut to the team filtered to that stage.
 */
export function TeamPulseCard({ roster, loading, error, onOpenMember }: TeamPulseCardProps) {
  const counts: Record<MemberStage, number> = {
    "not-started": 0,
    underway: 0,
    done: 0,
  };
  for (const member of roster) counts[memberStage(member)] += 1;

  const onTheWay = roster
    .filter((member) => memberStage(member) !== "done")
    .sort((a, b) => (daysOnStep(b) ?? -1) - (daysOnStep(a) ?? -1));
  const visible = onTheWay.slice(0, VISIBLE_MEMBERS);

  return (
    <PmCard aria-label="Team" className="h-full" to="/team-management" linkLabel="Open the team">
      <PmCardHeader
        icon={Users}
        title="Team"
        meta={loading || error ? undefined : `${roster.length} members`}
        action={<PmCardLink to="/team-management">All members</PmCardLink>}
      />

      {loading ? (
        <SkeletonGroup label="Loading team" className="space-y-3">
          <SkeletonLine className="h-14 w-full rounded-xl" />
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
          <div>
            <ul aria-label="Onboarding stages" className="grid grid-cols-3 gap-2">
              {STAGES.map((stage) => (
                <li key={stage}>
                  <Link
                    to={`/team-management?filter=${stage}`}
                    className="block rounded-xl border border-app-border-muted bg-app-bg-soft px-3 py-2 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-app-text-muted">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${STAGE_COLOR[stage]}`}
                      />
                      {STAGE_LABEL[stage]}
                    </span>
                    <span className="mt-0.5 block text-xl font-bold text-app-text tabular-nums">
                      {counts[stage]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div
              aria-hidden="true"
              className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-app-surface-muted"
            >
              {STAGES.filter((stage) => counts[stage] > 0).map((stage) => (
                <div
                  key={stage}
                  className={`rounded-full ${STAGE_COLOR[stage]}`}
                  style={{ width: `${(counts[stage] / roster.length) * 100}%` }}
                />
              ))}
            </div>
          </div>

          <PmEyebrow className="mt-5 mb-1 flex items-center justify-between">
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
