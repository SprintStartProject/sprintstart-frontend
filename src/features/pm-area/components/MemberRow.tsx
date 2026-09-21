import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageSquareText,
  SkipForward,
} from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { TeamOverviewUser } from "../../team-management/types";
import type { AttentionReason } from "../attentionQueue";
import { REASON_META } from "../attentionReasons";
import { ROSTER_COLUMNS } from "../rosterLayout";
import {
  daysOnStep,
  formatDays,
  isAtRisk,
  memberName,
  memberStage,
  progressPercent,
  waitingOn,
} from "../memberStatus";

export function MemberProgressBar({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}) {
  return (
    // Spans throughout: the bar is drawn inside row buttons, which only take phrasing content.
    <span className={`flex items-center gap-2 ${className}`}>
      <span
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="block h-1.5 flex-1 overflow-hidden rounded-full bg-app-progress-track"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-xs font-medium text-app-text tabular-nums">
        {percent}%
      </span>
    </span>
  );
}

/**
 * Skip and feedback as bare icons in small round chips, for the overview's short list: the row
 * is narrow, and "does this person want something from me" is a yes/no the icon answers alone.
 * The label is the tooltip and the accessible name.
 */
function WaitingIcons({ member }: { member: TeamOverviewUser }) {
  const waiting = waitingOn(member);
  if (waiting.length === 0) return null;

  return (
    <span className="flex items-center gap-1">
      {waiting.includes("skip") && (
        <span
          role="img"
          aria-label="Skip request"
          title="Skip request"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-app-warning-bg text-app-warning-text"
        >
          <SkipForward aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      )}
      {waiting.includes("feedback") && (
        <span
          role="img"
          aria-label="Unread feedback"
          title="Unread feedback"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-app-brand-soft text-app-brand-text"
        >
          <MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}

/**
 * Every reason the member needs the manager, as bare icons — the compact row's version of the
 * roster's "Open with you" column. Same icons and colours as there; the label is the tooltip
 * and the accessible name.
 */
function ReasonIcons({ reasons }: { reasons: AttentionReason[] }) {
  if (reasons.length === 0) return null;

  return (
    <span className="flex items-center gap-1">
      {reasons.map((reason) => {
        const meta = REASON_META[reason.kind];
        const Icon = meta.icon;

        return (
          <span
            key={reason.kind}
            role="img"
            aria-label={meta.label}
            title={`${meta.label}: ${reason.text}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${meta.tone}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </span>
  );
}

/** The skip / feedback / stuck markers, as small labelled chips. */
export function MemberFlags({ member }: { member: TeamOverviewUser }) {
  const waiting = waitingOn(member);
  const days = daysOnStep(member);
  const atRisk = isAtRisk(member);

  if (waiting.length === 0 && !atRisk) return null;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {waiting.includes("skip") && (
        <span className="inline-flex items-center gap-1 rounded-full bg-app-warning-bg px-2 py-0.5 text-[11px] font-medium text-app-warning-text">
          <SkipForward aria-hidden="true" className="h-3 w-3" />
          Skip request
        </span>
      )}
      {waiting.includes("feedback") && (
        <span className="inline-flex items-center gap-1 rounded-full bg-app-brand-soft px-2 py-0.5 text-[11px] font-medium text-app-brand-text">
          <MessageSquareText aria-hidden="true" className="h-3 w-3" />
          Feedback
        </span>
      )}
      {atRisk && days !== null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-app-orange-bg px-2 py-0.5 text-[11px] font-medium text-app-orange-text">
          <Clock aria-hidden="true" className="h-3 w-3" />
          {formatDays(days)} on step
        </span>
      )}
    </span>
  );
}

/** How many open items a roster row spells out before it folds the rest into "+n". */
const VISIBLE_REASONS = 2;

/**
 * Everything open with the manager for one member, each as a coloured label with its detail —
 * the skip's reason in the member's words, not only "Skip request". What the overview's queue
 * says about a person, said in their row, so the roster answers "who needs what" without
 * opening anyone.
 */
function OpenItems({ member, reasons }: { member: TeamOverviewUser; reasons: AttentionReason[] }) {
  if (reasons.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-app-text-subtle">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-app-success-solid" />
        Nothing open
      </span>
    );
  }

  const skipReason = member.currentStep?.skip?.reason?.trim();
  const shown = reasons.slice(0, VISIBLE_REASONS);
  const folded = reasons.length - shown.length;

  return (
    <span className="flex min-w-0 flex-col gap-1">
      {shown.map((reason) => {
        const meta = REASON_META[reason.kind];
        const Icon = meta.icon;
        const detail = reason.kind === "skip" && skipReason ? `“${skipReason}”` : reason.text;

        return (
          <span key={reason.kind} className="flex min-w-0 items-center gap-1.5 text-xs">
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}
            >
              <Icon aria-hidden="true" className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="min-w-0 truncate text-app-text-muted" title={detail}>
              {detail}
            </span>
          </span>
        );
      })}
      {folded > 0 && (
        <span className="text-[11px] text-app-text-subtle">
          +{folded} more:{" "}
          {reasons
            .slice(VISIBLE_REASONS)
            .map((reason) => REASON_META[reason.kind].label.toLowerCase())
            .join(", ")}
        </span>
      )}
    </span>
  );
}

type MemberRowProps = {
  member: TeamOverviewUser;
  onOpen: (userId: string) => void;
  /** Whether this member is the one shown in the side panel right now. */
  selected?: boolean;
  /** `compact` for the overview's short list, `full` for the team roster. */
  density?: "compact" | "full";
  /**
   * Adds a button straight to the full profile beside the row, for when the manager already
   * knows they want the path and not the side panel — without it the profile always cost a
   * press on the row and a second one inside the panel.
   */
  profileLink?: boolean;
  /**
   * What the member needs from the manager, from the attention queue. The full row shows these
   * in their own column; without them it falls back to the skip / feedback / stuck flags.
   */
  reasons?: AttentionReason[];
};

/**
 * One member as a row: who, where they are, how far, and what is waiting.
 *
 * A row rather than the card grid the team page used: a manager scans a team top to bottom by
 * one thing at a time (who is stuck, who is waiting), and a grid of cards made that a zig-zag.
 * Pressing it opens the side panel — the full profile is one more press from there, not the
 * first thing every look costs.
 */
export function MemberRow({
  member,
  onOpen,
  selected = false,
  density = "full",
  profileLink = false,
  reasons,
}: MemberRowProps) {
  const name = memberName(member);
  const percent = progressPercent(member);
  const stage = memberStage(member);
  const days = daysOnStep(member);
  const isFull = density === "full";

  const stepLine =
    stage === "done"
      ? "Onboarding complete"
      : (member.currentStep?.title ??
        (stage === "not-started" ? "Not started yet" : "No current step"));

  // The short list has one line under the name, so it carries the phase too: "Setup · Clone the
  // repo" says where someone is in the path, not only which step they are looking at.
  const compactLine =
    stage === "underway" && member.currentPhase?.title && member.currentStep?.title
      ? `${member.currentPhase.title} · ${member.currentStep.title}`
      : stepLine;

  const row = (
    <button
      type="button"
      onClick={() => onOpen(member.userId)}
      aria-current={selected ? "true" : undefined}
      className={`group grid w-full items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
      } ${
        isFull
          ? `grid-cols-[minmax(0,1fr)_auto] ${ROSTER_COLUMNS}`
          : "grid-cols-[minmax(0,1fr)_auto]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <UserAvatar
          profileIcon={member.profileIcon}
          fallbackName={name}
          seed={member.userId}
          size={isFull ? 36 : 32}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-app-text">{name}</span>
          {isFull ? (
            <span className="mt-1 flex min-w-0 flex-wrap gap-1">
              {member.roles.length > 0 ? (
                member.roles.map((role) => (
                  <span
                    key={role.id}
                    className="truncate rounded-md bg-app-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-app-brand-text"
                  >
                    {role.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-app-text-subtle">No role yet</span>
              )}
            </span>
          ) : (
            <span className="block truncate text-xs text-app-text-muted">{compactLine}</span>
          )}
        </span>
      </span>

      {isFull && (
        <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
          <span className="block truncate text-sm text-app-text">{stepLine}</span>
          {stage !== "done" && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
              {member.currentPhase?.title && (
                <span className="truncate">{member.currentPhase.title}</span>
              )}
              {days !== null && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 ${
                    isAtRisk(member) ? "font-medium text-app-orange-text" : ""
                  }`}
                >
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  {days <= 0 ? "started today" : `${formatDays(days)} on step`}
                </span>
              )}
            </span>
          )}
        </span>
      )}

      {isFull && (
        <span className="col-span-2 row-start-3 min-w-0 md:col-span-1 md:row-start-auto">
          {reasons ? (
            <OpenItems member={member} reasons={reasons} />
          ) : (
            <MemberFlags member={member} />
          )}
        </span>
      )}

      {isFull && (
        <MemberProgressBar
          percent={percent}
          className="col-span-2 row-start-4 md:col-span-1 md:row-start-auto"
        />
      )}

      <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:col-start-auto md:row-start-auto">
        {!isFull &&
          (reasons ? <ReasonIcons reasons={reasons} /> : <WaitingIcons member={member} />)}
        {!isFull && (
          <>
            <MemberProgressBar percent={percent} className="hidden w-28 sm:flex" />
            <span className="text-xs font-medium text-app-text tabular-nums sm:hidden">
              {percent}%
            </span>
          </>
        )}
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 text-app-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-app-text"
        />
      </span>
    </button>
  );

  if (!profileLink) return row;

  // A sibling of the row, not inside it: a link cannot sit inside a button.
  return (
    <div className="relative">
      {row}
      <Link
        to={`/team/${member.userId}`}
        aria-label={`Open full profile of ${name}`}
        title="Full profile"
        className="absolute top-3 right-9 flex h-8 w-8 items-center justify-center rounded-lg text-app-text-subtle transition-colors hover:bg-app-brand-soft hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none md:top-1/2 md:-translate-y-1/2"
      >
        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}
