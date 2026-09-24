import {
  Check,
  CheckCircle2,
  ChevronRight,
  MessageSquareText,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
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
  /**
   * Opens the step an item is about. With it, every row becomes a way to that step — a skip
   * request or a comment makes sense next to the step it concerns, not as a line of text on
   * its own. Without it (no step to open), the rows are plain text.
   */
  onOpenStep?: (stepId: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const chipClassName =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-surface shadow-sm";

/**
 * The text half of a row: a button to the step when there is one, plain otherwise. Kept apart
 * from the row's actions, since buttons cannot nest.
 */
function ItemBody({
  stepId,
  stepTitle,
  onOpenStep,
  children,
}: {
  stepId: string | null | undefined;
  stepTitle: string | null | undefined;
  onOpenStep?: (stepId: string) => void;
  children: ReactNode;
}) {
  if (!onOpenStep || !stepId) {
    return <div className="flex min-w-0 flex-1 items-center gap-2.5">{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenStep(stepId)}
      aria-label={`Open the step${stepTitle ? `: ${stepTitle}` : ""}`}
      className="group -mx-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-app-surface/70 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {children}
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-app-text-subtle opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  );
}

/**
 * The things a member is waiting on the manager for, each on one line with its answer beside it.
 *
 * One line per item: the kind as an icon, the step it is about, the member's words truncated
 * after that. A pending skip or a thumbs-down is a short thing to decide, and the tall rows this
 * list used to draw gave two items a quarter of the profile. Pressing the text opens the step
 * (see `onOpenStep`), where the whole message and everything else about the step is.
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
  onOpenStep,
}: MemberOpenItemsProps) {
  const pendingSkip =
    member.currentStep?.skip?.status === "PENDING" ? member.currentStep.skip : null;
  const unread = feedback.filter(isUnread);
  const isEmpty = !pendingSkip && unread.length === 0 && !feedbackLoading;

  return (
    <ul className="divide-y divide-app-warning-border/50">
      {pendingSkip && (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0">
          <ItemBody
            stepId={member.currentStep?.id ?? pendingSkip.stepId}
            stepTitle={member.currentStep?.title}
            onOpenStep={onOpenStep}
          >
            <span aria-hidden="true" className={`${chipClassName} text-app-warning-text`}>
              <SkipForward className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-app-text">
                <span className="font-semibold">Wants to skip</span>{" "}
                <span className="text-app-text-muted">
                  {member.currentStep?.title ?? "the current step"}
                </span>
              </span>
              {pendingSkip.reason && (
                <span className="block truncate text-xs text-app-text-muted">
                  “{pendingSkip.reason}”
                </span>
              )}
            </span>
          </ItemBody>

          <div className="flex shrink-0 gap-1.5">
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
        <li className="py-2 first:pt-0 last:pb-0">
          <SkeletonGroup label="Loading feedback" className="space-y-2">
            <SkeletonLine className="w-2/3" />
          </SkeletonGroup>
        </li>
      ) : (
        unread.map((item) => {
          const tone =
            item.helpful === true
              ? { icon: ThumbsUp, className: "text-app-success-text", label: "Found it helpful" }
              : item.helpful === false
                ? { icon: ThumbsDown, className: "text-app-danger-text", label: "Not helpful" }
                : { icon: MessageSquareText, className: "text-app-brand-text", label: "Feedback" };
          const ToneIcon = tone.icon;

          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0"
            >
              <ItemBody stepId={item.stepId} stepTitle={item.stepTitle} onOpenStep={onOpenStep}>
                <span
                  role="img"
                  aria-label={tone.label}
                  title={tone.label}
                  className={`${chipClassName} ${tone.className}`}
                >
                  <ToneIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-app-text" title={item.message}>
                    {item.message}
                  </span>
                  <span className="block truncate text-xs text-app-text-muted">
                    {[item.stepTitle, item.createdAt ? formatDate(item.createdAt) : null]
                      .filter(Boolean)
                      .join(" · ") || "Feedback on the path"}
                  </span>
                </span>
              </ItemBody>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkRead(item.id)}
                loading={markingFeedbackId === item.id}
                icon={<Check className="h-3.5 w-3.5" />}
                className="shrink-0"
              >
                Mark read
              </Button>
            </li>
          );
        })
      )}

      {/* The overview can know about unread feedback before this list does (it folds the flag
          in from another endpoint), so the flag alone still gets a row rather than a silent
          "nothing open". */}
      {!feedbackLoading && unread.length === 0 && member.hasFeedback && !feedbackError && (
        <li className="py-2 text-sm text-app-text-muted first:pt-0 last:pb-0">
          {member.firstname} has left feedback on their path.
        </li>
      )}

      {feedbackError && (
        <li className="py-2 text-sm text-app-danger-text first:pt-0 last:pb-0">
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
