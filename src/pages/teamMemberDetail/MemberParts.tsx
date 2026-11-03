import { ArrowLeft, Hand, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { MemberOpenItems } from "../../features/pm-area/components/MemberOpenItems";
import type { TeamOverviewUser } from "../../features/team-management/types";
import type { MemberPageModel } from "./useMemberPage";

export function BackToTeam({ onBack }: { onBack: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      icon={<ArrowLeft className="h-4 w-4" />}
      className="mb-3 -ml-2"
    >
      Team
    </Button>
  );
}

type MemberTopBarProps = {
  user: TeamOverviewUser;
  model: MemberPageModel;
  onBack: () => void;
};

/** The way back, and the control that builds the member's path again. */
export function MemberTopBar({ user, model, onBack }: MemberTopBarProps) {
  const { rebuild, selectedProjectId, data } = model;
  const isRebuilding = rebuild.rebuildingUserId === user.userId;

  return (
    <div className="flex items-start justify-between gap-3">
      <BackToTeam onBack={onBack} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => rebuild.setConfirming(true)}
        icon={<RefreshCw className="h-4 w-4" />}
        loading={isRebuilding}
        disabled={!selectedProjectId || rebuild.rebuildingUserId !== null}
        title={`Rebuild ${user.firstname}'s onboarding path with AI`}
      >
        {isRebuilding ? "Rebuilding…" : data.onboardingPath ? "Rebuild path" : "Build path"}
      </Button>
    </div>
  );
}

type WaitingOnYouProps = {
  user: TeamOverviewUser;
  model: MemberPageModel;
  count: number;
};

/**
 * Only while something is open: an empty "waiting on you" strip at the top of every profile would
 * push the rest down to say nothing. Each line opens its step. Fed from this page's own feedback
 * and skip handling, so it shares the guard with the journey and the step panel.
 */
export function WaitingOnYou({ user, model, count }: WaitingOnYouProps) {
  const { data, skips, feedback, route } = model;
  const skipId = user.currentStep?.skip?.id;

  if (count === 0) return null;

  return (
    <section
      aria-label="Waiting on you"
      className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
    >
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-app-warning-text uppercase">
        <Hand aria-hidden="true" className="h-3.5 w-3.5" />
        Waiting on you
        <span className="rounded-full bg-app-surface px-1.5 py-0.5 text-2xs tracking-normal normal-case tabular-nums">
          {count}
        </span>
      </h2>
      <MemberOpenItems
        member={user}
        feedback={data.feedbackItems}
        feedbackLoading={data.loadingFeedback}
        feedbackError={Boolean(data.feedbackError)}
        reviewingSkip={skipId ? (skips.reviewing[skipId] ?? null) : null}
        markingFeedbackId={feedback.markingId}
        onReviewSkip={(id, decision) => void skips.review(id, decision)}
        onMarkRead={(feedbackId) => void feedback.markRead(feedbackId)}
        onOpenStep={route.setDetailStepId}
      />
    </section>
  );
}
