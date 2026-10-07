import { ArrowUpRight, Flag, GraduationCap, Hand } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { formatDuration, formatMoment } from "../../onboarding-metrics/format";
import { isAwaitingFirstResponse } from "../../onboarding-metrics/hireStatus";
import { hireMoments } from "../../onboarding-metrics/moments";
import { useProjectContext } from "../../projects/useProjectContext";
import { memberName, waitingOn } from "../memberStatus";
import { MEMBER_PHASE_PARAM, MEMBER_STEP_PARAM } from "../pmWorkspacePaths";
import { useMemberOpenItems } from "../useMemberOpenItems";
import { useMemberPeek } from "../useMemberPeek";
import { useTeamRoster } from "../useTeamRoster";
import { MemberOpenItems } from "./MemberOpenItems";
import { MemberSummary } from "./MemberSummary";

function PanelSection({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: LucideIcon;
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

const LEVEL_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

function MemberPeekContent({ userId }: { userId: string }) {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
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

  const waitingCount = waitingOn(member).length;

  const sortedSkills = [...(skills ?? [])].sort(
    (a, b) => (LEVEL_RANK[a.level] ?? 0) - (LEVEL_RANK[b.level] ?? 0),
  );

  return (
    <div className="space-y-4">
      {/* The member's onboarding at a glance — the card the full profile used to open on. A phase
          in it leads to the full profile with that phase shown in the path. */}
      <MemberSummary
        member={member}
        path={path ?? null}
        feedback={openItems.feedback ?? []}
        onOpenPhase={(phaseId) =>
          void navigate(`/team/${userId}?${MEMBER_PHASE_PARAM}=${encodeURIComponent(phaseId)}`)
        }
      />

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
          // The step itself lives on the full profile, so the item leads there with it open.
          onOpenStep={(stepId) =>
            void navigate(`/team/${userId}?${MEMBER_STEP_PARAM}=${encodeURIComponent(stepId)}`)
          }
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
          className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-app-brand-hover"
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
