import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  GraduationCap,
  MessageSquareText,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { WidgetBar } from "../../dashboard/components/WidgetBar";
import { formatMinutes, type PhaseState } from "../../onboarding/journey";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import type { TeamOverviewUser } from "../../team-management/types";
import type { OnboardingFeedback, UserSkillLevel } from "../../../services/teamManagementService";
import { memberSummaryData } from "../memberSummary";
import {
  STAGE_LABEL,
  daysOnStep,
  formatDays,
  isAtRisk,
  memberStage,
  progressPercent,
} from "../memberStatus";
import { DonutChart } from "./charts/DonutChart";
import { RingGauge } from "./charts/RingGauge";
import { PmCard, PmEyebrow } from "./PmCard";

const PHASE_BAR: Record<PhaseState, string> = {
  done: "bg-app-success-solid",
  active: "bg-app-brand",
  open: "bg-app-border-strong",
  locked: "bg-app-border-strong",
};

const PHASE_LABEL: Record<PhaseState, string> = {
  done: "done",
  active: "in progress",
  open: "not started",
  locked: "locked",
};

const LEVEL_SEGMENTS = [
  { level: "BEGINNER", label: "beginner", className: "bg-app-warning-solid" },
  { level: "INTERMEDIATE", label: "intermediate", className: "bg-app-cyan-text" },
  { level: "ADVANCED", label: "advanced", className: "bg-app-brand" },
  { level: "EXPERT", label: "expert", className: "bg-app-success-solid" },
] as const;

function Signal({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-app-surface-muted px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-app-text-subtle uppercase">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="mt-2 min-w-0 text-sm text-app-text">{children}</div>
    </div>
  );
}

