import { CheckCircle2, Users } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import type { AttentionEntry } from "../../attentionQueue";
import { daysOnStep, memberStage } from "../../memberStatus";
import { MemberRow } from "../MemberRow";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

/** How many people the card lists before it hands over to the team page. */
const VISIBLE_MEMBERS = 8;

type TeamPulseCardProps = {
  roster: TeamOverviewUser[];
  /** Who needs the manager and why, most pressing first — see `buildAttentionQueue`. */
  queue: AttentionEntry[];
  loading: boolean;
  error: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * The team, in the order a manager should look at it: everybody who needs them first — a skip
 * to decide, feedback to read, then a waiting review, drifting, a long step — and after that
 * whoever is still on the way, longest on their step first.
 *
 * This used to sit beside a separate "Needs you" card that listed the first group again, while
 * the "Waiting on you" figure above counted it a third time. One list, with each person's
 * reasons as icons, says the same once. People the metrics flag who are not on the project's
 * roster are left out: they could not be opened here anyway.
 */
export function TeamPulseCard({ roster, queue, loading, error, onOpenMember }: TeamPulseCardProps) {
  const doneCount = roster.filter((member) => memberStage(member) === "done").length;

  const needsYou = queue.flatMap((entry) =>
    entry.member ? [{ member: entry.member, reasons: entry.reasons }] : [],
  );
  const needsYouIds = new Set(needsYou.map(({ member }) => member.userId));
  const onTheWay = roster
    .filter((member) => !needsYouIds.has(member.userId) && memberStage(member) !== "done")
    .sort((a, b) => (daysOnStep(b) ?? -1) - (daysOnStep(a) ?? -1));

  const visibleNeedsYou = needsYou.slice(0, VISIBLE_MEMBERS);
  const visibleOnTheWay = onTheWay.slice(0, Math.max(0, VISIBLE_MEMBERS - visibleNeedsYou.length));
  const hidden =
    needsYou.length + onTheWay.length - visibleNeedsYou.length - visibleOnTheWay.length;

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
        action={
          <PmCardLink to="/team-management">
            {hidden > 0 ? `All ${roster.length}` : "All members"}
          </PmCardLink>
        }
      />

      {loading ? (
        <SkeletonGroup label="Loading team" className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine key={index} className="h-9 w-full" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div>
            <PmEyebrow className="mb-1 flex items-center justify-between text-app-warning-text!">
              <span>Needs you</span>
              <span className="tabular-nums">{needsYou.length}</span>
            </PmEyebrow>
            {visibleNeedsYou.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-app-text-muted">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
                All clear — no skip requests, no unread feedback, nobody stuck.
              </p>
            ) : (
              <div className="-mx-3">
                {visibleNeedsYou.map(({ member, reasons }) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    reasons={reasons}
                    density="compact"
                    onOpen={onOpenMember}
                  />
                ))}
              </div>
            )}
          </div>

          {visibleOnTheWay.length > 0 && (
            <div>
              <PmEyebrow className="mb-1 flex items-center justify-between text-app-text-subtle!">
                <span>Still on the way</span>
                <span className="tabular-nums">{onTheWay.length}</span>
              </PmEyebrow>
              <div className="-mx-3">
                {visibleOnTheWay.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    reasons={[]}
                    density="compact"
                    onOpen={onOpenMember}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PmCard>
  );
}
