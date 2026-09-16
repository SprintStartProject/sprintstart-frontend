import { ChevronLeft, ChevronRight, Clock, Inbox, Pencil, Plus, Route } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { TeamOverviewUser } from "../../team-management/types";
import {
  STAGE_LABEL,
  daysOnStep,
  formatDays,
  isAtRisk,
  memberName,
  memberStage,
  progressPercent,
  waitingOn,
} from "../memberStatus";
import { MemberProgressBar } from "./MemberRow";

function HeroFact({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: ReactNode;
  icon: typeof Clock;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-app-surface px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-app-text-subtle uppercase">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="mt-1.5 min-w-0 text-sm text-app-text">{children}</div>
    </div>
  );
}

type MemberHeroProps = {
  member: TeamOverviewUser;
  /** The team in roster order, for stepping to the previous and next member. */
  roster: TeamOverviewUser[];
  onEditRoles: () => void;
};

/**
 * The band under a member's name on their full profile: who they are, where they stand, and a
 * way to step through the team without going back to the list.
 */
export function MemberHero({ member, roster, onEditRoles }: MemberHeroProps) {
  const percent = progressPercent(member);
  const stage = memberStage(member);
  const days = daysOnStep(member);
  const waiting = waitingOn(member);

  const ordered = [...roster].sort((a, b) => memberName(a).localeCompare(memberName(b)));
  const index = ordered.findIndex((candidate) => candidate.userId === member.userId);
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  const stepperClassName =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-app-border text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <UserAvatar
          profileIcon={member.profileIcon}
          fallbackName={memberName(member)}
          seed={member.userId}
          size={48}
        />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {member.roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={onEditRoles}
              title="Edit roles"
              className="group inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand-soft px-3 py-1 text-xs font-semibold text-app-brand-text transition-colors hover:border-app-brand"
            >
              {role.name}
              <Pencil aria-hidden="true" className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          <button
            type="button"
            onClick={onEditRoles}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-border px-3 py-1 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand hover:text-app-brand-text"
          >
            <Plus aria-hidden="true" className="h-3 w-3" />
            {member.roles.length === 0 ? "Choose role" : "Role"}
          </button>
        </div>

        {ordered.length > 1 && index >= 0 && (
          <nav aria-label="Other team members" className="flex items-center gap-2">
            {previous ? (
              <Link
                to={`/team/${previous.userId}`}
                className={stepperClassName}
                aria-label={`Previous member: ${memberName(previous)}`}
                title={memberName(previous)}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : (
              <span
                className={`${stepperClassName} pointer-events-none opacity-40`}
                aria-hidden="true"
              >
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}
            <span className="text-xs text-app-text-muted tabular-nums">
              {index + 1} of {ordered.length}
            </span>
            {next ? (
              <Link
                to={`/team/${next.userId}`}
                className={stepperClassName}
                aria-label={`Next member: ${memberName(next)}`}
                title={memberName(next)}
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : (
              <span
                className={`${stepperClassName} pointer-events-none opacity-40`}
                aria-hidden="true"
              >
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroFact icon={Route} label={`Onboarding · ${STAGE_LABEL[stage]}`}>
          <MemberProgressBar percent={percent} className="mt-1" />
        </HeroFact>
        <HeroFact icon={Route} label="Phase">
          <p className="truncate">
            {stage === "done" ? "Completed" : (member.currentPhase?.title ?? "—")}
          </p>
        </HeroFact>
        <HeroFact icon={Clock} label="Current step">
          <p className="truncate">
            {stage === "done" ? "—" : (member.currentStep?.title ?? "Not started yet")}
          </p>
          {days !== null && stage !== "done" && (
            <p
              className={`text-xs ${isAtRisk(member) ? "font-medium text-app-orange-text" : "text-app-text-muted"}`}
            >
              {formatDays(days)} on this step
            </p>
          )}
        </HeroFact>
        <HeroFact icon={Inbox} label="Waiting on you">
          <p className={waiting.length > 0 ? "font-semibold text-app-warning-text" : undefined}>
            {waiting.length === 0
              ? "Nothing"
              : waiting
                  .map((kind) => (kind === "skip" ? "Skip request" : "Unread feedback"))
                  .join(" · ")}
          </p>
        </HeroFact>
      </div>
    </div>
  );
}
