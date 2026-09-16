import { Check, CheckCircle2, MessageSquareText, SkipForward, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import type { OnboardingFeedback } from "../../../services/teamManagementService";
import type { TeamOverviewUser } from "../../team-management/types";
import { isUnread, type SkipDecision } from "../useMemberOpenItems";

type MemberOpenItemsProps = {
  member: TeamOverviewUser;
  feedback: OnboardingFeedback[];
  feedbackLoading: boolean;
  feedbackError: boolean;
  reviewingSkip: SkipDecision | null;
  markingFeedbackId: string | null;
  onReviewSkip: (skipId: string, decision: SkipDecision) => void;
  onMarkRead: (feedbackId: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The things a member is waiting on the manager for, each with its answer right beside it.
 *
 * Rows rather than the tinted warning boxes the profile page used to stack: a list of two
 * warning-yellow cards read as two alarms, when what they are is a to-do list. The icon chip
 * carries the tone; the text stays in the text tokens.
 */
export function MemberOpenItems({
  member,
  feedback,
  feedbackLoading,
  feedbackError,
  reviewingSkip,
  markingFeedbackId,
  onReviewSkip,
  onMarkRead,
}: MemberOpenItemsProps) {
  const pendingSkip =
    member.currentStep?.skip?.status === "PENDING" ? member.currentStep.skip : null;
  const unread = feedback.filter(isUnread);
  const isEmpty = !pendingSkip && unread.length === 0 && !feedbackLoading;

  return (
    <ul className="divide-y divide-app-border-muted">
      {pendingSkip && (
        <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-warning-bg text-app-warning-text"
          >
            <SkipForward className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-app-text">
              Wants to skip{" "}
              <span className="font-medium text-app-text-muted">
                {member.currentStep?.title ?? "the current step"}
              </span>
            </p>
            {pendingSkip.reason && (
              <p className="mt-1 text-sm leading-relaxed text-app-text">“{pendingSkip.reason}”</p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onReviewSkip(pendingSkip.id, "accept")}
              loading={reviewingSkip === "accept"}
              disabled={reviewingSkip !== null}
              icon={<Check className="h-3.5 w-3.5" />}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReviewSkip(pendingSkip.id, "deny")}
              loading={reviewingSkip === "deny"}
              disabled={reviewingSkip !== null}
              icon={<X className="h-3.5 w-3.5" />}
            >
              Deny
            </Button>
          </div>
        </li>
      )}

      {feedbackLoading ? (
        <li className="py-3 first:pt-0 last:pb-0">
          <SkeletonGroup label="Loading feedback" className="space-y-2">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
          </SkeletonGroup>
        </li>
      ) : (
        unread.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text"
            >
              <MessageSquareText className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-app-text">{item.message}</p>
              <p className="mt-1 text-xs text-app-text-muted">
                {[item.stepTitle, item.createdAt ? formatDate(item.createdAt) : null]
                  .filter(Boolean)
                  .join(" · ") || "Feedback on the path"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkRead(item.id)}
              loading={markingFeedbackId === item.id}
              icon={<Check className="h-3.5 w-3.5" />}
              className="shrink-0 self-start"
            >
              Mark read
            </Button>
          </li>
        ))
      )}

      {/* The overview can know about unread feedback before this list does (it folds the flag
          in from another endpoint), so the flag alone still gets a row rather than a silent
          "nothing open". */}
      {!feedbackLoading && unread.length === 0 && member.hasFeedback && !feedbackError && (
        <li className="py-3 text-sm text-app-text-muted first:pt-0 last:pb-0">
          {member.firstname} has left feedback on their path.
        </li>
      )}

      {feedbackError && (
        <li className="py-3 text-sm text-app-danger-text first:pt-0 last:pb-0">
          Feedback could not be loaded.
        </li>
      )}

      {isEmpty && !member.hasFeedback && !feedbackError && (
        <li className="flex items-center gap-2 text-sm text-app-text-muted">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
          Nothing waiting on you.
        </li>
      )}
    </ul>
  );
}
