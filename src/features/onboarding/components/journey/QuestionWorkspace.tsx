import { ChevronRight, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { useToast } from "../../../../context/useToast";
import { onboardingService } from "../../../../services/onboardingService";
import { emptyDraft, isAnswered, toSubmission, type DraftAnswer } from "../../checkAnswers";
import type { OnboardingQuestionEndpoint, QuestionAttemptResult } from "../../types";
import { CheckQuestionCard } from "../CheckQuestionCard";
import { ConfettiBurst } from "../ConfettiBurst";

type Props = {
  question: OnboardingQuestionEndpoint;
  /** After a graded attempt; `correct` and `onboardingCompleted` come from the backend. */
  onAnswered: (result: QuestionAttemptResult) => Promise<void> | void;
  continueLabel: string;
  onContinue: () => void;
};

/**
 * A knowledge question, answered where it is -- inside its list row, or zoomed into on the graph.
 *
 * The same grading as before, without the dialog: a wrong answer is offered again right there, and a
 * correct one moves on the way a finished step does.
 */
export function QuestionWorkspace({ question, onAnswered, continueLabel, onContinue }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<DraftAnswer>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuestionAttemptResult | null>(null);
  const alreadyPassed = question.status === "PASSED" && !result;

  const submit = async () => {
    setSubmitting(true);
    try {
      const attempt = await onboardingService.submitQuestionAttempt(
        question.id,
        toSubmission(question, draft),
      );
      setResult(attempt);
      await onAnswered(attempt);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't submit the answer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyPassed) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-app-success-text">
          <Trophy className="h-4 w-4" aria-hidden="true" />
          You answered this one correctly.
        </span>
        <Button
          variant="primary"
          onClick={onContinue}
          trailingIcon={<ChevronRight className="h-4 w-4" />}
        >
          {continueLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result?.correct ? <ConfettiBurst /> : null}
      {result?.correct ? (
        <div className="flex items-center gap-3 rounded-2xl border border-app-success-solid/30 bg-app-success-bg p-3">
          <Trophy className="h-5 w-5 shrink-0 text-app-success-solid" aria-hidden="true" />
          <p className="text-sm font-semibold text-app-text">
            Correct — nice work!
            {result.onboardingCompleted ? (
              <span className="block text-xs font-normal text-app-text-muted">
                You have finished your onboarding!
              </span>
            ) : null}
          </p>
        </div>
      ) : result ? (
        <div className="flex items-center gap-3 rounded-2xl border border-app-danger-solid/30 bg-app-surface-muted p-3">
          <XCircle className="h-5 w-5 shrink-0 text-app-danger-solid" aria-hidden="true" />
          <p className="text-sm font-semibold text-app-text">
            Not correct yet
            <span className="block text-xs font-normal text-app-text-muted">
              Look at the answer below and try again.
            </span>
          </p>
        </div>
      ) : null}

      <CheckQuestionCard
        question={question}
        index={0}
        draft={draft}
        result={result}
        onToggleOption={(optionId) =>
          setDraft((current) => ({
            ...current,
            selectedOptionIds: current.selectedOptionIds.includes(optionId)
              ? current.selectedOptionIds.filter((id) => id !== optionId)
              : [...current.selectedOptionIds, optionId],
          }))
        }
        onTextChange={(textAnswer) => setDraft((current) => ({ ...current, textAnswer }))}
      />

      <div className="flex justify-end gap-2 border-t border-app-border pt-4">
        {result?.correct ? (
          <Button
            variant="primary"
            onClick={onContinue}
            trailingIcon={<ChevronRight className="h-4 w-4" />}
          >
            {continueLabel}
          </Button>
        ) : result ? (
          <Button
            variant="secondary"
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => {
              setDraft(emptyDraft);
              setResult(null);
            }}
          >
            Try again
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!isAnswered(question, draft) || submitting}
            icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            onClick={() => void submit()}
          >
            Submit answer
          </Button>
        )}
      </div>
    </div>
  );
}
