import { apiClient } from "../apiClient";
import { getAllOnboardingFeedback } from "./onboardingFeedback";
import type { BackendTeamOverviewUser } from "./overviewShape";
import { notifyPmAttentionChanged } from "./pmAttentionEvents";

/** What waits on the project manager in one project, as the sidebar counts it. */
export type PmAttentionCount = {
  /** Members whose current step has a skip request nobody has decided yet. */
  pendingSkips: number;
  /** Feedback items from the project's members that nobody has marked read. */
  unreadFeedback: number;
  total: number;
};

/**
 * How many onboarding items wait on the project manager in one project: pending skip requests
 * plus unread feedback, each counted from the backend's own answers.
 *
 * TODO(backend): there is no endpoint that answers "how many" yet, so this reads the two lists
 * that know -- the project's team overview (a pending skip rides on the member's current step)
 * and the feedback list, narrowed to the project's members since it is not scoped by project.
 * Kept in one function so a count endpoint can replace the body without touching a caller.
 *
 * Unlike {@link getTeamOverview} it never falls back to mock users, and it throws when either
 * read fails: a badge built from made-up members or half an answer is a wrong number, and the
 * caller shows no number rather than that.
 */
export async function getPmAttentionCount(projectId: string): Promise<PmAttentionCount> {
  const params = new URLSearchParams();
  params.append("projectIds", projectId);
  params.append("size", "100");

  const [overview, feedback] = await Promise.all([
    apiClient.fetch<{ content: BackendTeamOverviewUser[] }>(
      `/api/v1/onboarding/team-overview?${params.toString()}`,
    ),
    getAllOnboardingFeedback(),
  ]);

  const memberIds = new Set(overview.content.map((user) => user.userId));
  const pendingSkips = overview.content.filter(
    (user) => user.currentStep?.skip?.status === "PENDING",
  ).length;
  const unreadFeedback = feedback.filter(
    (item) => !item.read && item.userId !== undefined && memberIds.has(item.userId),
  ).length;

  return { pendingSkips, unreadFeedback, total: pendingSkips + unreadFeedback };
}

/**
 * Accepts a hire's request to skip their current step. PM and ADMIN only.
 *
 * @param reviewComment - Optional note for the hire about the decision.
 */
export async function acceptOnboardingSkipRequest(
  skipId: string,
  reviewComment = "",
): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/skips/${skipId}/accept`, {
    method: "POST",
    body: JSON.stringify({
      reviewComment,
    }),
  });

  notifyPmAttentionChanged();
}

/**
 * Denies a hire's request to skip their current step. PM and ADMIN only.
 *
 * @param reviewComment - Optional note for the hire about the decision.
 */
export async function denyOnboardingSkipRequest(skipId: string, reviewComment = ""): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/skips/${skipId}/deny`, {
    method: "POST",
    body: JSON.stringify({
      reviewComment,
    }),
  });

  notifyPmAttentionChanged();
}
