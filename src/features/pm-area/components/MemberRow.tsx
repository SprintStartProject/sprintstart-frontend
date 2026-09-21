import { ChevronRight, Clock, MessageSquareText, SkipForward } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { TeamOverviewUser } from "../../team-management/types";
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

type MemberRowProps = {
  member: TeamOverviewUser;
  onOpen: (userId: string) => void;
  /** Whether this member is the one shown in the side panel right now. */
  selected?: boolean;
  /** `compact` for the overview's short list, `full` for the team roster. */
  density?: "compact" | "full";
};

/**
 * One member as a row: who, where they are, how far, and what is waiting.
 *
 * A row rather than the card grid the team page used: a manager scans a team top to bottom by
 * one thing at a time (who is stuck, who is waiting), and a grid of cards made that a zig-zag.
 * Pressing it opens the side panel — the full profile is one more press from there, not the
 * first thing every look costs.
 */
export function MemberRow({ member, onOpen, selected = false, density = "full" }: MemberRowProps) {
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

  return (
    <button
      type="button"
      onClick={() => onOpen(member.userId)}
      aria-current={selected ? "true" : undefined}
      className={`group grid w-full items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
      } ${
        isFull
          ? "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_9rem_auto]"
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
          <span className="block truncate text-xs text-app-text-muted">
            {isFull
              ? member.roles.length > 0
                ? member.roles.map((role) => role.name).join(", ")
                : "No role yet"
              : compactLine}
          </span>
        </span>
      </span>

      {isFull && (
        <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
          <span className="block truncate text-sm text-app-text">{stepLine}</span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-text-muted">
            {member.currentPhase?.title && stage !== "done" && (
              <span className="truncate">{member.currentPhase.title}</span>
            )}
            {days !== null && stage !== "done" && !isAtRisk(member) && (
              <span className="shrink-0">· {formatDays(days)} on step</span>
            )}
            <MemberFlags member={member} />
          </span>
        </span>
      )}

      {isFull && <MemberProgressBar percent={percent} className="col-span-2 md:col-span-1" />}

      <span className="col-start-2 row-start-1 flex items-center gap-2 md:col-start-auto md:row-start-auto">
        {!isFull && <MemberFlags member={member} />}
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
}
