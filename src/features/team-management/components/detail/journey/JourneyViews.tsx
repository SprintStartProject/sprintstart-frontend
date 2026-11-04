import { ClipboardCheck, ListPlus, Trash2 } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { FeedbackNote } from "../FeedbackNote";
import { SkipReview } from "../SkipReview";
import { StepQuickEdit } from "../StepQuickEdit";
import {
  ItemAside,
  JourneyGraph,
  PhaseNavigator,
  skipRequestOf,
  type GraphEditing,
  type OnboardingPhaseEndpoint,
  type PhaseItem,
} from "./journeyKit";
import { MemberItemList } from "./MemberItemList";
import { PhaseHeader, StepFacts, type StepTaskCount } from "./PhaseHeader";
import type { SkipReviewAction } from "../SkipReview";
import type { OnboardingFeedback } from "../../../../../services/teamManagementService";
import type { JourneyView } from "./useJourneyView";
import type { StepCreation } from "./useStepCreation";

/** What a view may ask the page and the profile to do. */
export type JourneyActions = {
  onOpenStep: (stepId: string) => void;
  onOpenQuestions: (phaseId: string, tab: "results" | "questions") => void;
  onDeleteStep: (stepId: string) => void;
  onReviewSkip?: (skipId: string, action: SkipReviewAction, comment: string) => Promise<void>;
  onMarkFeedbackRead?: (feedbackId: string) => void;
  onPathChanged: () => Promise<void>;
};

type ViewProps = {
  phases: OnboardingPhaseEndpoint[];
  phase: OnboardingPhaseEndpoint;
  focusPhaseId: string | null;
  nextItemId: string | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  view: JourneyView;
  creation: StepCreation;
  actions: JourneyActions;
};

function QuestionTools({
  target,
  onOpenQuestions,
}: {
  target: OnboardingPhaseEndpoint;
  onOpenQuestions: JourneyActions["onOpenQuestions"];
}) {
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<ClipboardCheck className="h-3.5 w-3.5" />}
        onClick={() => onOpenQuestions(target.id, "results")}
      >
        Question results
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onOpenQuestions(target.id, "questions")}>
        {(target.questions ?? []).length > 0 ? "Edit questions" : "Add questions"}
      </Button>
    </>
  );
}

function ListTools({
  phase,
  creation,
  actions,
}: Pick<ViewProps, "phase" | "creation" | "actions">) {
  return (
    <>
      <Button
        size="sm"
        variant="primary"
        icon={<ListPlus className="h-4 w-4" />}
        loading={creation.isAdding}
        disabled={creation.isAdding}
        onClick={() => void creation.addInList(phase, null)}
      >
        Add step
      </Button>
      <QuestionTools target={phase} onOpenQuestions={actions.onOpenQuestions} />
    </>
  );
}

/** The form that names a step just added from the list. */
function FreshStepEdit({
  item,
  creation,
  actions,
}: Pick<ViewProps, "creation" | "actions"> & { item: PhaseItem }) {
  if (item.kind !== "step") return null;

  return (
    <StepQuickEdit
      key={item.step.id}
      step={item.step}
      startEditing
      onSaved={async () => {
        creation.setFreshStepId(null);
        await actions.onPathChanged();
      }}
    />
  );
}

/** The list reading: the phases beside the open phase's items, in stages. */
export function ListView({
  phases,
  phase,
  focusPhaseId,
  nextItemId,
  stepTaskCounts,
  view,
  creation,
  actions,
  firstName,
}: ViewProps & { firstName: string }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PhaseNavigator
        phases={phases}
        selectedPhaseId={phase.id}
        focusPhaseId={focusPhaseId}
        onSelect={view.setSelectedPhaseId}
        className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[44rem]"
      />
      <div className="min-w-0 space-y-4">
        <PhaseHeader
          phase={phase}
          phases={phases}
          isFocus={phase.id === focusPhaseId}
          firstName={firstName}
          tools={<ListTools phase={phase} creation={creation} actions={actions} />}
        />
        <MemberItemList
          phase={phase}
          nextItemId={nextItemId}
          stepTaskCounts={stepTaskCounts}
          onOpenItem={(item) =>
            item.kind === "step"
              ? actions.onOpenStep(item.id)
              : actions.onOpenQuestions(phase.id, "results")
          }
          onAddAfter={(item) => void creation.addInList(phase, item)}
          freshStepId={creation.freshStepId}
          renderFreshStep={(item) => (
            <FreshStepEdit item={item} creation={creation} actions={actions} />
          )}
        />
      </div>
    </div>
  );
}

