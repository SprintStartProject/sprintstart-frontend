import { Lock } from "lucide-react";
import { blockingPhases, itemState, phaseItems, waitingOn, type PhaseItem } from "../../journey";
import type {
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../../../../services/onboardingTypes";
import { QuestionWorkspace } from "./QuestionWorkspace";
import { StepWorkspace } from "./StepWorkspace";

/** What stands in front of an item that is not open yet, in words. */
function lockedReason(
  item: PhaseItem,
  phase: OnboardingPhaseEndpoint,
  phases: OnboardingPhaseEndpoint[],
) {
  const phaseBlockers = phase.locked ? blockingPhases(phase, phases) : [];
  if (phaseBlockers.length > 0) {
    const names = phaseBlockers.map((blocker) => blocker.title).join(" and ");
    return `Opens once ${names} ${phaseBlockers.length === 1 ? "is" : "are"} complete.`;
  }
  const blockers = waitingOn(item, phaseItems(phase));
  if (blockers.length > 0) {
    return `Opens once you have finished ${blockers.map((blocker) => blocker.title).join(" and ")}.`;
  }
  return "Not open yet.";
}

function LockedBody({
  item,
  phase,
  phases,
}: {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
}) {
  return (
    <div className="space-y-3 text-sm text-app-text-muted">
      {item.kind === "step" && item.step.description ? <p>{item.step.description}</p> : null}
      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-3 py-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {lockedReason(item, phase, phases)}
      </p>
    </div>
  );
}

export type ItemBodyProps = {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  layout: "inline" | "focus";
  /** What the button after a finished item says and does. */
  next: { label: string; run: () => void };
  onAnswered: (
    question: OnboardingQuestionEndpoint,
    result: QuestionAttemptResult,
  ) => Promise<void>;
  onPathChanged: () => Promise<void>;
  onSkipAnswerSeen: (skipId: string) => void;
};

/** The item itself: a step to work through, a question to answer, or why it is not open yet. */
export function ItemBody(props: ItemBodyProps) {
  const { item, phase, phases, layout, next } = props;
  if (itemState(item, phase.locked) === "locked") {
    return <LockedBody item={item} phase={phase} phases={phases} />;
  }
  if (item.kind === "question") {
    return (
      <QuestionWorkspace
        key={item.id}
        question={item.question}
        phaseTitle={phase.title}
        onAnswered={(result) => props.onAnswered(item.question, result)}
        continueLabel={next.label}
        onContinue={next.run}
      />
    );
  }
  return (
    <StepWorkspace
      key={item.id}
      stepId={item.id}
      stepStatus={item.step.status}
      layout={layout}
      onPathChanged={props.onPathChanged}
      onSkipAnswerSeen={props.onSkipAnswerSeen}
      continueLabel={next.label}
      onContinue={next.run}
    />
  );
}
