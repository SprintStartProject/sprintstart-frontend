import { Check, SkipForward } from "lucide-react";
import { Badge } from "../../../../../components/ui/Badge";
import { Button } from "../../../../../components/ui/Button";
import { isSkipPending } from "./stepPanelKit";
import { isFeedbackUnread } from "../../../feedbackState";
import type { OnboardingFeedback } from "../../../../../services/teamManagementService";
import { SkipReview, type SkipReviewAction } from "../SkipReview";
import { getFeedbackRating, getSkipStatus } from "./stepPanelRules";
import type { DetailOnboardingStep } from "./stepPanelTypes";

function SkipRequestNote({ step, reason }: { step: DetailOnboardingStep; reason: string }) {
  const skipped = step.status === "SKIPPED";
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        skipped
          ? "border-app-danger-border bg-app-danger-bg"
          : "border-app-warning-border bg-app-warning-bg"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface ${
            skipped ? "text-app-danger-text" : "text-app-warning-text"
          }`}
        >
          <SkipForward className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-app-text">Skip request</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                skipped
                  ? "bg-app-surface text-app-danger-text"
                  : "bg-app-surface text-app-warning-text"
              }`}
            >
              {getSkipStatus(step)}
            </span>
          </div>

          <p className="mt-2 text-sm text-app-text">{reason}</p>
        </div>
      </div>
    </div>
  );
}

type FeedbackCardProps = {
  feedback: OnboardingFeedback;
  onMarkRead?: (feedbackId: string) => void;
  marking: boolean;
};

function formatFeedbackDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FeedbackCard({ feedback, onMarkRead, marking }: FeedbackCardProps) {
  const rating = getFeedbackRating(feedback.helpful);
  const RatingIcon = rating.Icon;
  // Feedback built from the step alone carries no read state -- neither badge nor button.
  const isUnread = isFeedbackUnread(feedback);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition-opacity ${rating.cardClassName} ${
        isUnread ? "" : "opacity-75"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${rating.iconClassName}`}
        >
          <RatingIcon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-app-text">Feedback</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${rating.badgeClassName}`}
            >
              {rating.label}
            </span>
            <Badge variant={isUnread ? "warning" : "neutral"} size="sm">
              {isUnread ? "Unread" : "Read"}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-app-text">{feedback.message}</p>

          {feedback.createdAt && (
            <p className="mt-2 text-xs text-app-text-muted">
              {formatFeedbackDate(feedback.createdAt)}
            </p>
          )}
        </div>

        {isUnread && onMarkRead ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Check className="h-3.5 w-3.5" />}
            loading={marking}
            onClick={() => onMarkRead(feedback.id)}
            className="shrink-0"
          >
            Mark read
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type StepRequestsProps = {
  step: DetailOnboardingStep;
  skipReason: string;
  feedbackItems: OnboardingFeedback[];
  onReviewSkip?: (skipId: string, action: SkipReviewAction, comment: string) => Promise<void>;
  onMarkFeedbackRead?: (feedbackId: string) => void;
  markingFeedbackId: string | null;
};

function SkipSection({
  step,
  skipReason,
  onReviewSkip,
}: Pick<StepRequestsProps, "step" | "skipReason" | "onReviewSkip">) {
  if (!skipReason) return null;
  const skipId = step.skip?.id;
  const awaitsReview = !!skipId && isSkipPending(step.skip) && step.status !== "SKIPPED";
  if (awaitsReview && onReviewSkip) {
    return (
      <SkipReview
        reason={skipReason}
        onReview={(action, comment) => onReviewSkip(skipId, action, comment)}
      />
    );
  }
  return <SkipRequestNote step={step} reason={skipReason} />;
}

/** The step's open skip request and the member's feedback on it, or a line saying there is neither. */
export function StepRequests({
  step,
  skipReason,
  feedbackItems,
  onReviewSkip,
  onMarkFeedbackRead,
  markingFeedbackId,
}: StepRequestsProps) {
  return (
    <section className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold text-app-text">Requests & feedback</h3>

      <SkipSection step={step} skipReason={skipReason} onReviewSkip={onReviewSkip} />

      {feedbackItems.map((feedback) => (
        <FeedbackCard
          key={feedback.id}
          feedback={feedback}
          onMarkRead={onMarkFeedbackRead}
          marking={markingFeedbackId === feedback.id}
        />
      ))}

      {feedbackItems.length === 0 && !skipReason && (
        <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
          No skip request or feedback for this step.
        </p>
      )}
    </section>
  );
}