function Count({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  className: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${className}`} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

type MemberSummaryProps = {
  member: TeamOverviewUser;
  path: OnboardingPathEndpoint | null;
  feedback: readonly OnboardingFeedback[];
  skillLevels: readonly UserSkillLevel[];
  /** Knowledge gaps in the project that concern this member. */
  knowledgeGapCount: number;
};

/**
 * A member's onboarding at a glance — the first thing on the full profile, before the path.
 *
 * The profile used to open on the path itself: a graph of every step, with the numbers a manager
 * actually came for (how far, where, is anything off) scattered across the page. This card
 * answers those in one read: overall progress as a ring, the phases (the current one up close,
 * the rest as a strip and a line each), the steps by state, then the three signals worth a second look — workload by estimate, what the member said
 * about their steps, and their skills. The path underneath is for working on it.
 */
export function MemberSummary({
  member,
  path,
  feedback,
  skillLevels,
  knowledgeGapCount,
}: MemberSummaryProps) {
  const data = memberSummaryData(path, feedback);
  const stage = memberStage(member);
  const days = daysOnStep(member);
  const percent = data.progress ? data.progress.percentage : progressPercent(member);
  const workload = data.estimated > 0 ? (data.closedEstimate / data.estimated) * 100 : 0;

  // The phase they are in gets the close look: every phase underway, or — before any is — the
  // first one they can start. Done and still-ahead phases are only counted and named.
  const activePhases = data.phases.filter((phase) => phase.state === "active");
  const firstOpen = data.phases.find((phase) => phase.state === "open");
  const focusPhases = activePhases.length > 0 ? activePhases : firstOpen ? [firstOpen] : [];
  const donePhases = data.phases.filter((phase) => phase.state === "done");
  const aheadPhases = data.phases.filter(
    (phase) => phase.state !== "done" && !focusPhases.includes(phase),
  );

  const levelSegments = LEVEL_SEGMENTS.map((segment) => ({
    label: segment.label,
    value: skillLevels.filter((skill) => skill.level === segment.level).length,
    className: segment.className,
  }));

  return (
    // Laid out by its own width, not the window's: beside the "Waiting on you" column the card
    // is three quarters wide, and the window's breakpoints would squeeze three columns into it.
    <PmCard aria-label="At a glance" tone="brand" className="@container">
      <div className="grid gap-6 @xl:grid-cols-[auto_minmax(0,1.2fr)_auto]">
        {/* Where they are, overall. */}
        <div className="flex items-center gap-4 @xl:flex-col @xl:items-start">
          <RingGauge
            value={percent}
            size={96}
            thickness={9}
            colorClassName={stage === "done" ? "text-app-success-solid" : "text-app-brand"}
            ariaLabel={`${percent}% of the onboarding path complete`}
          >
            <span className="text-xl leading-none font-bold text-app-text">{percent}%</span>
            <span className="mt-1 text-[11px] text-app-text-muted">{STAGE_LABEL[stage]}</span>
          </RingGauge>
          <div className="min-w-0 space-y-1 text-xs text-app-text-muted @xl:max-w-44">
            {data.progress && (
              <p>
                <span className="font-semibold text-app-text tabular-nums">
                  {data.progress.completed} of {data.progress.total}
                </span>{" "}
                items · {data.progress.phasesDone} of {data.phases.length} phases
              </p>
            )}
            {stage !== "done" && (
              <p className="truncate" title={member.currentStep?.title}>
                Now: <span className="text-app-text">{member.currentStep?.title ?? "—"}</span>
              </p>
            )}
            {days !== null && stage !== "done" && (
              <p
                className={`flex items-center gap-1 ${isAtRisk(member) ? "font-medium text-app-orange-text" : ""}`}
              >
                <Clock aria-hidden="true" className="h-3 w-3" />
                {formatDays(days)} on this step
              </p>
            )}
          </div>
        </div>

        {/* The phases: the whole path as one strip, the phase they are in up close, and what is
            done or still ahead folded into a line each. Every phase used to get its own labelled
            bar, which listed nearly the whole path in the card that is meant to be the glance. */}
        <div className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <PmEyebrow>Phases</PmEyebrow>
            {data.phases.length > 0 && (
              <span className="text-xs text-app-text-muted tabular-nums">
                {donePhases.length} of {data.phases.length} done
              </span>
            )}
          </div>
          {data.phases.length === 0 ? (
            <p className="text-sm text-app-text-muted">No onboarding path yet.</p>
          ) : (
            <div className="space-y-3">
              <div aria-hidden="true" className="flex gap-1">
                {data.phases.map((phase) => (
                  <span
                    key={phase.id}
                    title={`${phase.title} · ${phase.progress.completed}/${phase.progress.total}`}
                    className={`block h-1.5 flex-1 overflow-hidden rounded-full bg-app-progress-track ${
                      focusPhases.includes(phase) ? "ring-2 ring-app-brand/25" : ""
                    }`}
                  >
                    <span
                      className={`block h-full rounded-full transition-[width] duration-700 ${PHASE_BAR[phase.state]}`}
                      style={{ width: `${phase.progress.percentage}%` }}
                    />
                  </span>
                ))}
              </div>

              {focusPhases.length > 0 && (
                <ul className="space-y-2">
                  {focusPhases.map((phase) => (
                    <li
                      key={phase.id}
                      className="min-w-0 rounded-xl border border-app-brand-border bg-app-brand-soft/40 px-3 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span className="shrink-0 text-app-text-subtle tabular-nums">
                            {data.phases.indexOf(phase) + 1}
                          </span>
                          <span
                            className="truncate text-sm font-semibold text-app-text"
                            title={phase.title}
                          >
                            {phase.title}
                          </span>
                          {phase.state === "open" && (
                            <span className="shrink-0 text-app-text-subtle">up next</span>
                          )}
                        </span>
                        <span className="shrink-0 text-app-text-muted tabular-nums">
                          {phase.progress.completed}/{phase.progress.total}
                          <span className="sr-only"> done, {PHASE_LABEL[phase.state]}</span>
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className="mt-1.5 block h-2 overflow-hidden rounded-full bg-app-progress-track"
                      >
                        <span
                          className={`block h-full rounded-full transition-[width] duration-700 ${PHASE_BAR[phase.state]}`}
                          style={{ width: `${phase.progress.percentage}%` }}
                        />
                      </span>
                      {phase.currentSteps.length > 0 && (
                        <p
                          className="mt-1.5 truncate text-xs text-app-text-muted"
                          title={phase.currentSteps.join(", ")}
                        >
                          On: <span className="text-app-text">{phase.currentSteps.join(", ")}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {(donePhases.length > 0 || aheadPhases.length > 0) && (
                <div className="space-y-1 text-xs text-app-text-muted">
                  {donePhases.length > 0 && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <CheckCircle2
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-app-success-text"
                      />
                      <span className="shrink-0 font-semibold text-app-text tabular-nums">
                        {donePhases.length} done
                      </span>
                      <span
                        className="truncate"
                        title={donePhases.map((phase) => phase.title).join(" · ")}
                      >
                        {donePhases.map((phase) => phase.title).join(" · ")}
                      </span>
                    </p>
                  )}
                  {aheadPhases.length > 0 && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <CircleDashed
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-app-text-subtle"
                      />
                      <span className="shrink-0 font-semibold text-app-text tabular-nums">
                        {aheadPhases.length} ahead
                      </span>
                      <span
                        className="truncate"
                        title={aheadPhases.map((phase) => phase.title).join(" · ")}
                      >
                        {aheadPhases.map((phase) => phase.title).join(" · ")}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* The steps by state. */}
        {data.stepCount > 0 && (
          <div>
            <PmEyebrow className="mb-3">Steps</PmEyebrow>
            <DonutChart
              data={data.stepStates}
              ariaLabel="Steps by state"
              size={96}
              thickness={11}
              legend="below"
              center={
                <>
                  <span className="text-xl leading-none font-bold text-app-text">
                    {data.stepCount}
                  </span>
                  <span className="mt-1 text-[11px] text-app-text-muted">steps</span>
                </>
              }
            />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 @md:grid-cols-2 @2xl:grid-cols-4">
        <Signal icon={Timer} title="Workload">
          {data.estimated > 0 ? (
            <>
              <p>
                <span className="font-semibold">{formatMinutes(data.closedEstimate)}</span>
                <span className="text-app-text-muted"> of {formatMinutes(data.estimated)}</span>
              </p>
              <span
                aria-hidden="true"
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
              >
                <span
                  className="block h-full rounded-full bg-app-brand"
                  style={{ width: `${workload}%` }}
                />
              </span>
            </>
          ) : (
            <p className="text-app-text-muted">No estimates on the steps</p>
          )}
        </Signal>

        <Signal icon={CalendarClock} title="Onboarding for">
          <p className="font-semibold">
            {data.runningDays === null ? "—" : formatDays(data.runningDays)}
          </p>
          <p className="text-xs text-app-text-muted">since the path was created</p>
        </Signal>

        <Signal icon={MessageSquareText} title="What they said">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Count
              icon={ThumbsUp}
              value={data.helpful}
              label="steps found helpful"
              className="text-app-success-text"
            />
            <Count
              icon={ThumbsDown}
              value={data.unhelpful}
              label="steps found not helpful"
              className="text-app-danger-text"
            />
            <Count
              icon={SkipForward}
              value={data.pendingSkips + data.approvedSkips + data.declinedSkips}
              label="skip requests"
              className="text-app-warning-text"
            />
          </p>
          <p className="mt-1 text-xs text-app-text-muted">
            {data.pendingSkips > 0
              ? `${data.pendingSkips} skip ${data.pendingSkips === 1 ? "request" : "requests"} open`
              : `${data.comments} ${data.comments === 1 ? "comment" : "comments"}`}
          </p>
        </Signal>

        <Signal icon={GraduationCap} title="Skills">
          {skillLevels.length === 0 ? (
            <p className="text-app-text-muted">Not assessed yet</p>
          ) : (
            <WidgetBar segments={levelSegments} />
          )}
          {knowledgeGapCount > 0 && (
            <p className="mt-1 text-xs text-app-text-muted">
              {knowledgeGapCount} knowledge {knowledgeGapCount === 1 ? "gap" : "gaps"} in the
              project
            </p>
          )}
        </Signal>
      </div>
    </PmCard>
  );
}
