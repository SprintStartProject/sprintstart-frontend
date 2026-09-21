import { useMemo } from "react";
import { Hand, Inbox, MessageSquareText, Rocket, SkipForward, Users } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
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
import { TeamPulseCard } from "../features/pm-area/components/overview/TeamPulseCard";
import { useOpenEscalationCount } from "../features/knowledge-request/useOpenEscalationCount";
import { memberStage, waitingOn } from "../features/pm-area/memberStatus";
import { useMemberPeek } from "../features/pm-area/useMemberPeek";
import { useTeamRoster } from "../features/pm-area/useTeamRoster";
import { ProjectIndustryWidget } from "../features/projects/industry/ProjectIndustryWidget";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useQueryFetch } from "../hooks/useQueryFetch";
import { isUnread } from "../features/pm-area/useMemberOpenItems";
import { getUserOnboardingFeedback } from "../services/teamManagementService";
import { onboardingMetricsService } from "../services/onboardingMetricsService";
import { queryKeys } from "../services/queryKeys";

/**
 * The overview section of the PM workspace (see `PmWorkspace`): what needs the manager today, how the team is doing, and the
 * three insight readouts — each a click from the section it summarizes.
 *
 * Built around "does anybody need me" rather than a column of equal widgets. The old page gave
 * ingestion health the top row and made a manager scroll past it to find a skip request. Now the
 * "Waiting on you" figure says how many answers are owed, and the team card below lists the
 * people who need the manager first, each opening in the side panel where it can be acted on.
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
  // Each flagged member's own feedback, under the same key the member panel reads — so marking
  // one read in the panel refreshes this count too, and opening the panel after the overview
  // costs no second request.
  const feedbackQueries = useQueries({
    queries: members
      .filter((member) => member.hasFeedback)
      .map((member) => ({
        queryKey: queryKeys.memberFeedback.byUser(member.userId),
        queryFn: () => getUserOnboardingFeedback(member.userId),
      })),
  });

  // What is open with the manager, counted as items rather than people: every pending skip
  // request, and every unread piece of feedback. A flagged member whose feedback has not loaded
  // (or failed to) still counts as one, so the figure never under-reports.
  const skipCount = members.filter((member) => waitingOn(member).includes("skip")).length;
  const feedbackCount = feedbackQueries.reduce(
    (sum, query) => sum + Math.max(1, (query.data ?? []).filter(isUnread).length),
    0,
  );
  const waitingCount = skipCount + feedbackCount;

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
          hint={
            waitingCount > 0 ? (
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1" title="Skip requests">
                  <SkipForward aria-hidden="true" className="h-3.5 w-3.5 text-app-warning-text" />
                  {skipCount}
                  <span className="sr-only">skip requests</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Unread feedback">
                  <MessageSquareText
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-app-brand-text"
                  />
                  {feedbackCount}
                  <span className="sr-only">unread feedback</span>
                </span>
              </span>
            ) : (
              "Nothing to answer"
            )
          }
          attention={waitingCount > 0}
          to="/team-management?filter=attention"
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

      <TeamPulseCard
        roster={members}
        queue={queue}
        loading={rosterLoading || attentionLoading}
        error={rosterError}
        onOpenMember={openMember}
      />

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
