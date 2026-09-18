import { Bell, Check, ChevronRight, SkipForward, X } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { SkipAnswer } from "../../skipAnswers";

/**
 * Tells the member that their project manager answered skip requests since they last looked.
 *
 * A declined skip otherwise only shows once the member happens to open that step again, and an
 * approved one not at all -- the step just quietly reads "Skipped". Each answer opens its step;
 * "Got it" puts the whole notice away.
 */
export function SkipAnswerNotice({
  answers,
  onOpenStep,
  onDismiss,
}: {
  answers: readonly SkipAnswer[];
  onOpenStep: (answer: SkipAnswer) => void;
  onDismiss: () => void;
}) {
  if (answers.length === 0) return null;
  return (
    <section
      aria-label="Answers to your skip requests"
      className="rounded-3xl border border-app-brand-border bg-app-brand-soft p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface text-app-brand-text">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-app-text">
            {answers.length === 1
              ? "Your project manager answered your skip request"
              : `Your project manager answered ${answers.length} skip requests`}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={<Check className="h-4 w-4" />} onClick={onDismiss}>
          Got it
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {answers.map((answer) => (
          <li key={answer.skipId}>
            <button
              type="button"
              onClick={() => onOpenStep(answer)}
              className="group flex w-full items-start gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2.5 text-left transition-colors hover:border-app-brand-border"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  answer.approved
                    ? "bg-app-success-bg text-app-success-text"
                    : "bg-app-warning-bg text-app-warning-text"
                }`}
              >
                {answer.approved ? (
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-app-text">{answer.stepTitle}</span>
                <span
                  className={`block text-xs font-semibold ${
                    answer.approved ? "text-app-success-text" : "text-app-warning-text"
                  }`}
                >
                  {answer.approved ? "Skip approved" : "Skip declined — they'd like you to do it"}
                </span>
                {answer.comment ? (
                  <span className="mt-1 block text-xs text-app-text-muted">“{answer.comment}”</span>
                ) : null}
              </span>
              <ChevronRight
                className="mt-1 h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
