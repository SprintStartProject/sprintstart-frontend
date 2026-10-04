import { ArrowUpRight, CheckCircle2, Clock, MousePointerClick, Users } from "lucide-react";
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
const AVATAR = 44;
const RING = AVATAR + 10;
const RING_STROKE = 3;

/**
 * The member's avatar inside a thin ring that fills with their progress, the percentage on a
 * small badge where ring and tile meet — the tile's one number, drawn where the eye already is.
 */
function AvatarProgress({ member, percent }: { member: TeamOverviewUser; percent: number }) {
  const radius = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      className="relative mb-1.5 flex shrink-0 items-center justify-center"
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
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-1.5 text-[10px] leading-4 font-semibold text-app-text tabular-nums">
        {percent}%
      </span>
    </span>
  );
}

const pillClass =
  "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium";

/**
 * The one thing worth knowing about the member right now: the most pressing reason they need
 * the manager, with what it is about (the skip's reason in their own words, which review, how
 * long) — or, for everyone else, how long they have been on their step.
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
      <span className="flex w-full min-w-0 flex-col items-center gap-1">
        <span className="flex max-w-full items-center justify-center gap-1">
          <span className={`${pillClass} ${meta.tone}`}>
            <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="truncate">{meta.label}</span>
          </span>
          {rest.length > 0 && (
            <span
              title={rest.map((reason) => REASON_META[reason.kind].label).join(", ")}
              className="shrink-0 rounded-full bg-app-surface px-1.5 py-0.5 text-[11px] font-medium text-app-text-muted"
            >
              +{rest.length}
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-app-text-muted" title={detail}>
          {detail}
        </span>
      </span>
    );
  }

  if (memberStage(member) === "done") {
    return (
      <span className={`${pillClass} bg-app-success-bg text-app-success-text`}>
        <CheckCircle2 aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span className="truncate">Through onboarding</span>
      </span>
    );
  }

  return (
    <span className={`${pillClass} bg-app-surface text-app-text-muted`}>
      <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {days === null
          ? "Not started"
          : days <= 0
            ? "Started today"
            : `${formatDays(days)} on step`}
      </span>
    </span>
  );
}

/**
 * One member as a tile: progress ring around the avatar, name and roles, the phase and step they
 * are on, and the one thing worth knowing about them right now.
 *
 * A click opens the side panel, a double click the full profile — the same as a roster row. A
 * tooltip alone hid the double click from anyone who did not wait for it, so hovering the tile
 * says it on the tile itself, with the arrow the roster uses for "full profile" in the corner.
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
  const step =
    stage === "done"
      ? "Onboarding complete"
      : (member.currentStep?.title ??
        (stage === "not-started" ? "Not started yet" : "No current step"));
  const phase = stage === "done" ? null : member.currentPhase?.title;
  const roles = member.roles.map((role) => role.name).join(", ");
  const needsYou = reasons.length > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="Click for a quick look · double-click for the full profile"
      className={`group relative flex h-full min-w-0 flex-col items-center gap-2.5 rounded-2xl px-3 pt-4 pb-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        needsYou ? "bg-app-warning-bg/50" : "bg-app-surface-muted"
      }`}
    >
      <ArrowUpRight
        aria-hidden="true"
        className="absolute top-2.5 right-2.5 h-4 w-4 text-app-text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <AvatarProgress member={member} percent={progressPercent(member)} />

      <span className="w-full min-w-0">
        <span className="block truncate text-sm font-semibold text-app-text">{name}</span>
        <span
          className={`block truncate text-[11px] ${roles ? "text-app-brand-text" : "text-app-text-subtle"}`}
          title={roles || undefined}
        >
          {roles || "No role yet"}
        </span>
      </span>

      <span className="w-full min-w-0 rounded-lg bg-app-surface/70 px-2 py-1.5">
        {phase && (
          <span className="block truncate text-[10px] font-semibold tracking-wider text-app-text-subtle uppercase">
            {phase}
          </span>
        )}
        <span className="block truncate text-xs text-app-text" title={step}>
          {step}
        </span>
      </span>

      <span className="flex w-full min-w-0 justify-center">
        <TileStatus member={member} reasons={reasons} />
      </span>

      {/* Takes its room even while hidden, so hovering never shifts the tile's content. */}
      <span
        aria-hidden="true"
        className="mt-auto flex items-center gap-1 text-[10px] text-app-text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <MousePointerClick className="h-3 w-3" />
        Quick look · <span className="font-semibold text-app-brand-text">double-click</span> for
        profile
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
        <SkeletonGroup label="Loading team" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: VISIBLE_MEMBERS }).map((_, index) => (
            <SkeletonLine key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </SkeletonGroup>
      ) : error ? (
        <EmptyState size="sm">The team isn&apos;t available right now.</EmptyState>
      ) : roster.length === 0 ? (
        <EmptyState size="sm">Nobody is on this project yet.</EmptyState>
      ) : (
        <div className="space-y-3">
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
                  className="tracking-normal text-app-brand-text normal-case hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  +{hidden} more
                </Link>
              )}
            </PmEyebrow>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
