import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useToast } from "../../../context/useToast";
import { onboardingService } from "../../../services/onboardingService";
import { isSkipPending, type PhaseItem } from "../journey";
import { celebrationAfter } from "../pageRules";
import { notifySkipAnswerSeen, withSkipAnswerSeen, withSkipAnswerUnseen } from "../skipAnswers";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../../../services/onboardingTypes";

/** The celebratory layer, handed in because it is another feature's. */
export type Moments = {
  celebrate: (moment: {
    tone: "milestone";
    title: string;
    message: string;
    progress: { current: number; total: number };
  }) => void;
  completeMission: () => void;
  /** The rocket that marks a step beginning. */
  flyby: () => void;
};

type Params = {
  phases: OnboardingPhaseEndpoint[];
  phasesDone: number;
  setPath: Dispatch<SetStateAction<OnboardingPathEndpoint | null>>;
  refreshPath: () => Promise<void>;
  moments: Moments;
};

export type StartOptions = { byAddress?: boolean };

/**
 * What the member does to the path from an item: start a step, see an answer to a skip request,
 * answer a question.
 */
export function useStepActions({ phases, phasesDone, setPath, refreshPath, moments }: Params) {
  const toast = useToast();
  const { celebrate, completeMission, flyby } = moments;

  /** A step the member opens for the first time is started; reopening one changes nothing. */
  const beginStepIfWaiting = async (item: PhaseItem, { byAddress = false }: StartOptions = {}) => {
    if (item.kind !== "step" || item.step.status !== "WAITING" || item.step.locked) return;
    // Arriving at `/onboarding/<id>` for a step with a skip request open is arriving to change or
    // withdraw it, not to begin the step; its own "Start step" button still does that. Only the
    // address: the list's button says "Start", and a click on it should do what it says.
    if (byAddress && isSkipPending(item.step.skip)) return;
    try {
      await onboardingService.startStep(item.step.id);
      flyby();
      await refreshPath();
    } catch (error) {
      console.error("Failed to start onboarding step:", error);
      toast.error("The step could not be started", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  /**
   * The answer to a skip request has been drawn for the member, so its "new" marker goes -- here
   * and, so it stays gone on every device, on the server.
   *
   * Called by the step workspace once it has the answer on screen. Doing it from `openItem` marked
   * answers seen on the way past: "Continue" and "Up next" open steps too, and a deep link opens one
   * without going through it at all.
   */
  const acknowledgeSkipAnswer = useCallback(
    (skipId: string) => {
      const seenAt = new Date().toISOString();
      setPath((current) => (current ? withSkipAnswerSeen(current, skipId, seenAt) : current));
      onboardingService
        .markSkipAnswerSeen(skipId)
        .then(notifySkipAnswerSeen)
        .catch((error: unknown) => {
          console.error("Failed to mark skip answer as seen:", error);
          // Put back, rather than left gone for the session and back after a reload -- and
          // disagreeing with the sidebar's count in the meantime.
          setPath((current) => (current ? withSkipAnswerUnseen(current, skipId) : current));
          toast.error("The answer is still marked new", {
            description: "It could not be marked as seen. It will still be there next time.",
          });
        });
    },
    [setPath, toast],
  );

  const handleAnswered = async (
    question: OnboardingQuestionEndpoint,
    result: QuestionAttemptResult,
  ) => {
    const celebration = celebrationAfter(question, result, phases, phasesDone);
    if (celebration?.kind === "mission") completeMission();
    if (celebration?.kind === "phase") celebrate(celebration.moment);
    await refreshPath();
  };

  return { beginStepIfWaiting, acknowledgeSkipAnswer, handleAnswered };
}
