import { useState } from "react";
import { useToast } from "../../context/useToast";
import { useQueryFetch } from "../../hooks/useQueryFetch";
import { queryKeys } from "../../services/queryKeys";
import {
  acceptOnboardingSkipRequest,
  denyOnboardingSkipRequest,
  getUserOnboardingFeedback,
  markOnboardingFeedbackRead,
  type OnboardingFeedback,
} from "../../services/teamManagementService";

export type SkipDecision = "accept" | "deny";

export function isUnread(feedback: OnboardingFeedback): boolean {
  return feedback.read !== true && !feedback.readAt;
}

/**
 * A member's feedback, and the two answers a manager owes them: deciding a skip request and
 * reading feedback.
 *
 * Shared by the side panel and the full profile, so a skip can be decided from wherever the
 * manager happens to be looking — the decision used to live only on the profile page, two
 * clicks away from the dashboard that announced it.
 *
 * Both actions already fire `onPmAttentionChanged`, which invalidates the team overview; the
 * profile page reads its member through a different call, so it passes `onChanged` to reload.
 */
export function useMemberOpenItems(userId: string | null, onChanged?: () => Promise<unknown> | void) {
  const toast = useToast();
  const [reviewingSkip, setReviewingSkip] = useState<SkipDecision | null>(null);
  const [markingFeedbackId, setMarkingFeedbackId] = useState<string | null>(null);

  const {
    data: feedback,
    loading: feedbackLoading,
    error: feedbackError,
    refetch: refetchFeedback,
  } = useQueryFetch(
    queryKeys.memberFeedback.byUser(userId ?? ""),
    () => getUserOnboardingFeedback(userId ?? ""),
    { enabled: Boolean(userId) },
  );

  const reviewSkip = async (skipId: string, decision: SkipDecision) => {
    setReviewingSkip(decision);

    try {
      if (decision === "accept") {
        await acceptOnboardingSkipRequest(skipId);
      } else {
        await denyOnboardingSkipRequest(skipId);
      }

      await onChanged?.();
      toast.success(decision === "accept" ? "Skip request approved" : "Skip request denied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't review the skip request.");
    } finally {
      setReviewingSkip(null);
    }
  };

  const markRead = async (feedbackId: string) => {
    setMarkingFeedbackId(feedbackId);

    try {
      await markOnboardingFeedbackRead(feedbackId);
      refetchFeedback();
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't mark the feedback as read.");
    } finally {
      setMarkingFeedbackId(null);
    }
  };

  return {
    feedback: feedback ?? [],
    feedbackLoading,
    feedbackError,
    reviewingSkip,
    markingFeedbackId,
    reviewSkip,
    markRead,
  };
}
