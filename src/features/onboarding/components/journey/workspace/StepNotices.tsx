import { SkipForward, ThumbsDown, ThumbsUp } from "lucide-react";
import type { OnboardingStepDetail } from "../../../../../services/onboardingTypes";
import type { SkipState } from "./workspaceRules";

/** Where the skip request stands, told above the tasks. */
export function SkipNotice({
  step,
  state,
}: {
  step: OnboardingStepDetail;
  state: Exclude<SkipState, null>;
}) {
  if (state === "pending") {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-app-warning-border bg-app-warning-bg px-3 py-2.5 text-sm text-app-warning-text">
        <SkipForward className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Skip requested</span> — your project manager decides. You
          can keep working on it meanwhile.
          {step.skip?.reason ? (
            <span className="mt-0.5 block text-xs opacity-80">“{step.skip.reason}”</span>
          ) : null}
        </span>
      </div>
    );
  }

  if (state === "approved") {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-sm text-app-success-text">
        <SkipForward className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Skip approved</span> — your project manager agreed you can
          leave this one out.
          <ReviewComment step={step} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-app-warning-border bg-app-surface px-3 py-2.5 text-sm text-app-text">
      <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-app-warning-text" aria-hidden="true" />
      <span>
        <span className="font-semibold">Skip declined</span> — your project manager would like you
        to do this one.
        <ReviewComment step={step} />
      </span>
    </div>
  );
}

function ReviewComment({ step }: { step: OnboardingStepDetail }) {
  if (!step.skip?.reviewComment) return null;

  return (
    <span className="mt-0.5 block text-xs text-app-text-muted">“{step.skip.reviewComment}”</span>
  );
}

/** What the member already told us about the step, shown while the feedback drawer is closed. */
export function FeedbackNotice({ helpful, comment }: { helpful: boolean | null; comment: string }) {
  const notHelpful = helpful === false;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm ${
        notHelpful
          ? "border-app-danger-border bg-app-danger-bg text-app-danger-text"
          : "border-app-success-border bg-app-success-bg text-app-success-text"
      }`}
    >
      {notHelpful ? (
        <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className="font-semibold">
          {notHelpful ? "You found this step not helpful" : "You found this step helpful"}
        </span>
        {comment ? <span className="mt-0.5 block text-xs opacity-80">“{comment}”</span> : null}
      </span>
    </div>
  );
}
