import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MemberJourneySection,
  type MemberJourneyHandle,
} from "../features/team-management/components/detail/MemberJourneySection";
import { MemberHeroBlock, MemberInsights, MemberNotShown } from "./teamMemberDetail/MemberHeader";
import { MemberDialogs, MemberStepPanel } from "./teamMemberDetail/MemberOverlays";
import { MemberTopBar, WaitingOnYou } from "./teamMemberDetail/MemberParts";
import { memberView } from "./teamMemberDetail/memberView";
import { useMemberPage } from "./teamMemberDetail/useMemberPage";

/**
 * A member's full profile, shown inside the PM workspace's Team section.
 *
 * Rendered by `PmWorkspace` for `/team/:userId`; the workspace reads the param and passes it
 * in as `userId`, so this page never calls `useParams()` itself. The route inherits the
 * `/team-management` policy entry and its `ManagerAreaGuard`. The member is read through
 * `getTeamMember`, which falls back to mock users when the team overview cannot be loaded.
 */
export function TeamMemberDetailPage({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const journeyRef = useRef<MemberJourneyHandle>(null);
  const model = useMemberPage(userId, journeyRef);
  const { data, route, feedback, skips, editing, setCheckModal } = model;
  const { user } = data;

  // Always to the roster, not back through history: the button says "Team", and history could
  // just as well lead to the overview or to the previous member.
  const goBack = () => void navigate("/team-management");

  // Loading and not-found keep the back button, so it never disappears and reappears while the
  // member loads.
  if (data.loading || !user) {
    return <MemberNotShown loading={data.loading} loadError={data.loadError} onBack={goBack} />;
  }

  const view = memberView(model, user);

  return (
    <>
      <section aria-label={`${user.firstname} ${user.lastname}`}>
        <MemberTopBar user={user} model={model} onBack={goBack} />
        <MemberHeroBlock
          user={user}
          model={model}
          onShowJourney={() => journeyRef.current?.showPhase()}
        />
        <div className="space-y-5">
          <WaitingOnYou user={user} model={model} count={view.openItems} />

          <MemberJourneySection
            ref={journeyRef}
            userId={user.userId}
            memberName={`${user.firstname} ${user.lastname}`.trim()}
            path={data.onboardingPath}
            stepTaskCounts={model.tasks.counts}
            onOpenStep={route.setDetailStepId}
            onOpenQuestions={(phaseId, tab) => setCheckModal({ phaseId, tab })}
            onDeleteStep={editing.steps.setGraphStepToDelete}
            onReviewSkip={skips.review}
            feedbackItems={data.feedbackItems}
            onMarkFeedbackRead={(feedbackId) => void feedback.markRead(feedbackId)}
            markingFeedbackId={feedback.markingId}
            onPathChanged={data.refreshOnboardingPath}
          />

          <MemberInsights
            model={model}
            view={view}
            onOpenKnowledgeGap={(gapId) => void navigate(`/insights/knowledge-gaps/${gapId}`)}
          />
        </div>
      </section>
      <MemberDialogs user={user} model={model} view={view} userId={userId} />
      <MemberStepPanel model={model} view={view} />
    </>
  );
}
