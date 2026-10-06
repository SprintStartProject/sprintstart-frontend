// ============================================================
// CheckQuestionCard.tsx
// ============================================================
// Renders a single knowledge-check question in both of its
// states: fillable while unanswered, and graded once an attempt
// result exists. Used inside the per-question answer modal.
// ============================================================

import type { OnboardingQuestionEndpoint, QuestionAttemptResult } from "../types";
import type { DraftAnswer } from "../checkAnswers";
import { shuffleOptions } from "../questionIntegrity";
import { CheckCircle2, CircleCheck, CircleX, TriangleAlert, XCircle } from "lucide-react";
import { useMemo } from "react";

interface CheckQuestionCardProps {
  question: OnboardingQuestionEndpoint;
  index: number;
  draft: DraftAnswer;
  /** Grading result for this question; null while it has not been submitted. */
  result: QuestionAttemptResult | null;
  onToggleOption: (optionId: string) => void;
  onTextChange: (text: string) => void;
  /** Seeds the order the options are shown in; defaults to the question's id. */
  optionOrderSeed?: string;
  /**
   * Called with text pasted into the short-text answer; returning false keeps it out. Used to keep
   * a revealed sample answer from simply being pasted back.
   */
  onTextPaste?: (text: string) => boolean;
  /** Shown under the short-text answer, e.g. why a pasted answer was not taken. */
  textWarning?: string | null;
}

export function CheckQuestionCard({
  question,
  index,
  draft,
  result,
  onToggleOption,
  onTextChange,
  optionOrderSeed,
  onTextPaste,
  textWarning,
}: CheckQuestionCardProps) {
  const graded = result !== null;
  const options = useMemo(
    () => shuffleOptions(question.options ?? [], optionOrderSeed ?? question.id),
    [question.options, question.id, optionOrderSeed],
  );

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
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-xs font-bold text-app-brand">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-app-text">{question.question}</h3>
            {graded &&
              (result.correct ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-app-success-solid" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-app-danger-solid" />
              ))}
          </div>

          {/* Multiple choice options */}
          {question.type === "MULTIPLE_CHOICE" && (
            <div className="mt-3 space-y-2">
              {options.map((option) => {
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
                          ? "cursor-pointer border-app-brand bg-app-brand-soft text-app-text"
                          : "cursor-pointer border-app-border text-app-text hover:border-app-border-strong"
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
                    {/* Beside the green and red tint, because the tint alone is the only thing that
                        says which row is right and which was picked wrong (WCAG 1.4.1). */}
                    {isCorrectOption ? (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <CircleCheck className="h-4 w-4" aria-hidden="true" />
                        Correct answer
                      </span>
                    ) : graded && selected ? (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-app-danger-text">
                        <CircleX className="h-4 w-4" aria-hidden="true" />
                        Your pick
                      </span>
                    ) : null}
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
                onPaste={(event) => {
                  if (onTextPaste && !onTextPaste(event.clipboardData.getData("text"))) {
                    event.preventDefault();
                  }
                }}
                aria-describedby={textWarning ? `${question.id}-text-warning` : undefined}
                placeholder="Your answer..."
                className="w-full rounded-xl border border-app-border bg-app-bg px-4 py-2.5 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-brand disabled:opacity-70"
              />
              {textWarning && !graded && (
                <p
                  id={`${question.id}-text-warning`}
                  role="alert"
                  className="mt-2 flex items-start gap-1.5 text-xs font-medium text-app-danger-text"
                >
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {textWarning}
                </p>
              )}
              {/* AI feedback on the free-text answer (both correct and incorrect) */}
              {graded && result.feedback && (
                <p
                  className={`mt-2 text-xs text-app-text-muted ${result.correct ? "" : "select-none"}`}
                >
                  {result.feedback}
                </p>
              )}
              {graded && !result.correct && result.correctAnswer && (
                <p className="mt-2 text-xs text-app-text-muted">
                  Sample answer:{" "}
                  {/* Not selectable, like the feedback and explanation of a wrong answer: they are
                      there to be read and understood, not copied back. */}
                  <span className="font-medium text-app-success-text select-none">
                    {result.correctAnswer}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Explanation after grading */}
          {graded && result.explanation && (
            <p
              className={`mt-3 rounded-xl bg-app-surface-muted px-3 py-2 text-xs text-app-text-muted ${
                question.type === "SHORT_TEXT" && !result.correct ? "select-none" : ""
              }`}
            >
              {result.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
