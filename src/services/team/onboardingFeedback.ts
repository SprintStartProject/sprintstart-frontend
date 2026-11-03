import { apiClient } from "../apiClient";
import { notifyPmAttentionChanged } from "./pmAttentionEvents";

export type OnboardingFeedback = {
  id: string;
  userId?: string;
  stepId?: string | null;
  stepTitle?: string | null;
  message: string;
  comment?: string;
  helpful?: boolean | null;
  createdAt?: string;
  read?: boolean;
  readAt?: string | null;
};

/**
 * Feedback as the rest of the app may assume it: a message that is there, and a `read` that is a
 * definite boolean rather than absent.
 *
 * `read` being optional is what let three different readings of "unread" grow -- `read !== true`,
 * `read === false` -- which disagreed exactly when the backend omitted the field: one surface
 * offered "Mark read" on an item another surface was already calling read.
 */
function normaliseFeedback(item: OnboardingFeedback): OnboardingFeedback {
  return {
    ...item,
    message: item.message ?? item.comment ?? "",
    read: item.read ?? !!item.readAt,
  };
}

/** Loads all step feedback one user has given, with `read` normalised. PM and ADMIN only. */
export async function getUserOnboardingFeedback(userId: string): Promise<OnboardingFeedback[]> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>(
    `/api/v1/admin/onboarding/users/${userId}/feedback`,
  );

  return feedback.map(normaliseFeedback);
}

/**
 * Loads the step feedback of all users, across every project, with `read` normalised. Callers
 * that need one project's feedback filter by its members themselves. PM and ADMIN only.
 */
export async function getAllOnboardingFeedback(): Promise<OnboardingFeedback[]> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>("/api/v1/admin/onboarding/feedback");

  return feedback.map(normaliseFeedback);
}

/** Marks one feedback item as read. PM and ADMIN only. */
export async function markOnboardingFeedbackRead(feedbackId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/feedback/${feedbackId}/read`, {
    method: "POST",
  });

  notifyPmAttentionChanged();
}
