import { ArrowUpRight, CheckCircle2, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../../components/common/UserAvatar";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { TeamOverviewUser } from "../../../team-management/types";
import type { AttentionEntry, AttentionReason } from "../../attentionQueue";
import { REASON_META } from "../../attentionReasons";
import {
  daysOnStep,
  formatDays,
  memberName,
  memberStage,
  progressPercent,
} from "../../memberStatus";
import { usePeekClick } from "../../usePeekClick";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

/**
 * How many people the card shows before it hands over to the team page — one row of tiles.
 * The card used to list up to eight rows, which made it the longest thing on the overview for the
 * least news. Four always show when the team has four: whoever needs the manager first, topped
 * up with whoever has been longest on their step — a half-empty row reads as broken, not calm.
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

/** Avatar size inside the ring, and the ring around it. */
const AVATAR = 32;
const RING = AVATAR + 8;
const RING_STROKE = 2.5;

/** The member's avatar inside a thin ring that fills with their progress. */
function AvatarProgress({ member, percent }: { member: TeamOverviewUser; percent: number }) {
  const radius = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RING, height: RING }}
    >
      <svg aria-hidden="true" width={RING} height={RING} className="absolute inset-0 -rotate-90">
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-app-progress-track"
        />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="stroke-app-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <UserAvatar
        profileIcon={member.profileIcon}
        fallbackName={memberName(member)}
        seed={member.userId}
        size={AVATAR}
      />
    </span>
  );
}

const pillClass =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-xs font-medium";

/**
 * The one thing worth knowing about the member right now, on one line: the most pressing reason
 * they need the manager and what it is about (the skip's reason in their own words, which
 * review) — or, for everyone else, how long they have been on their step.
 */
function TileStatus({ member, reasons }: { member: TeamOverviewUser; reasons: AttentionReason[] }) {
  const days = daysOnStep(member);

  if (reasons.length > 0) {
    const [first, ...rest] = reasons;
    const meta = REASON_META[first.kind];
    const Icon = meta.icon;
    const skipReason = member.currentStep?.skip?.reason?.trim();
    const detail = first.kind === "skip" && skipReason ? `“${skipReason}”` : first.text;

    return (
      <span className="flex min-w-0 items-center gap-1.5" title={detail}>
        <span className={`${pillClass} ${meta.tone}`}>
          <Icon aria-hidden="true" className="h-3 w-3" />
          {meta.label}
          {rest.length > 0 && <span className="opacity-70">+{rest.length}</span>}
        </span>
        <span className="min-w-0 truncate text-xs text-app-text-muted">{detail}</span>
      </span>
    );
  }

  if (memberStage(member) === "done") {
    return (
      <span className={`${pillClass} bg-app-success-bg text-app-success-text`}>
        <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
        Through onboarding
      </span>
    );
  }

  return (
    <span className={`${pillClass} bg-app-surface text-app-text-muted`}>
      <Clock aria-hidden="true" className="h-3 w-3" />
      {days === null ? "Not started" : days <= 0 ? "Started today" : `${formatDays(days)} on step`}
    </span>
  );
}

/**
 * One member as a slim tile: progress ring around the avatar, name and progress, the phase and
 * step they are on, and the one thing worth knowing about them right now — three short lines,
 * so four of them sit in a row without the card outgrowing its neighbours.
 *
 * A click opens the side panel, a double click the full profile — the same as a roster row. A
 * tooltip alone hid the double click from anyone who did not wait for it, so hovering the tile
 * raises a small tag over its corner that says so, without taking room from the content.
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
  const stage = memberStage(member);
  const percent = progressPercent(member);
  const step =
    stage === "done"
      ? "Onboarding complete"
      : (member.currentStep?.title ??
        (stage === "not-started" ? "Not started yet" : "No current step"));
  const where =
    stage !== "done" && member.currentPhase?.title
      ? `${member.currentPhase.title} · ${step}`
      : step;
  const needsYou = reasons.length > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click for a quick look · double-click for the full profile"
      className={`group relative flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
        needsYou
          ? "bg-app-warning-bg/50 hover:bg-app-warning-bg"
          : "bg-app-surface-muted hover:bg-app-surface-hover"
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 right-2 z-10 inline-flex translate-y-1 items-center gap-0.5 rounded-full border border-app-border bg-app-surface px-1.5 py-px text-xs font-medium text-app-brand-text opacity-0 shadow-sm transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
      >
        Double-click: profile
        <ArrowUpRight className="h-3 w-3" />
      </span>

      <AvatarProgress member={member} percent={percent} />

      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-app-text">{name}</span>
          <span className="shrink-0 text-2xs font-medium text-app-text-muted tabular-nums">
            {percent}%
          </span>
        </span>
        <span className="block truncate text-xs text-app-text-muted" title={where}>
          {where}
        </span>
        <TileStatus member={member} reasons={reasons} />
      </span>
    </button>
  );
}

/**
 * Who on the team needs the manager, most pressing first — a skip to decide, feedback to read,
 * then a waiting review, drifting, a long step — as one row of tiles, topped up to four with
 * whoever has been longest on their step (and, on a small team, whoever is through).
 *
 * Everyone past them is one press away on the team page ("+n more" opens it filtered to
 * "Needs you"). People the metrics flag who are not on the project's roster are left out: they
 * could not be opened here anyway.
 */
export function TeamPulseCard({ roster, queue, loading, error, onOpenMember }: TeamPulseCardProps) {
  const doneCount = roster.filter((member) => memberStage(member) === "done").length;

  const needsYou = queue.flatMap((entry) =>
    entry.member ? [{ member: entry.member, reasons: entry.reasons }] : [],
  );
  const needsYouIds = new Set(needsYou.map(({ member }) => member.userId));
  const rest = roster
    .filter((member) => !needsYouIds.has(member.userId))
    .sort(
      (a, b) =>
        Number(memberStage(a) === "done") - Number(memberStage(b) === "done") ||
        (daysOnStep(b) ?? -1) - (daysOnStep(a) ?? -1),
    )
    .map((member) => ({ member, reasons: [] as AttentionReason[] }));

  const visible = [...needsYou, ...rest].slice(0, VISIBLE_MEMBERS);
  const hidden = needsYou.length - Math.min(needsYou.length, VISIBLE_MEMBERS);

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
        <SkeletonGroup label="Loading team" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: VISIBLE_MEMBERS }).map((_, index) => (
            <SkeletonLine key={index} className="h-[4.5rem] w-full rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {needsYou.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-app-text-muted">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
              All clear — no skip requests, no unread feedback, nobody stuck.
            </p>
          ) : (
            <PmEyebrow className="flex items-center justify-between text-app-warning-text!">
              <span>
                {needsYou.length} {needsYou.length === 1 ? "needs" : "need"} you
              </span>
              {hidden > 0 && (
                <Link
                  to="/team-management?filter=attention"
                  className="tracking-normal text-app-brand-text normal-case hover:underline"
                >
                  +{hidden} more
                </Link>
              )}
            </PmEyebrow>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map(({ member, reasons }) => (
              <MemberTile
                key={member.userId}
                member={member}
                reasons={reasons}
                onOpen={onOpenMember}
              />
            ))}
          </div>
        </div>
      )}
    </PmCard>
  );
}
