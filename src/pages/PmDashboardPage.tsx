import { useMemo } from "react";
import { Inbox, MessageCircleQuestion, Rocket, Users } from "lucide-react";
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
  const waitingCount = members.filter((member) => waitingOn(member).length > 0).length;
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
        <PmStat
          icon={Inbox}
          label="Waiting on you"
          help="Team members with a skip request you haven't decided or feedback you haven't read. Open one to answer it right there."
          value={figuresReady ? waitingCount : "—"}
          hint={waitingCount > 0 ? "Skip requests or feedback" : "Nothing to answer"}
          attention={waitingCount > 0}
          to="/team-management?filter=waiting"
        />
        <PmStat
          icon={MessageCircleQuestion}
          label="Open escalations"
          help="Questions the buddy couldn't answer from the project's knowledge, so it passed them on to you. Your answer is kept and reused for the next person who asks."
          value={openEscalations}
          hint={openEscalations > 0 ? "Questions the buddy couldn't answer" : "Inbox clear"}
          attention={openEscalations > 0}
          to="/insights/knowledge-requests"
        />
        <PmStat
          icon={Rocket}
          label="To first accepted work"
          help="The median time from joining the project to a hire's first contribution being accepted, such as a merged pull request. Lower means people get productive sooner."
          value={metrics ? formatDuration(metrics.medianHoursToFirstAcceptedContribution) : "—"}
          hint="Median, joined → accepted"
          to="/insights/onboarding"
        />
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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

      {/* Top-aligned, not stretched: the industry card grows when its evidence is opened, and
          the ingestion card beside it has no reason to grow with it. */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <IngestionStatusWidget />
        <ProjectIndustryWidget />
      </div>
    </section>
  );
}
