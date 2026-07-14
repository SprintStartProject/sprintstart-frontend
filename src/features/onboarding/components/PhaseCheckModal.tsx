// ============================================================
// PhaseCheckModal.tsx
// ============================================================
// Modal for taking a phase-level knowledge check: loads the
// questions (without correct answers), lets the user answer
// them, submits the attempt and shows the graded result.
// ============================================================

import { useState, useEffect } from "react";
import { onboardingService } from "../../../services/onboardingService";
import { Modal } from "../../../components/ui/Modal";
import type {
  PhaseCheckEndpoint,
  PhaseCheckQuestionEndpoint,
  PhaseCheckAnswerSubmission,
  PhaseCheckAttemptResult,
  PhaseCheckAnswerResult,
} from "../types";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

interface PhaseCheckModalProps {
  phaseId: string;
  phaseTitle: string;
  /**
   * Called when the modal closes.
   * - `submittedAttempt`: true when at least one attempt was submitted while the
   *   modal was open, so the parent can refetch the path (lock states and check
   *   summaries may have changed).
   * - `passed`: true when the check is now passed — lets the parent celebrate
   *   passing the final phase's check.
   */
  onClose: (result: { submittedAttempt: boolean; passed: boolean }) => void;
}

/** Answers keyed by question id while the user fills in the check. */
interface DraftAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
}

export function PhaseCheckModal({ phaseId, phaseTitle, onClose }: PhaseCheckModalProps) {
  const [check, setCheck] = useState<PhaseCheckEndpoint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PhaseCheckAttemptResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

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

  const getDraft = (questionId: string): DraftAnswer =>
    answers[questionId] ?? { selectedOptionIds: [], textAnswer: "" };

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
    check?.questions.every((question) => {
      const draft = getDraft(question.id);
      return question.type === "MULTIPLE_CHOICE"
        ? draft.selectedOptionIds.length > 0
        : draft.textAnswer.trim().length > 0;
    }) ?? false;

  const submit = async () => {
    if (!check) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: PhaseCheckAnswerSubmission[] = check.questions.map((question) => {
        const draft = getDraft(question.id);
        return question.type === "MULTIPLE_CHOICE"
          ? { questionId: question.id, selectedOptionIds: draft.selectedOptionIds }
          : { questionId: question.id, textAnswer: draft.textAnswer.trim() };
      });
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

  const close = () => onClose({ submittedAttempt: hasSubmitted, passed: result?.passed ?? false });

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

      {/* Result banner */}
      {result && (
        <div
          className={`mb-6 rounded-2xl border p-4 flex items-center gap-3 ${
            result.passed
              ? "border-app-success-solid/30 bg-app-success-bg"
              : "border-app-danger-solid/30 bg-app-surface-muted"
          }`}
        >
          {result.passed ? (
            <CheckCircle2 className="w-6 h-6 shrink-0 text-app-success-solid" />
          ) : (
            <XCircle className="w-6 h-6 shrink-0 text-app-danger-solid" />
          )}
          <div>
            <div className="font-semibold text-app-text text-sm">
              {result.passed ? "Check passed!" : "Not passed yet"}
            </div>
            <div className="text-xs text-app-text-muted mt-0.5">
              {result.correctCount}/{result.questionCount} correct (
              {Math.round((result.correctCount / Math.max(result.questionCount, 1)) * 100)}% ·{" "}
              {result.requiredPercent}% required).
              {result.passed && result.nextPhaseUnlocked && " The next phase is now unlocked."}
              {!result.passed && " Review the answers below and try again."}
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      {check && (
        <div className="space-y-6">
          {check.questions.map((question, index) => (
            <QuestionCard
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

// ─────────────────────────────────────────────────────────────
// HELPER COMPONENT: QuestionCard
// ─────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: PhaseCheckQuestionEndpoint;
  index: number;
  draft: DraftAnswer;
  /** Grading result for this question; null while the check has not been submitted. */
  result: PhaseCheckAnswerResult | null;
  onToggleOption: (optionId: string) => void;
  onTextChange: (text: string) => void;
}

function QuestionCard({ question, index, draft, result, onToggleOption, onTextChange }: QuestionCardProps) {
  const graded = result !== null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        !graded
          ? "border-app-border"
          : result.correct
            ? "border-app-success-solid/40"
            : "border-app-danger-solid/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-app-brand text-xs font-bold mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          {/* Carried-over repeat question from an earlier phase */}
          {question.review && (
            <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded-full bg-app-surface-muted text-app-text-muted text-[11px] font-medium">
              <RotateCcw className="w-3 h-3" />
              {question.reviewSourcePhaseTitle
                ? `Repeat from ${question.reviewSourcePhaseTitle}`
                : "Repeat question"}
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-app-text text-sm">{question.question}</h3>
            {graded &&
              (result.correct ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-app-success-solid" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 text-app-danger-solid" />
              ))}
          </div>

          {/* Multiple choice options */}
          {question.type === "MULTIPLE_CHOICE" && (
            <div className="mt-3 space-y-2">
              {(question.options ?? []).map((option) => {
                const selected = draft.selectedOptionIds.includes(option.id);
                const isCorrectOption = graded && result.correctOptionIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                      graded
                        ? isCorrectOption
                          ? "border-app-success-solid/50 bg-app-success-bg text-app-success-text"
                          : selected
                            ? "border-app-danger-solid/50 text-app-text"
                            : "border-app-border text-app-text-muted"
                        : selected
                          ? "border-app-brand bg-app-brand-soft text-app-text cursor-pointer"
                          : "border-app-border text-app-text hover:border-app-border-strong cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={graded}
                      onChange={() => onToggleOption(option.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Short text answer */}
          {question.type === "SHORT_TEXT" && (
            <div className="mt-3">
              <input
                type="text"
                value={draft.textAnswer}
                disabled={graded}
                onChange={(event) => onTextChange(event.target.value)}
                placeholder="Your answer..."
                className="w-full rounded-xl border border-app-border bg-app-bg px-4 py-2.5 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-brand focus:outline-none disabled:opacity-70"
              />
              {/* AI feedback on the free-text answer (both correct and incorrect) */}
              {graded && result.feedback && (
                <p className="mt-2 text-xs text-app-text-muted">{result.feedback}</p>
              )}
              {graded && !result.correct && result.correctAnswer && (
                <p className="mt-2 text-xs text-app-text-muted">
                  Sample answer:{" "}
                  <span className="font-medium text-app-success-text">{result.correctAnswer}</span>
                </p>
              )}
            </div>
          )}

          {/* Explanation after grading */}
          {graded && result.explanation && (
            <p className="mt-3 text-xs text-app-text-muted rounded-xl bg-app-surface-muted px-3 py-2">
              {result.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
