import { phaseItems, type PhaseItem } from "./journey";
import { resolveNextAction } from "./nextAction";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../../services/onboardingTypes";

/** What "continue" says and does once an item in a phase is behind the member. */
export type ContinueStep =
  | { kind: "item"; label: string; item: PhaseItem | undefined }
  | { kind: "choose"; label: string }
  | { kind: "back"; label: string };

function labelForNext(
  next: { kind: "step" | "question"; phase: OnboardingPhaseEndpoint },
  phaseId: string,
): string {
  if (next.phase.id !== phaseId) return `On to ${next.phase.title}`;
  return next.kind === "question" ? "Next: a question" : "Next step";
}

/**
 * Where "continue" leads from a phase: the next item (in this phase if there is one, else the phase
 * that is up next), the chooser when finishing opened several phases at once, or back to the path.
 */
export function continueAfter(path: OnboardingPathEndpoint | null, phaseId: string): ContinueStep {
  const next = path ? resolveNextAction(path, { preferPhaseId: phaseId }) : null;
  if (next?.kind === "step" || next?.kind === "question") {
    const nextId = next.kind === "step" ? next.step.id : next.question.id;
    return {
      kind: "item",
      label: labelForNext(next, phaseId),
      item: phaseItems(next.phase).find((candidate) => candidate.id === nextId),
    };
  }
  if (next?.kind === "choose") return { kind: "choose", label: "Choose your next phase" };
  return { kind: "back", label: "Back to your path" };
}

export type Celebration =
  /** The answer finished the whole onboarding. */
  | { kind: "mission" }
  /** The answer finished its phase. */
  | {
      kind: "phase";
      moment: {
        tone: "milestone";
        title: string;
        message: string;
        progress: { current: number; total: number };
      };
    };

/**
 * What an answer is worth a celebration of. The backend decides completion; nothing here is derived
 * from the phase alone. A phase is celebrated, not a question: only when this answer finished its
 * last open item.
 */
export function celebrationAfter(
  question: OnboardingQuestionEndpoint,
  result: QuestionAttemptResult,
  phases: OnboardingPhaseEndpoint[],
  phasesDone: number,
): Celebration | null {
  if (result.onboardingCompleted) return { kind: "mission" };
  if (!result.correct) return null;

  const phase = phases.find((candidate) => candidate.id === question.phaseId);
  if (!phase) return null;
  const allStepsDone = phase.steps.every(
    (step) => step.status === "FINISHED" || step.status === "SKIPPED",
  );
  const allQuestionsPassed = phase.questions.every(
    (candidate) => candidate.status === "PASSED" || candidate.id === question.id,
  );
  if (!allStepsDone || !allQuestionsPassed) return null;

  return {
    kind: "phase",
    moment: {
      tone: "milestone",
      title: "Phase completed",
      message: `You completed the ${phase.title} phase.`,
      progress: { current: Math.min(phasesDone + 1, phases.length), total: phases.length },
    },
  };
}
