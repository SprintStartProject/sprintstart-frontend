// ============================================================
// PhaseCheckModal.tsx
// ============================================================
// Modal for taking a phase-level knowledge check: loads the
// questions (without correct answers), lets the user answer
// them, submits the attempt and shows the graded result.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { onboardingService } from "../../../services/onboardingService";
import { Modal } from "../../../components/ui/Modal";
import type {
  PhaseCheckEndpoint,
  PhaseCheckAnswerSubmission,
  PhaseCheckAttemptResult,
  PhaseCheckAnswerResult,
} from "../types";
import { CheckQuestionCard } from "./CheckQuestionCard";
import { emptyDraft, isAnswered, toSubmission, type DraftAnswer } from "../checkAnswers";
import { CheckPassCelebration } from "./CheckPassCelebration";
import { ConfettiBurst } from "./ConfettiBurst";
import { Loader2, AlertCircle, XCircle, RotateCcw } from "lucide-react";

interface PhaseCheckModalProps {
  phaseId: string;
  phaseTitle: string;
  /**
   * Called when the modal closes.
   * - `submittedAttempt`: true when at least one attempt was submitted while the
   *   modal was open, so the parent can refetch the path (lock states and check
   *   summaries may have changed).
   * - `passed`: true when the check is now passed.
   * - `onboardingCompleted`: true when this attempt finished the whole journey.
   *   Reported by the backend rather than derived from "was this the last phase?",
   *   because open review questions keep onboarding running past the final check.
   */
  onClose: (result: {
    submittedAttempt: boolean;
    passed: boolean;
    onboardingCompleted: boolean;
  }) => void;
}

/**
 * The one thing worth saying under a passed check, most actionable first: questions
 * the user still owes beat an unlocked phase, since those now gate finishing onboarding.
 */
function passDetail(result: PhaseCheckAttemptResult): string | undefined {
  if (result.onboardingCompleted) return "You have finished your onboarding!";
  if (result.openReviewCount > 0) {
    return result.openReviewCount === 1
      ? "1 question is waiting in your review check."
      : `${result.openReviewCount} questions are waiting in your review check.`;
  }
  if (result.nextPhaseUnlocked) return "The next phase is now unlocked.";
  return undefined;
}

