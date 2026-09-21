import { ChevronLeft, ChevronRight, Clock, Hand, Route, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import type { ProjectRole, TeamOverviewUser } from "../../team-management/types";
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
  /** Project roles this member does not hold yet — what "Add role" offers. */
  assignableRoles: ProjectRole[];
  /** The role being assigned or removed right now, if any. */
  savingRoleId: string | null;
  onAddRole: (roleId: string) => void;
  /** Asks to remove a role; the page confirms before it does. */
  onRemoveRole: (role: ProjectRole) => void;
};

/**
 * The top of a member's full profile: who they are, the roles they hold, where they stand, and
 * a way to step through the team without going back to the list.
 *
 * Roles are edited right here. They used to open a modal — press a role chip, find the select
 * inside, pick, press Add — four steps and a dialog for what is one decision. Now the chip has
 * its own remove button and "Add role" assigns the moment a role is picked.
 */
export function MemberHero({
  member,
  roster,
  assignableRoles,
  savingRoleId,
  onAddRole,
  onRemoveRole,
}: MemberHeroProps) {
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

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-semibold text-app-text">
            {memberName(member)}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {member.roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1 rounded-full border border-app-brand-border bg-app-brand-soft py-0.5 pr-1 pl-2.5 text-xs font-semibold text-app-brand-text"
              >
                {role.name}
                <button
                  type="button"
                  onClick={() => onRemoveRole(role)}
                  disabled={savingRoleId === role.id}
                  aria-label={`Remove ${role.name}`}
                  title={`Remove ${role.name}`}
                  className="flex h-4.5 w-4.5 items-center justify-center rounded-full opacity-60 transition hover:bg-app-brand/15 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:opacity-30"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              </span>
            ))}
            {member.roles.length === 0 && (
              <span className="text-xs text-app-text-muted">No role yet</span>
            )}
            {assignableRoles.length > 0 && (
              <FilterSelect
                label="Choose a role to add"
                value=""
                options={[
                  { value: "", label: member.roles.length === 0 ? "Choose role" : "Add role" },
                  ...assignableRoles.map((role) => ({ value: role.id, label: role.name })),
                ]}
                onChange={(roleId) => {
                  if (roleId) onAddRole(roleId);
                }}
                disabled={savingRoleId !== null}
                className="w-36 [&>button]:h-7 [&>button]:rounded-full [&>button]:border-dashed [&>button]:text-xs"
              />
            )}
          </div>
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
        <HeroFact icon={Hand} label="Waiting on you">
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
