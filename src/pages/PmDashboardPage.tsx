import { useMemo } from "react";
import { Hand, Inbox, Rocket, Users } from "lucide-react";
import { IngestionStatusWidget } from "../features/data-ingestion/components/IngestionStatusWidget";
import { useAttention } from "../features/onboarding-metrics/hooks/useAttention";
import { formatDuration } from "../features/onboarding-metrics/format";
import { buildAttentionQueue } from "../features/pm-area/attentionQueue";
import { PmStat } from "../features/pm-area/components/PmCard";
import {
  KnowledgeGapsCard,
  OnboardingHealthCard,
  QuestionsCard,
} from "../features/pm-area/components/overview/InsightCards";
import { NeedsYouCard } from "../features/pm-area/components/overview/NeedsYouCard";
import { TeamPulseCard } from "../features/pm-area/components/overview/TeamPulseCard";
import { useOpenEscalationCount } from "../features/knowledge-request/useOpenEscalationCount";
import { memberStage, waitingOn } from "../features/pm-area/memberStatus";
import { useMemberPeek } from "../features/pm-area/useMemberPeek";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { ProjectIndustryWidget } from "../features/projects/industry/ProjectIndustryWidget";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useQueryFetch } from "../hooks/useQueryFetch";
import { isUnread } from "../features/pm-area/useMemberOpenItems";
import { getAllOnboardingFeedback } from "../services/teamManagementService";
import { onboardingMetricsService } from "../services/onboardingMetricsService";
import { queryKeys } from "../services/queryKeys";

/**
 * The overview section of the PM workspace (see `PmWorkspace`): what needs the manager today, how the team is doing, and the
 * three insight readouts — each a click from the section it summarizes.
 *
 * Built around one queue ("Needs you") rather than a column of equal widgets. The old page gave
 * ingestion health the top row and made a manager scroll past it to find a skip request; the
 * first question a manager brings to this page is "does anybody need me", so that answer leads,
 * and every person in it opens in the side panel where it can be acted on.
 */
export function PmDashboardPage() {
  const { selectedProjectId } = useProjectContext();
  const { openMember } = useMemberPeek();

  const { data: roster, loading: rosterLoading, error: rosterError } = useTeamRoster();
  const { attention, isLoading: attentionLoading } = useAttention(selectedProjectId);
  const { data: metrics } = useQueryFetch(
    queryKeys.onboardingMetrics.project(selectedProjectId),
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
  );

  const members = useMemo(() => roster ?? [], [roster]);
  const queue = useMemo(
    () => buildAttentionQueue(members, attention?.items ?? []),
    [members, attention],
  );

  const openEscalations = useOpenEscalationCount(selectedProjectId, true);

  const doneCount = members.filter((member) => memberStage(member) === "done").length;
  const { data: allFeedback } = useQueryFetch(
    queryKeys.memberFeedback.all(),
    getAllOnboardingFeedback,
  );

  // What is open with the manager, counted as items rather than people: every pending skip
  // request, and every unread piece of feedback from someone on this project. A member the
  // roster flags as having feedback but whose items the feedback read does not show (or while
  // it is loading or failed) still counts as one, so the figure never under-reports.
  const skipCount = members.filter((member) => waitingOn(member).includes("skip")).length;
  const unreadByMember = new Map<string, number>();
  for (const item of allFeedback ?? []) {
    if (!item.userId || !isUnread(item)) continue;
    unreadByMember.set(item.userId, (unreadByMember.get(item.userId) ?? 0) + 1);
  }
  const feedbackCount = members.reduce(
    (sum, member) =>
      sum + Math.max(unreadByMember.get(member.userId) ?? 0, member.hasFeedback ? 1 : 0),
    0,
  );
  const waitingCount = skipCount + feedbackCount;
  const waitingHint = `${skipCount} skip ${skipCount === 1 ? "request" : "requests"} · ${feedbackCount} unread feedback`;

  const figuresReady = !rosterLoading && !rosterError;

  return (
    <section aria-label="Overview" className="space-y-5">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PmStat
          icon={Users}
          label="Team members"
          value={figuresReady ? members.length : "—"}
          hint={figuresReady ? `${doneCount} through onboarding` : "Loading the team"}
          to="/team-management"
        />
        {/* A raised hand, not the inbox: the inbox is Escalations everywhere else in the area
            (its tab, its figure), and this tile leads to people on the team, not to that inbox. */}
        <PmStat
          icon={Hand}
          label="Waiting on you"
          value={figuresReady ? waitingCount : "—"}
          hint={waitingCount > 0 ? waitingHint : "No skip requests, no unread feedback"}
          attention={waitingCount > 0}
          to="/team-management?filter=waiting"
        />
        <PmStat
          icon={Inbox}
          tone="purple"
          label="Open escalations"
          value={openEscalations}
          hint={openEscalations > 0 ? "Questions the buddy couldn't answer" : "Inbox clear"}
          attention={openEscalations > 0}
          to="/insights/knowledge-requests"
        />
        <PmStat
          icon={Rocket}
          tone="cyan"
          label="To first accepted work"
          value={metrics ? formatDuration(metrics.medianHoursToFirstAcceptedContribution) : "—"}
          hint="Median, joined → accepted"
          to="/insights/onboarding"
        />
      </section>

      {/* The team gets the width: it is the one card with a whole roster to show, while "Needs
          you" is a short pointer list that reads fine narrow. */}
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <NeedsYouCard
          entries={queue}
          loading={rosterLoading || attentionLoading}
          onOpenMember={openMember}
        />
        <TeamPulseCard
          roster={members}
          loading={rosterLoading}
          error={rosterError}
          onOpenMember={openMember}
        />
      </div>

      <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
        <OnboardingHealthCard />
        <QuestionsCard />
        <KnowledgeGapsCard />
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <IngestionStatusWidget />
        <ProjectIndustryWidget />
      </div>
    </section>
  );
}
