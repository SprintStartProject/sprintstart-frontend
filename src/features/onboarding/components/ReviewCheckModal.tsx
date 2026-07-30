// ============================================================
// ReviewCheckModal.tsx
// ============================================================
// Modal for working through the review pool: the questions the
// user got wrong in earlier phases. Unlike a phase check there
// is no pass threshold — every correct answer clears a question
// for good, wrong ones stay for another try — and clearing the
// last one can finish the whole onboarding journey.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { onboardingService } from "../../../services/onboardingService";
import { Modal } from "../../../components/ui/Modal";
import type {
  ReviewCheckEndpoint,
  ReviewCheckResult,
  PhaseCheckAnswerSubmission,
  PhaseCheckAnswerResult,
} from "../types";
import { CheckQuestionCard } from "./CheckQuestionCard";
import { emptyDraft, isAnswered, toSubmission, type DraftAnswer } from "../checkAnswers";
import { CheckPassCelebration } from "./CheckPassCelebration";
import { ConfettiBurst } from "./ConfettiBurst";
import { Loader2, AlertCircle, PartyPopper, RotateCcw } from "lucide-react";

interface ReviewCheckModalProps {
  /**
   * Called when the modal closes.
   * - `answeredAny`: true when answers were submitted, so the parent can refetch the
   *   pool count and the path.
   * - `onboardingCompleted`: true when clearing the pool finished the whole journey.
   */
  onClose: (result: { answeredAny: boolean; onboardingCompleted: boolean }) => void;
}

export function ReviewCheckModal({ onClose }: ReviewCheckModalProps) {
  const [pool, setPool] = useState<ReviewCheckEndpoint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewCheckResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Anchor at the very top of the scrollable modal body. After grading, the user is
  // usually scrolled down at the last question and would never see the result banner.
  const topRef = useRef<HTMLDivElement>(null);

  /**
   * Brings the result banner into view, once the graded DOM is committed.
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
    if (!result) return;
    topRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [result]);

  useEffect(() => {
    const loadPool = async () => {
      try {
        setPool(await onboardingService.fetchReviewCheck());
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void loadPool();
  }, []);

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

  // Partial submissions are allowed, so any single answered question is enough.
  const answeredQuestions =
    pool?.questions.filter((question) => isAnswered(question, getDraft(question.id))) ?? [];

  const submit = async () => {
    if (answeredQuestions.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: PhaseCheckAnswerSubmission[] = answeredQuestions.map((question) =>
        toSubmission(question, getDraft(question.id)),
      );
      setResult(await onboardingService.submitReviewCheck(payload));
      setHasSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Loads whatever is still open after a graded round, so the user can keep going
   * without reopening the modal. Cleared answers disappear, wrong ones come back blank.
   */
  const continueWithRemaining = async () => {
    setResult(null);
    setAnswers({});
    setSubmitError(null);
    setPool(null);
    try {
      setPool(await onboardingService.fetchReviewCheck());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const resultFor = (questionId: string): PhaseCheckAnswerResult | null =>
    result?.results.find((entry) => entry.questionId === questionId) ?? null;

  const close = () =>
    onClose({
      answeredAny: hasSubmitted,
      onboardingCompleted: result?.onboardingCompleted ?? false,
    });

  // Only the questions of this round stay visible after grading, so the result reads
  // as a summary of what was just answered rather than a half-graded list.
  const visibleQuestions = result
    ? (pool?.questions.filter((question) => resultFor(question.id) !== null) ?? [])
    : (pool?.questions ?? []);

  const poolCleared = result !== null && result.remainingCount === 0;

  const footer = pool ? (
    result ? (
      <>
        {!poolCleared && (
          <button
            onClick={() => void continueWithRemaining()}
            className="px-5 py-2.5 rounded-xl border border-app-border hover:border-app-border-strong text-app-text-muted hover:text-app-text text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Keep going
          </button>
        )}
        <button
          onClick={close}
          className="px-6 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
        >
          Done
        </button>
      </>
    ) : pool.questions.length > 0 ? (
      <button
        onClick={() => void submit()}
        disabled={answeredQuestions.length === 0 || submitting}
        className="px-6 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit answers
      </button>
    ) : undefined
  ) : undefined;

  return (
    <Modal
      isOpen
      title="Review check"
      description="Questions you did not get right yet"
      size="lg"
      bodyClassName="max-h-[60vh] overflow-y-auto px-7 py-6"
      onClose={close}
      footer={footer}
    >
      <div ref={topRef} />

      {/* Fires once when the last open question is cleared, and cleans itself up */}
      {poolCleared && <ConfettiBurst />}

      {/* Loading / load error */}
      {!pool && !loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-app-text-muted">
          <Loader2 className="w-6 h-6 animate-spin text-app-brand" />
          <p className="text-sm">Loading review questions...</p>
        </div>
      )}
      {loadError && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="w-8 h-8 text-app-danger-solid" />
          <p className="text-sm text-app-text-muted">{loadError}</p>
        </div>
      )}

      {/* Nothing left to review */}
      {pool && pool.questions.length === 0 && !result && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <PartyPopper className="w-8 h-8 text-app-success-solid" />
          <p className="font-semibold text-app-text text-sm">Nothing to review</p>
          <p className="text-sm text-app-text-muted">
            You have answered every question correctly so far. Anything you miss in a
            knowledge check will show up here.
          </p>
        </div>
      )}

      {/* Result banner */}
      {result && poolCleared && (
        <CheckPassCelebration
          correctCount={result.correctCount}
          questionCount={result.answeredCount}
          detail={
            result.onboardingCompleted
              ? "That was the last open question — you have finished your onboarding!"
              : "Your review list is empty."
          }
        />
      )}
      {result && !poolCleared && (
        <div className="mb-6 rounded-2xl border border-app-border bg-app-surface-muted p-4 flex items-center gap-3">
          <RotateCcw className="w-6 h-6 shrink-0 text-app-text-muted" />
          <div>
            <div className="font-semibold text-app-text text-sm">
              {result.correctCount} of {result.answeredCount} correct
            </div>
            <div className="text-xs text-app-text-muted mt-0.5">
              {result.remainingCount === 1
                ? "1 question is still on your review list."
                : `${result.remainingCount} questions are still on your review list.`}{" "}
              Wrong answers stay until you get them right.
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      {visibleQuestions.length > 0 && (
        <div className="space-y-6">
          {visibleQuestions.map((question, index) => (
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
