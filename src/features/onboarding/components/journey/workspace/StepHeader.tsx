import { Clock3 } from "lucide-react";
import { formatMinutes } from "../../../journey";
import { askAboutStep } from "../../../buddyDrafts";
import type { OnboardingStepDetail } from "../../../../../services/onboardingTypes";
import { StepOriginBadge } from "../../StepOriginBadge";
import { AskTheBuddy } from "./buddyKit";
import { isBehind, workedLabel } from "./workspaceRules";

/** The step's origin, estimate and time spent, its description, and the way out of being stuck. */
export function StepHeader({
  step,
  now,
  isFocus,
}: {
  step: OnboardingStepDetail;
  now: number;
  isFocus: boolean;
}) {
  const worked = workedLabel(step, now);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-app-text-muted">
        <StepOriginBadge step={step} />
        {step.estimatedMinutes > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMinutes(step.estimatedMinutes)}
          </span>
        ) : null}
        {worked ? <span>{worked}</span> : null}
      </div>
      {step.description ? (
        <p className={`leading-relaxed text-app-text-muted ${isFocus ? "text-base" : "text-sm"}`}>
          {step.description}
        </p>
      ) : null}
      {/* Where a hire sits when they are stuck on a step, so the way out of being stuck belongs
          here. Not once it is behind them: there is nothing left to be stuck on. */}
      {!isBehind(step) ? (
        <AskTheBuddy question={askAboutStep(step)} label="Stuck? Ask your buddy about this step" />
      ) : null}
    </div>
  );
}
