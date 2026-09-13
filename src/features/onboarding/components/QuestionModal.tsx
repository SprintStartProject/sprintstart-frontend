// ============================================================
// QuestionModal.tsx
// ============================================================
// Modal for answering a single knowledge-check question. Shows
// the question, lets the user answer, submits the attempt and
// displays the graded result — a wrong answer is simply offered
// again, a correct one marks the question passed.
// ============================================================

import { useState } from "react";
import { onboardingService } from "../../../services/onboardingService";
import { useToast } from "../../../context/useToast";
import { Modal } from "../../../components/ui/Modal";
import type { OnboardingQuestionEndpoint, QuestionAttemptResult } from "../types";
import { CheckQuestionCard } from "./CheckQuestionCard";
import { emptyDraft, isAnswered, toSubmission, type DraftAnswer } from "../checkAnswers";
import { ConfettiBurst } from "./ConfettiBurst";
import { Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";

interface QuestionModalProps {
  question: OnboardingQuestionEndpoint;
  phaseTitle: string;
  /**
   * Called when the modal closes.
   * - `answered`: true when an attempt was submitted, so the parent can refetch the
   *   path (lock states and question statuses may have changed).
   * - `correct`: true when the last attempt was correct.
   * - `onboardingCompleted`: true when this attempt finished the whole journey.
   */
  onClose: (result: { answered: boolean; correct: boolean; onboardingCompleted: boolean }) => void;
}

/** The one thing worth saying under a correctly answered question. */
function passDetail(result: QuestionAttemptResult): string | undefined {
  if (result.onboardingCompleted) return "You have finished your onboarding!";
  return undefined;
}

export function QuestionModal({ question, phaseTitle, onClose }: QuestionModalProps) {
  const [draft, setDraft] = useState<DraftAnswer>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuestionAttemptResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const toast = useToast();

  const toggleOption = (optionId: string) => {
    const selected = draft.selectedOptionIds.includes(optionId)
      ? draft.selectedOptionIds.filter((id) => id !== optionId)
      : [...draft.selectedOptionIds, optionId];
    setDraft({ ...draft, selectedOptionIds: selected });
  };

  const setTextAnswer = (text: string) => {
    setDraft({ ...draft, textAnswer: text });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const attemptResult = await onboardingService.submitQuestionAttempt(
        question.id,
        toSubmission(question, draft),
      );
      setResult(attemptResult);
      setHasSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit the answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setDraft(emptyDraft);
    setResult(null);
  };

  const answered = isAnswered(question, draft);

  const close = () =>
    onClose({
      answered: hasSubmitted,
      correct: result?.correct ?? false,
      onboardingCompleted: result?.onboardingCompleted ?? false,
    });

  const footer = result ? (
    <>
      {!result.correct && (
        <button
          onClick={retry}
          className="flex items-center justify-center gap-2 rounded-xl border border-app-border px-5 py-2.5 text-sm font-medium text-app-text-muted transition-all hover:border-app-border-strong hover:text-app-text"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      )}
      <button
        onClick={close}
        className="rounded-xl bg-app-brand px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-brand-hover"
      >
        Done
      </button>
    </>
  ) : (
    <button
      onClick={() => void submit()}
      disabled={!answered || submitting}
      className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
      Submit answer
    </button>
  );

  return (
    <Modal
      isOpen
      title="Knowledge question"
      description={phaseTitle}
      size="md"
      bodyClassName="max-h-[60vh] overflow-y-auto px-7 py-6"
      onClose={close}
      footer={footer}
    >
      {/* Fires once when the answer turns out to be correct */}
      {result?.correct && <ConfettiBurst />}

      {/* Result banner: a celebratory one on pass, a plain one otherwise */}
      {result?.correct && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-app-success-solid/30 bg-app-success-bg p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-success-solid/15">
            <Trophy className="h-6 w-6 text-app-success-solid" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-app-text">Correct — nice work!</div>
            <div className="mt-0.5 text-xs text-app-text-muted">{passDetail(result)}</div>
          </div>
        </div>
      )}
      {result && !result.correct && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-app-danger-solid/30 bg-app-surface-muted p-4">
          <XCircle className="h-6 w-6 shrink-0 text-app-danger-solid" />
          <div>
            <div className="text-sm font-semibold text-app-text">Not correct yet</div>
            <div className="mt-0.5 text-xs text-app-text-muted">
              Review the answer below and try again.
            </div>
          </div>
        </div>
      )}

      <CheckQuestionCard
        question={question}
        index={0}
        draft={draft}
        result={result}
        onToggleOption={toggleOption}
        onTextChange={setTextAnswer}
      />
    </Modal>
  );
}
