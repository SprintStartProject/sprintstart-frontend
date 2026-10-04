import { CheckCircle2, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../../components/common/UserAvatar";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import type { AttentionEntry, AttentionReason } from "../../attentionQueue";
import {
  daysOnStep,
  formatDays,
  isAtRisk,
  memberName,
  memberStage,
  progressPercent,
} from "../../memberStatus";
import { usePeekClick } from "../../usePeekClick";
import { MemberProgressBar, ReasonIcons } from "../MemberRow";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

/**
 * How many people the card shows before it hands over to the team page — one row of tiles.
 * The card used to list up to eight rows (everybody who needs the manager, topped up with whoever
 * was still on the way), which made it the longest thing on the overview for the least news.
 */
const VISIBLE_MEMBERS = 4;

type TeamPulseCardProps = {
  roster: TeamOverviewUser[];
  /** Who needs the manager and why, most pressing first — see `buildAttentionQueue`. */
  queue: AttentionEntry[];
  loading: boolean;
  error: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * One person who needs the manager, as a tile: who, where they are and for how long, why they
 * need them, how far along. A click opens the side panel, a double click the full profile —
 * the same as a roster row.
 */
function MemberTile({
  member,
  reasons,
  onOpen,
}: {
  member: TeamOverviewUser;
  reasons: AttentionReason[];
  onOpen: (userId: string) => void;
}) {
  const { handleClick, handleDoubleClick } = usePeekClick(member.userId, onOpen);
  const name = memberName(member);
  const days = daysOnStep(member);
  const where =
    member.currentPhase?.title && member.currentStep?.title
      ? `${member.currentPhase.title} · ${member.currentStep.title}`
      : (member.currentStep?.title ?? "No current step");

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click for a quick look · double-click for the full profile"
      className="flex h-full min-w-0 flex-col gap-3 rounded-xl border border-app-border-muted bg-app-surface p-3 text-left transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <UserAvatar
          profileIcon={member.profileIcon}
          fallbackName={name}
          seed={member.userId}
          size={36}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-app-text">{name}</span>
          <span className="block truncate text-xs text-app-text-muted" title={where}>
            {where}
          </span>
        </span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <ReasonIcons reasons={reasons} />
        {days !== null && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-xs ${
              isAtRisk(member) ? "font-medium text-app-orange-text" : "text-app-text-subtle"
            }`}
          >
            <Clock aria-hidden="true" className="h-3 w-3" />
            {days <= 0 ? "today" : formatDays(days)}
          </span>
        )}
      </span>
      <MemberProgressBar percent={progressPercent(member)} className="mt-auto" />
    </button>
  );
}

/**
 * Who on the team needs the manager, most pressing first — a skip to decide, feedback to read,
 * then a waiting review, drifting, a long step — as one row of tiles.
 *
 * Only the first few: everyone past them, and everyone who is simply on their way, is one press
 * away on the team page ("Needs you" filtered, or the whole roster). People the metrics flag who
 * are not on the project's roster are left out: they could not be opened here anyway.
 */
export function TeamPulseCard({ roster, queue, loading, error, onOpenMember }: TeamPulseCardProps) {
  const doneCount = roster.filter((member) => memberStage(member) === "done").length;

  const needsYou = queue.flatMap((entry) =>
    entry.member ? [{ member: entry.member, reasons: entry.reasons }] : [],
  );
  const visibleNeedsYou = needsYou.slice(0, VISIBLE_MEMBERS);
  const hidden = needsYou.length - visibleNeedsYou.length;

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
        <SkeletonGroup label="Loading team" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: VISIBLE_MEMBERS }).map((_, index) => (
            <SkeletonLine key={index} className="h-28 w-full rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <div>
          <PmEyebrow className="mb-2 flex items-center justify-between text-app-warning-text!">
            <span>Needs you · {needsYou.length}</span>
            {hidden > 0 && (
              <Link
                to="/team-management?filter=attention"
                className="tracking-normal text-app-brand-text normal-case hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                +{hidden} more
              </Link>
            )}
          </PmEyebrow>
          {visibleNeedsYou.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-sm text-app-text-muted">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
              All clear — no skip requests, no unread feedback, nobody stuck.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleNeedsYou.map(({ member, reasons }) => (
                <MemberTile
                  key={member.userId}
                  member={member}
                  reasons={reasons}
                  onOpen={onOpenMember}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </PmCard>
  );
}
