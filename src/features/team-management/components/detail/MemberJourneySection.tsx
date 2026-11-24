import { GitBranch, ListChecks } from "lucide-react";
import { useMemo, type Ref } from "react";
import { SegmentedTabs } from "../../../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../../../components/ui/SlidingTabPanel";
import { useAuth } from "../../../../context/useAuth";
import type { OnboardingFeedback } from "../../../../services/teamManagementService";
import {
  resolveNextAction,
  sortedPhases,
  type OnboardingPathEndpoint,
  type OnboardingPhaseEndpoint,
} from "./journey/journeyKit";
import { currentPhase, focusOf } from "./journey/journeyRules";
import { GraphView, ListView, type JourneyActions } from "./journey/JourneyViews";
import type { StepTaskCount } from "./journey/PhaseHeader";
import { useGraphEditing } from "./journey/useGraphEditing";
import { VIEW_ORDER, useJourneyView, type MemberJourneyHandle } from "./journey/useJourneyView";
import { useStepCreation } from "./journey/useStepCreation";
import type { SkipReviewAction } from "./SkipReview";

export type { MemberJourneyHandle } from "./journey/useJourneyView";

type Props = {
  ref?: Ref<MemberJourneyHandle>;
  userId: string;
  memberName: string;
  path: OnboardingPathEndpoint | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenStep: (stepId: string) => void;
  onOpenQuestions: (phaseId: string, tab: "results" | "questions") => void;
  onDeleteStep: (stepId: string) => void;
  /** Answers a step's pending skip request. */
  onReviewSkip?: (skipId: string, action: SkipReviewAction, comment: string) => Promise<void>;
  /** The member's feedback, shown with the step it is about. */
  feedbackItems?: OnboardingFeedback[];
  onMarkFeedbackRead?: (feedbackId: string) => void;
  markingFeedbackId?: string | null;
  /** Re-reads the path after a change. */
  onPathChanged: () => Promise<void>;
};

/**
 * A member's onboarding path as their PM sees it -- and changes it.
 *
 * The same two readings as the member's own page, behind the same slider: a list to look through
 * phases and steps, and the zoomable graph. Changing the path happens in the graph only, because
 * the graph is what a change is made of: add a blank step, draw what it waits on and what it
 * opens, name it in the details beside it. With "Edit" on, nodes move and connections can be drawn
 * and removed, on the journey map as well as inside a phase. Every change is made on this
 * member's copy only; the blueprint is untouched.
 */
export function MemberJourneySection({
  ref,
  userId,
  memberName,
  path,
  stepTaskCounts,
  onOpenStep,
  onOpenQuestions,
  onDeleteStep,
  onReviewSkip,
  feedbackItems = [],
  onMarkFeedbackRead,
  markingFeedbackId = null,
  onPathChanged,
}: Props) {
  const viewerId = useAuth().profile?.id ?? "";
  const firstName = memberName.split(" ")[0] || "this member";
  const phases = useMemo<OnboardingPhaseEndpoint[]>(() => (path ? sortedPhases(path) : []), [path]);
  const nextAction = useMemo(() => (path ? resolveNextAction(path) : null), [path]);
  const { focusPhaseId, nextItemId } = focusOf(nextAction);
  const [swipeRef, view] = useJourneyView(viewerId, userId, phases, ref);
  const creation = useStepCreation(onPathChanged);
  const { editing, saveLayout } = useGraphEditing({
    phases,
    userId,
    onPathChanged,
    creation,
    onStepDropped: view.setSelectedItemId,
  });
  const phase = currentPhase(phases, view.selectedPhaseId, focusPhaseId);
  const actions: JourneyActions = {
    onOpenStep,
    onOpenQuestions,
    onDeleteStep,
    onReviewSkip,
    onMarkFeedbackRead,
    onPathChanged,
  };

  return (
    <section
      ref={swipeRef}
      aria-labelledby="member-journey-title"
      className="scroll-mt-6 space-y-5 rounded-3xl border border-app-border bg-app-surface/60 p-4 shadow-sm sm:p-6"
    >
      {/* The path's figures (items, phases, skips) are the profile's summary card's job now
          (`MemberSummary`), right above this section; repeating them here was the clutter. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="member-journey-title" className="text-xl font-semibold text-app-text">
            Onboarding path
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Changes apply to {firstName}’s copy only, never to the blueprint. Edit the path in the
            graph.
          </p>
        </div>
      </div>

      {!path || phases.length === 0 || !phase ? (
        <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-4 py-10 text-center text-sm text-app-text-muted">
          {memberName.split(" ")[0] || "This member"} has no onboarding path yet. It appears here
          once they build it from the project’s blueprint.
        </div>
      ) : (
        <>
          <SegmentedTabs
            layoutId="member-journey-view-mode"
            ariaLabel="Member onboarding view"
            value={view.viewMode}
            onChange={view.changeMode}
            options={[
              { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
              { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
            ]}
          />

          <SlidingTabPanel activeKey={view.viewMode} index={VIEW_ORDER.indexOf(view.viewMode)}>
            {view.viewMode === "list" ? (
              <ListView
                phases={phases}
                phase={phase}
                focusPhaseId={focusPhaseId}
                nextItemId={nextItemId}
                stepTaskCounts={stepTaskCounts}
                view={view}
                creation={creation}
                actions={actions}
                firstName={firstName}
              />
            ) : (
              <GraphView
                phases={phases}
                phase={phase}
                focusPhaseId={focusPhaseId}
                nextItemId={nextItemId}
                stepTaskCounts={stepTaskCounts}
                view={view}
                creation={creation}
                actions={actions}
                editing={editing}
                saveLayout={saveLayout}
                feedbackItems={feedbackItems}
                markingFeedbackId={markingFeedbackId}
              />
            )}
          </SlidingTabPanel>
        </>
      )}
    </section>
  );
}
