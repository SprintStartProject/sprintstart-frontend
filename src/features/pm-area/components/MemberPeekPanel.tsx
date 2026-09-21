import { ArrowUpRight, Check, Clock, Flag, GraduationCap, Hand, Route } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { SidePanel } from "../../../components/ui/SidePanel";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { queryKeys } from "../../../services/queryKeys";
import { getUserOnboardingPath, getUserSkillLevels } from "../../../services/teamManagementService";
import { findActivePhaseIndex } from "../../onboarding/activePhase";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import { formatDuration, formatMoment } from "../../onboarding-metrics/format";
import { isAwaitingFirstResponse } from "../../onboarding-metrics/hireStatus";
import { hireMoments } from "../../onboarding-metrics/moments";
import { useProjectContext } from "../../projects/useProjectContext";
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
import { useMemberOpenItems } from "../useMemberOpenItems";
import { useMemberPeek } from "../useMemberPeek";
import { useTeamRoster } from "../useTeamRoster";
import { MemberOpenItems } from "./MemberOpenItems";
import { MemberProgressBar } from "./MemberRow";
import { PmEyebrow } from "./PmCard";

function PanelSection({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: typeof Route;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-app-text">
          <Icon aria-hidden="true" className="h-4 w-4 text-app-brand-text" />
          {title}
        </h3>
        {meta && <span className="text-xs text-app-text-muted tabular-nums">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Where the member is in their path, counted: "Phase 2 of 4", one segment per phase, and how far
 * into the current phase they are. A progress percentage says how much is done; this says how
 * much is left, and in what shape — which is what a manager asks when deciding whether to step in.
 */
function PhaseProgress({ path, done }: { path: OnboardingPathEndpoint; done: boolean }) {
  const phases = [...path.phases].sort((a, b) => a.position - b.position);
  if (phases.length === 0) return null;

  const activeIndex = done ? phases.length - 1 : findActivePhaseIndex({ ...path, phases });
  const active = phases[activeIndex];
  const steps = active.steps ?? [];
  const closedSteps = steps.filter(
    (step) => step.status === "FINISHED" || step.status === "SKIPPED",
  ).length;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-app-text">
          <span className="font-semibold">
            Phase {activeIndex + 1} of {phases.length}
          </span>
          <span className="text-app-text-muted"> · {active.title}</span>
        </p>
        {!done && steps.length > 0 && (
          <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
            {closedSteps} of {steps.length} steps
          </span>
        )}
      </div>
      <ol aria-label="Phases" className="mt-2 flex gap-1">
        {phases.map((phase, index) => {
          const state =
            done || index < activeIndex ? "done" : index === activeIndex ? "current" : "next";

          return (
            <li
              key={phase.id}
              title={`${index + 1}. ${phase.title}`}
              aria-label={`Phase ${index + 1}: ${phase.title}${
                state === "done" ? ", done" : state === "current" ? ", current" : ""
              }`}
              className={`h-1.5 flex-1 rounded-full ${
                state === "done"
                  ? "bg-app-success-solid"
                  : state === "current"
                    ? "bg-app-brand"
                    : "bg-app-progress-track"
              }`}
            />
          );
        })}
      </ol>
    </div>
  );
}

const LEVEL_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

function MemberPeekContent({ userId }: { userId: string }) {
  const { selectedProjectId } = useProjectContext();
  const { data: roster, loading: rosterLoading } = useTeamRoster();
  const member = roster?.find((candidate) => candidate.userId === userId) ?? null;

  const openItems = useMemberOpenItems(userId);

  const { data: metrics } = useQueryFetch(
    queryKeys.onboardingMetrics.project(selectedProjectId),
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
  );
  const hire = metrics?.hires.find((candidate) => candidate.userId === userId) ?? null;

  const { data: path } = useQueryFetch(queryKeys.memberPath.byUser(userId), () =>
    getUserOnboardingPath(userId),
  );

  const { data: skills, loading: skillsLoading } = useQueryFetch(
    queryKeys.memberSkills.byUser(userId),
    () => getUserSkillLevels(userId),
  );

  if (rosterLoading) {
    return (
      <SkeletonGroup label="Loading member" className="space-y-3">
        <SkeletonLine className="h-24 w-full rounded-2xl" />
        <SkeletonLine className="h-32 w-full rounded-2xl" />
      </SkeletonGroup>
    );
  }

  if (!member) {
    return (
      <EmptyState title="Not on this project">
        This person is not part of the selected project&apos;s team, or could not be loaded.
      </EmptyState>
    );
  }

  const percent = progressPercent(member);
  const stage = memberStage(member);
  const days = daysOnStep(member);
  const atRisk = isAtRisk(member);
  const waitingCount = waitingOn(member).length;

  const sortedSkills = [...(skills ?? [])].sort(
    (a, b) => (LEVEL_RANK[a.level] ?? 0) - (LEVEL_RANK[b.level] ?? 0),
  );

  return (
    <div className="space-y-4">
      <PanelSection icon={Route} title="Onboarding" meta={STAGE_LABEL[stage]}>
        <MemberProgressBar percent={percent} />
        {path && <PhaseProgress path={path} done={stage === "done"} />}

        {stage === "done" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-app-text">
            <Check aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
            Through the whole path.
          </p>
        ) : (
          <dl className={`mt-4 grid grid-cols-1 gap-3 ${path ? "" : "sm:grid-cols-2"}`}>
            {/* The phase is named in the "Phase 2 of 4" line above once the path is in. */}
            {!path && (
              <div className="min-w-0">
                <dt>
                  <PmEyebrow>Phase</PmEyebrow>
                </dt>
                <dd className="mt-1 truncate text-sm text-app-text">
                  {member.currentPhase?.title ?? "—"}
                </dd>
              </div>
            )}
            <div className="min-w-0">
              <dt>
                <PmEyebrow>Current step</PmEyebrow>
              </dt>
              <dd className="mt-1 text-sm text-app-text">
                {member.currentStep?.title ?? "Not started yet"}
              </dd>
              {days !== null && (
                <dd
                  className={`mt-0.5 flex items-center gap-1 text-xs ${
                    atRisk ? "font-medium text-app-orange-text" : "text-app-text-muted"
                  }`}
                >
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  {formatDays(days)} on this step
                </dd>
              )}
            </div>
          </dl>
        )}
      </PanelSection>

      <PanelSection
        icon={Hand}
        title="Waiting on you"
        meta={waitingCount > 0 ? `${waitingCount} open` : undefined}
      >
        <MemberOpenItems
          member={member}
          feedback={openItems.feedback}
          feedbackLoading={openItems.feedbackLoading}
          feedbackError={openItems.feedbackError}
          reviewingSkip={openItems.reviewingSkip}
          markingFeedbackId={openItems.markingFeedbackId}
          onReviewSkip={(skipId, decision) => void openItems.reviewSkip(skipId, decision)}
          onMarkRead={(feedbackId) => void openItems.markRead(feedbackId)}
        />
      </PanelSection>

      {hire && (
        <PanelSection
          icon={Flag}
          title="First contributions"
          meta={hire.stalled ? "Stalled" : undefined}
        >
          {hire.stalled && hire.stalledReason && (
            <p className="mb-3 rounded-xl bg-app-orange-bg px-3 py-2 text-xs text-app-orange-text">
              {hire.stalledReason}
            </p>
          )}

          <ol className="relative space-y-2.5">
            {hireMoments(hire).map((moment) => {
              const reached = moment.at !== null;
              const MomentIcon = moment.icon;

              return (
                <li key={moment.label} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      reached
                        ? "border-app-brand bg-app-brand text-white"
                        : "border-dashed border-app-border text-app-text-subtle"
                    }`}
                  >
                    <MomentIcon className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className={`min-w-0 flex-1 text-sm ${reached ? "text-app-text" : "text-app-text-subtle"}`}
                  >
                    {moment.label}
                  </span>
                  <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
                    {formatMoment(moment.at)}
                  </span>
                </li>
              );
            })}
          </ol>

          {isAwaitingFirstResponse(hire) && hire.longestOpenWaitHours !== null && (
            <p className="mt-3 text-xs text-app-text-muted">
              Waiting {formatDuration(hire.longestOpenWaitHours)} on a first response.
            </p>
          )}
        </PanelSection>
      )}

      <PanelSection
        icon={GraduationCap}
        title="Skills"
        meta={sortedSkills.length > 0 ? `${sortedSkills.length} assessed` : undefined}
      >
        {skillsLoading ? (
          <SkeletonGroup label="Loading skills" className="space-y-2">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
          </SkeletonGroup>
        ) : sortedSkills.length === 0 ? (
          <p className="text-sm text-app-text-muted">No completed skill assessment yet.</p>
        ) : (
          <ul className="space-y-2">
            {sortedSkills.slice(0, 6).map((skill) => {
              const rank = LEVEL_RANK[skill.level] ?? 0;

              return (
                <li key={skill.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-app-text">{skill.skillName}</span>
                  <span
                    className="flex shrink-0 items-center gap-1"
                    title={skill.level.toLowerCase()}
                  >
                    {[1, 2, 3, 4].map((dot) => (
                      <span
                        key={dot}
                        aria-hidden="true"
                        className={`h-1.5 w-4 rounded-full ${
                          dot <= rank
                            ? rank <= 1
                              ? "bg-app-warning-solid"
                              : "bg-app-brand"
                            : "bg-app-border"
                        }`}
                      />
                    ))}
                    <span className="sr-only">{skill.level.toLowerCase()}</span>
                  </span>
                </li>
              );
            })}
            {sortedSkills.length > 6 && (
              <li className="text-xs text-app-text-muted">
                and {sortedSkills.length - 6} more on the full profile
              </li>
            )}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}

function PeekHeaderBadges({ roles }: { roles: { id: string; name: string }[] }) {
  if (roles.length === 0) {
    return (
      <Badge variant="neutral" size="sm">
        No role yet
      </Badge>
    );
  }

  return (
    <>
      {roles.map((role) => (
        <Badge key={role.id} variant="brand" size="sm">
          {role.name}
        </Badge>
      ))}
    </>
  );
}

/** Split from {@link MemberPeekPanel} so nothing is fetched while the panel is closed. */
function MemberPeekSidePanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: roster } = useTeamRoster();
  const member = roster?.find((candidate) => candidate.userId === userId);
  const name = member ? memberName(member) : "Team member";

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={name}
      leading={
        <UserAvatar profileIcon={member?.profileIcon} fallbackName={name} seed={userId} size={48} />
      }
      badge={member ? <PeekHeaderBadges roles={member.roles} /> : undefined}
      actions={
        <Link
          to={`/team/${userId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Full profile
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      }
      widthClassName="w-full sm:w-[34rem]"
      contentClassName="px-4 py-5 sm:px-6"
      closeAriaLabel="Close member panel"
    >
      <MemberPeekContent userId={userId} />
    </SidePanel>
  );
}

/**
 * The member side panel the whole PM area shares — opened by `?member=<id>` on any PM page.
 *
 * Answers "how is this person doing, and do they need me" without leaving the list the manager
 * was working through, and lets them act on it there: approve or deny a skip, read feedback.
 * The full profile — the path itself, editing steps, knowledge checks — is one press away in
 * the header, which is where it belongs: most looks at a member never need it.
 */
export function MemberPeekPanel() {
  const { memberId, closeMember } = useMemberPeek();

  return (
    <PanelPresence value={memberId}>
      {(userId) => <MemberPeekSidePanel userId={userId} onClose={closeMember} />}
    </PanelPresence>
  );
}
