import { Fragment } from "react";
import { Check, ChevronRight } from "lucide-react";

type StepperProps = {
  /** Ordered step labels. */
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
};

/**
 * A compact inline progress indicator: numbered circles with their label,
 * separated by chevrons. Completed steps are filled and check-marked, the
 * current step is filled with its number, upcoming steps are outlined and
 * muted. Purely presentational — the parent owns which step is active.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Progress">
      {steps.map((label, index) => {
        const isCompleted = index < current;
        const isCurrent = index === current;

        return (
          <Fragment key={label}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
            )}

            <li className="flex items-center gap-1.5" aria-current={isCurrent ? "step" : undefined}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs leading-none font-semibold transition-colors ${
                  isCompleted || isCurrent
                    ? "border-app-brand bg-app-brand text-white"
                    : "border-app-border bg-app-surface text-app-text-muted"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>

              <span
                className={`text-sm whitespace-nowrap ${
                  isCurrent
                    ? "font-medium text-app-text"
                    : isCompleted
                      ? "text-app-text"
                      : "text-app-text-muted"
                }`}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