type AsideProps = Pick<ViewProps, "stepTaskCounts" | "view" | "creation" | "actions"> & {
  item: PhaseItem;
  feedbackItems: OnboardingFeedback[];
  markingFeedbackId: string | null;
};

/** What the graph's aside shows of a step: its facts, a pending skip, its feedback and a quick edit. */
function StepAside({
  item,
  stepTaskCounts,
  creation,
  actions,
  feedbackItems,
  markingFeedbackId,
}: AsideProps) {
  if (item.kind !== "step") return null;
  const { onReviewSkip } = actions;
  const skip = item.step.skip;

  return (
    <>
      <StepFacts item={item} taskCount={stepTaskCounts[item.id]} />
      {onReviewSkip && skipRequestOf(item) === "pending" && skip?.id ? (
        <SkipReview
          key={skip.id}
          reason={skip.reason}
          onReview={(action, comment) => onReviewSkip(skip.id, action, comment)}
        />
      ) : null}
      {feedbackItems
        .filter((feedback) => feedback.stepId === item.id)
        .map((feedback) => (
          <FeedbackNote
            key={feedback.id}
            feedback={feedback}
            marking={markingFeedbackId === feedback.id}
            onMarkRead={actions.onMarkFeedbackRead}
          />
        ))}
      <StepQuickEdit
        key={`${item.step.id}:${item.step.title}:${item.step.description}`}
        step={item.step}
        startEditing={item.id === creation.freshStepId}
        onSaved={async () => {
          creation.setFreshStepId(null);
          await actions.onPathChanged();
        }}
      />
    </>
  );
}

function AsideActions({
  item,
  phase,
  actions,
}: {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  actions: JourneyActions;
}) {
  if (item.kind !== "step") {
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => actions.onOpenQuestions(phase.id, "results")}
      >
        View attempts
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => actions.onOpenStep(item.id)}>
        Tasks & details
      </Button>
      <Button
        size="sm"
        variant="dangerSoft"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => actions.onDeleteStep(item.id)}
      >
        Delete
      </Button>
    </>
  );
}

type GraphViewProps = ViewProps & {
  editing: GraphEditing;
  saveLayout: React.ComponentProps<typeof JourneyGraph>["saveLayout"];
  feedbackItems: OnboardingFeedback[];
  markingFeedbackId: string | null;
};

/** The graph reading: the whole journey, and a phase's own steps when one is opened. */
export function GraphView({
  phases,
  focusPhaseId,
  nextItemId,
  stepTaskCounts,
  view,
  creation,
  actions,
  editing,
  saveLayout,
  feedbackItems,
  markingFeedbackId,
}: GraphViewProps) {
  return (
    <JourneyGraph
      phases={phases}
      openPhaseId={view.openGraphPhaseId}
      onOpenPhaseChange={(phaseId) => {
        view.setGraphPhaseId(phaseId);
        if (phaseId) view.setSelectedPhaseId(phaseId);
      }}
      focusPhaseId={focusPhaseId}
      nextItemId={nextItemId}
      saveLayout={saveLayout}
      editing={editing}
      selectedItemId={view.selectedItemId}
      onSelectItem={(id) => {
        view.setSelectedItemId(id);
        if (id !== creation.freshStepId) creation.setFreshStepId(null);
      }}
      onOpenItem={(item) =>
        item.kind === "step"
          ? actions.onOpenStep(item.id)
          : actions.onOpenQuestions(item.question.phaseId, "results")
      }
      renderItemAside={(item, asidePhase) => (
        <ItemAside
          key={item.id}
          item={item}
          phase={asidePhase}
          onClose={() => view.setSelectedItemId(null)}
          onSelect={view.setSelectedItemId}
          actions={<AsideActions item={item} phase={asidePhase} actions={actions} />}
        >
          <StepAside
            item={item}
            stepTaskCounts={stepTaskCounts}
            view={view}
            creation={creation}
            actions={actions}
            feedbackItems={feedbackItems}
            markingFeedbackId={markingFeedbackId}
          />
        </ItemAside>
      )}
    />
  );
}