export function PhaseCheckModal({ phaseId, phaseTitle, onClose }: PhaseCheckModalProps) {
  const [check, setCheck] = useState<PhaseCheckEndpoint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PhaseCheckAttemptResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Anchor at the very top of the scrollable modal body. After grading, the user is
  // usually scrolled down at the last question and would never see the result banner.
  const topRef = useRef<HTMLDivElement>(null);

  // Skips the initial render, where there is nothing to scroll away from yet.
  const hasResultSettledRef = useRef(false);

  /**
   * Scrolls back to the top whenever the result appears or is cleared: to the banner after
   * grading, and to question 1 after "Try again".
   *
   * Deliberately an effect rather than a call at the end of `submit`: grading replaces
   * every question card with its longer graded form, which grows the content above the
   * user's scroll position. Scrolling before that commit starts the smooth scroll against
   * the old layout, and the browser's scroll anchoring then corrects `scrollTop` to keep
   * the view stable — which cancels the animation mid-flight. Running after the commit
   * means the scroll starts from the final layout and nothing mutates underneath it.
   *
   * The optional call is for jsdom, which has no `scrollIntoView`.
   */
  useEffect(() => {
    if (!hasResultSettledRef.current) {
      hasResultSettledRef.current = true;
      return;
    }
    topRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [result]);

  useEffect(() => {
    const loadCheck = async () => {
      try {
        const data = await onboardingService.fetchPhaseCheck(phaseId);
        setCheck(data);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void loadCheck();
  }, [phaseId]);

  const getDraft = (questionId: string): DraftAnswer => answers[questionId] ?? emptyDraft;

  const toggleOption = (questionId: string, optionId: string) => {
    const draft = getDraft(questionId);
    const selected = draft.selectedOptionIds.includes(optionId)
      ? draft.selectedOptionIds.filter((id) => id !== optionId)
      : [...draft.selectedOptionIds, optionId];
    setAnswers({ ...answers, [questionId]: { ...draft, selectedOptionIds: selected } });
  };

  const setTextAnswer = (questionId: string, text: string) => {
    setAnswers({ ...answers, [questionId]: { ...getDraft(questionId), textAnswer: text } });
  };

  const allAnswered =
    check?.questions.every((question) => isAnswered(question, getDraft(question.id))) ?? false;

  const submit = async () => {
    if (!check) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: PhaseCheckAnswerSubmission[] = check.questions.map((question) =>
        toSubmission(question, getDraft(question.id)),
      );
      const attemptResult = await onboardingService.submitPhaseCheck(check.phaseId, payload);
      setResult(attemptResult);
      setHasSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  };

  const resultFor = (questionId: string): PhaseCheckAnswerResult | null =>
    result?.results.find((entry) => entry.questionId === questionId) ?? null;

  const close = () =>
    onClose({
      submittedAttempt: hasSubmitted,
      passed: result?.passed ?? false,
      onboardingCompleted: result?.onboardingCompleted ?? false,
    });

  const footer =
    check && check.questions.length > 0 ? (
      result ? (
        <>
          {!result.passed && (
            <button
              onClick={retry}
              className="px-5 py-2.5 rounded-xl border border-app-border hover:border-app-border-strong text-app-text-muted hover:text-app-text text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
          )}
          <button
            onClick={close}
            className="px-6 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
          >
            Done
          </button>
        </>
      ) : (
        <button
          onClick={() => void submit()}
          disabled={!allAnswered || submitting}
          className="px-6 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit answers
        </button>
      )
    ) : undefined;

  return (
    <Modal
      isOpen
      title="Knowledge check"
      description={phaseTitle}
      size="lg"
      bodyClassName="max-h-[60vh] overflow-y-auto px-7 py-6"
      onClose={close}
      footer={footer}
    >
      <div ref={topRef} />

      {/* Fires once when the result turns out to be a pass, and cleans itself up */}
      {result?.passed && <ConfettiBurst />}

      {/* Loading / load error */}
      {!check && !loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-app-text-muted">
          <Loader2 className="w-6 h-6 animate-spin text-app-brand" />
          <p className="text-sm">Loading knowledge check...</p>
        </div>
      )}
      {loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="w-8 h-8 text-app-danger-solid" />
          <p className="text-sm text-app-text-muted">{loadError}</p>
        </div>
      )}

      {/* Result banner: a celebratory one on pass, a plain one otherwise */}
      {result?.passed && (
        <CheckPassCelebration
          correctCount={result.correctCount}
          questionCount={result.questionCount}
          detail={passDetail(result)}
        />
      )}
      {result && !result.passed && (
        <div className="mb-6 rounded-2xl border border-app-danger-solid/30 bg-app-surface-muted p-4 flex items-center gap-3">
          <XCircle className="w-6 h-6 shrink-0 text-app-danger-solid" />
          <div>
            <div className="font-semibold text-app-text text-sm">Not passed yet</div>
            <div className="text-xs text-app-text-muted mt-0.5">
              {result.correctCount}/{result.questionCount} correct (
              {Math.round((result.correctCount / Math.max(result.questionCount, 1)) * 100)}% ·{" "}
              {result.requiredPercent}% required). Review the answers below and try again.
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      {check && (
        <div className="space-y-6">
          {check.questions.map((question, index) => (
            <CheckQuestionCard
              key={question.id}
              question={question}
              index={index}
              draft={getDraft(question.id)}
              result={resultFor(question.id)}
              onToggleOption={(optionId) => toggleOption(question.id, optionId)}
              onTextChange={(text) => setTextAnswer(question.id, text)}
            />
          ))}
        </div>
      )}

      {submitError && (
        <p className="mt-4 text-sm text-app-danger-solid flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </p>
      )}
    </Modal>
  );
}
