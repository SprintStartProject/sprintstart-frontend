import {
  AlarmClock,
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
  { level: "BEGINNER", label: "beginner", short: "beginner", className: "bg-app-warning-solid" },
  {
    level: "INTERMEDIATE",
    label: "intermediate",
    short: "intermed.",
    className: "bg-app-cyan-text",
  },
  { level: "ADVANCED", label: "advanced", short: "adv.", className: "bg-app-brand" },
  { level: "EXPERT", label: "expert", short: "expert", className: "bg-app-success-solid" },
] as const;

/**
 * One compact figure beside the member's name. A button when `onOpen` is given: the figures are
 * about the path, so pressing one takes the manager down to it.
 */
function Signal({
  icon: Icon,
  title,
  children,
  onOpen,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1 text-2xs font-semibold tracking-wider text-app-text-subtle uppercase">
        <Icon aria-hidden="true" className="h-3 w-3" />
        {title}
      </span>
      <span className="mt-1 block min-w-0 text-xs text-app-text">{children}</span>
    </>
  );
  const className =
    "block w-36 min-w-0 shrink-0 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-left";

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} transition-colors hover:border-app-brand-border-strong`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
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
      <Icon aria-hidden="true" className={`h-3 w-3 ${className}`} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

type MemberSummaryProps = {
  member: TeamOverviewUser;
  path: OnboardingPathEndpoint | null;
  feedback: readonly OnboardingFeedback[];
  /** Shows a phase in the path below, in whichever view (list or graph) it is in. */
  onOpenPhase?: (phaseId: string) => void;
};

/**
 * A member's onboarding at a glance — the first thing on the full profile, before the path.
 *
 * The profile used to open on the path itself: a graph of every step, with the numbers a manager
 * actually came for (how far, where, is anything off) scattered across the page. This card
 * answers those in one read: overall progress as a ring, the phases (the current one up close,
 * the rest as a strip and a line each). The steps by state were a donut here too; in the
 * member panel it made the card long for what the phases already say. The four smaller figures sit
 * beside the name ({@link MemberSignals}). The path underneath is for working on it; pressing a
 * phase here shows it there.
 */
export function MemberSummary({ member, path, feedback, onOpenPhase }: MemberSummaryProps) {
  const data = memberSummaryData(path, feedback);
  const stage = memberStage(member);
  const days = daysOnStep(member);
  const percent = data.progress ? data.progress.percentage : progressPercent(member);

  // The phase they are in gets the close look: every phase underway, or — before any is — the
  // first one they can start. Done and still-ahead phases are only counted and named.
  const activePhases = data.phases.filter((phase) => phase.state === "active");
  const firstOpen = data.phases.find((phase) => phase.state === "open");
  const focusPhases = activePhases.length > 0 ? activePhases : firstOpen ? [firstOpen] : [];
  const donePhases = data.phases.filter((phase) => phase.state === "done");
  const aheadPhases = data.phases.filter(
    (phase) => phase.state !== "done" && !focusPhases.includes(phase),
  );

  /** A phase's name as a way to it in the path below, when the page offers one. */
  const phaseLink = (phase: { id: string; title: string }, children: ReactNode, className = "") =>
    onOpenPhase ? (
      <button
        type="button"
        onClick={() => onOpenPhase(phase.id)}
        title={`Show ${phase.title} in the path`}
        className={`rounded text-left hover:text-app-brand-text hover:underline ${className}`}
      >
        {children}
      </button>
    ) : (
      <span className={className}>{children}</span>
    );

  return (
    // Laid out by its own width, not the window's: beside the "Waiting on you" column the card
    // is three quarters wide, and the window's breakpoints would squeeze three columns into it.
    <PmCard aria-label="At a glance" tone="brand" className="@container">
      <div className="grid gap-6 @xl:grid-cols-[auto_minmax(0,1fr)]">
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
            <span className="mt-1 text-xs text-app-text-muted">{STAGE_LABEL[stage]}</span>
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
                {isAtRisk(member) ? (
                  <AlarmClock aria-hidden="true" className="h-3 w-3" />
                ) : (
                  <Clock aria-hidden="true" className="h-3 w-3" />
                )}
                {formatDays(days)} on this step
                {isAtRisk(member) ? " · long" : null}
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
              {/* Each segment is a way to its phase too, for a mouse; the names below are the
                  keyboard's and screen reader's way, so the strip stays out of both. */}
              <div aria-hidden="true" className="flex gap-1">
                {data.phases.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    tabIndex={-1}
                    title={`${phase.title} · ${phase.progress.completed}/${phase.progress.total}`}
                    onClick={() => onOpenPhase?.(phase.id)}
                    disabled={!onOpenPhase}
                    className="block flex-1 py-1 enabled:cursor-pointer"
                  >
                    <span
                      className={`block h-1.5 overflow-hidden rounded-full bg-app-progress-track ${
                        focusPhases.includes(phase) ? "ring-2 ring-app-brand/25" : ""
                      }`}
                    >
                      <span
                        className={`block h-full rounded-full transition-[width] duration-700 ${PHASE_BAR[phase.state]}`}
                        style={{ width: `${phase.progress.percentage}%` }}
                      />
                    </span>
                  </button>
                ))}
              </div>

              {focusPhases.length > 0 && (
                <ul className="space-y-2">
                  {focusPhases.map((phase) => {
                    // Spans only, so the whole card can be one button: the phase it stands for,
                    // wherever on it the manager presses.
                    const content = (
                      <>
                        <span className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="shrink-0 text-app-text-subtle tabular-nums">
                              {data.phases.indexOf(phase) + 1}
                            </span>
                            <span className="truncate text-sm font-semibold text-app-text">
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
                        </span>
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
                          <span className="mt-1.5 block truncate text-xs text-app-text-muted">
                            On:{" "}
                            <span className="text-app-text">{phase.currentSteps.join(", ")}</span>
                          </span>
                        )}
                      </>
                    );
                    const cardClassName =
                      "block w-full min-w-0 rounded-xl border border-app-brand-border bg-app-brand-soft/40 px-3 py-2.5 text-left";

                    return (
                      <li key={phase.id} className="min-w-0">
                        {onOpenPhase ? (
                          <button
                            type="button"
                            onClick={() => onOpenPhase(phase.id)}
                            title={`Show ${phase.title} in the path`}
                            className={`${cardClassName} transition-colors hover:border-app-brand-border-strong hover:bg-app-brand-soft/70`}
                          >
                            {content}
                          </button>
                        ) : (
                          <div className={cardClassName}>{content}</div>
                        )}
                      </li>
                    );
                  })}
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
                      <span className="truncate">
                        {donePhases.map((phase, index) => (
                          <span key={phase.id}>
                            {index > 0 && " · "}
                            {phaseLink(phase, phase.title)}
                          </span>
                        ))}
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
                      <span className="truncate">
                        {aheadPhases.map((phase, index) => (
                          <span key={phase.id}>
                            {index > 0 && " · "}
                            {phaseLink(phase, phase.title)}
                          </span>
                        ))}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PmCard>
  );
}

type MemberSignalsProps = {
  path: OnboardingPathEndpoint | null;
  feedback: readonly OnboardingFeedback[];
  skillLevels: readonly UserSkillLevel[];
  /** Knowledge gaps in the project that concern this member. */
  knowledgeGapCount: number;
  /** Takes the manager down to the path. */
  onOpen?: () => void;
};

/**
 * The four smaller figures — workload, how long they have been at it, what they said, their
 * skills — as one row of small tiles beside the member's name.
 *
 * They used to be a second row inside the summary card, at full size, which made the card the
 * tallest thing above the path and pushed the path most of a screen down.
 */
export function MemberSignals({
  path,
  feedback,
  skillLevels,
  knowledgeGapCount,
  onOpen,
}: MemberSignalsProps) {
  const data = memberSummaryData(path, feedback);
  const workload = data.estimated > 0 ? (data.closedEstimate / data.estimated) * 100 : 0;
  const levels = LEVEL_SEGMENTS.map((segment) => ({
    ...segment,
    value: skillLevels.filter((skill) => skill.level === segment.level).length,
  })).filter((segment) => segment.value > 0);
  const assessed = levels.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div role="group" aria-label="Figures" className="flex flex-wrap gap-2">
      <Signal icon={Timer} title="Workload" onOpen={onOpen}>
        {data.estimated > 0 ? (
          <>
            <span className="font-semibold">{formatMinutes(data.closedEstimate)}</span>
            <span className="text-app-text-muted"> of {formatMinutes(data.estimated)}</span>
            <span
              aria-hidden="true"
              className="mt-1 block h-1 overflow-hidden rounded-full bg-app-progress-track"
            >
              <span
                className="block h-full rounded-full bg-app-brand"
                style={{ width: `${workload}%` }}
              />
            </span>
          </>
        ) : (
          <span className="text-app-text-muted">No estimates</span>
        )}
      </Signal>

      <Signal icon={CalendarClock} title="Onboarding for" onOpen={onOpen}>
        <span className="font-semibold">
          {data.runningDays === null ? "—" : formatDays(data.runningDays)}
        </span>
        <span className="block truncate text-xs text-app-text-muted">since the path began</span>
      </Signal>

      <Signal icon={MessageSquareText} title="What they said" onOpen={onOpen}>
        <span className="flex flex-wrap items-center gap-x-2.5">
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
        </span>
        <span className="block truncate text-xs text-app-text-muted">
          {data.pendingSkips > 0
            ? `${data.pendingSkips} skip ${data.pendingSkips === 1 ? "request" : "requests"} open`
            : `${data.comments} ${data.comments === 1 ? "comment" : "comments"}`}
        </span>
      </Signal>

      <Signal icon={GraduationCap} title="Skills" onOpen={onOpen}>
        {assessed === 0 ? (
          <span className="text-app-text-muted">Not assessed yet</span>
        ) : (
          // The bar is only a picture of the counts; the line under it says them in words, in the
          // order of the segments, so the levels are not left to a tooltip or to the colours.
          <span className="block">
            <span className="font-semibold tabular-nums">{assessed}</span>
            <span className="text-app-text-muted"> assessed</span>
            <span aria-hidden="true" className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
              {levels.map((segment) => (
                <span
                  key={segment.level}
                  className={`rounded-full ${segment.className}`}
                  style={{ width: `${(segment.value / assessed) * 100}%` }}
                />
              ))}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-app-text-muted">
              {levels
                .filter((segment) => segment.value > 0)
                .map((segment, position) => (
                  <span key={segment.level} className="inline-flex items-center gap-1.5">
                    {position > 0 ? <span aria-hidden="true">·</span> : null}
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${segment.className}`}
                    />
                    <span>
                      <span className="tabular-nums">{segment.value}</span> {segment.short}
                    </span>
                  </span>
                ))}
            </span>
          </span>
        )}
        {knowledgeGapCount > 0 && (
          <span className="block truncate text-xs text-app-text-muted">
            {knowledgeGapCount} knowledge {knowledgeGapCount === 1 ? "gap" : "gaps"}
          </span>
        )}
      </Signal>
    </div>
  );
}
