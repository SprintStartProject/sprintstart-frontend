import { Check, MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type { OnboardingFeedback } from "../../../../services/teamManagementService";
import { isFeedbackUnread } from "../../feedbackState";

/**
 * A member's feedback on a step, where the PM is looking at the step -- coloured by what it says,
 * with "Mark read" while it is new.
 */
export function FeedbackNote({
  feedback,
  marking = false,
  onMarkRead,
}: {
  feedback: OnboardingFeedback;
  marking?: boolean;
  onMarkRead?: (feedbackId: string) => void;
}) {
  const isUnread = isFeedbackUnread(feedback);
  const tone =
    feedback.helpful === true
      ? {
          card: "border-app-success-border bg-app-success-bg",
          text: "text-app-success-text",
          label: "Found it helpful",
          icon: <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />,
        }
      : feedback.helpful === false
        ? {
            card: "border-app-danger-border bg-app-danger-bg",
            text: "text-app-danger-text",
            label: "Found it not helpful",
            icon: <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />,
          }
        : {
            card: "border-app-brand-border bg-app-brand-soft",
            text: "text-app-brand-text",
            label: "Feedback",
            icon: <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />,
          };

  return (
    <div
      className={`space-y-2 rounded-2xl border p-3 transition-opacity ${tone.card} ${
        isUnread ? "" : "opacity-75"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
          {tone.icon}
          {tone.label}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isUnread ? "bg-app-surface text-app-brand-text" : "text-app-text-muted"
          }`}
        >
          {isUnread ? "New" : "Read"}
        </span>
      </div>
      {feedback.message ? <p className="text-sm text-app-text">“{feedback.message}”</p> : null}
      {isUnread && onMarkRead ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            icon={<Check className="h-3.5 w-3.5" />}
            loading={marking}
            onClick={() => onMarkRead(feedback.id)}
          >
            Mark read
          </Button>
        </div>
      ) : null}
    </div>
  );
}
