import { useState } from "react";
import { useToast } from "../../context/useToast";
import { markOnboardingFeedbackRead } from "../../services/teamManagementService";
import type { MemberData } from "./useMemberData";

/** Marking a feedback item read, with the id in flight so its button can show it. */
export function useFeedbackActions({
  setFeedbackItems,
  refreshFeedback,
  refreshMember,
}: MemberData) {
  const toast = useToast();
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function markRead(feedbackId: string) {
    setMarkingId(feedbackId);
    try {
      await markOnboardingFeedbackRead(feedbackId);
      setFeedbackItems((current) =>
        current.map((feedback) =>
          feedback.id === feedbackId ? { ...feedback, read: true } : feedback,
        ),
      );
      await Promise.all([refreshFeedback(), refreshMember()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't mark the feedback as read.");
    } finally {
      setMarkingId(null);
    }
  }

  return { markingId, markRead };
}
