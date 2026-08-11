// ============================================================
// CheckQuestionCard.tsx
// ============================================================
// Renders a single knowledge-check question in both of its
// states: fillable while unanswered, and graded once a result
// exists. Shared by the phase check and the review check so
// questions look and behave identically in both.
// ============================================================

import type { PhaseCheckQuestionEndpoint, PhaseCheckAnswerResult } from "../types";
import type { DraftAnswer } from "../checkAnswers";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface CheckQuestionCardProps {
  question: PhaseCheckQuestionEndpoint;
  index: number;
  draft: DraftAnswer;
  /** Grading result for this question; null while the question has not been submitted. */
  result: PhaseCheckAnswerResult | null;
  /** Hides the "from <phase>" badge where every question is a review question anyway. */
  hideReviewBadge?: boolean;
  onToggleOption: (optionId: string) => void;
  onTextChange: (text: string) => void;
}

export function CheckQuestionCard({
  question,
  index,
  draft,
  result,
  hideReviewBadge = false,
  onToggleOption,
  onTextChange,
}: CheckQuestionCardProps) {
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
          {/* Where a review-pool question originally came from */}
          {question.review && !hideReviewBadge && (
            <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded-full bg-app-surface-muted text-app-text-muted text-[11px] font-medium">
              <RotateCcw className="w-3 h-3" />
              {question.reviewSourcePhaseTitle
                ? `From ${question.reviewSourcePhaseTitle}`
                : "Review question"}
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
