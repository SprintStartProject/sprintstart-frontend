import { apiClient } from "../apiClient";
import type { TeamOverviewUser } from "./featureTypes";
import { mockUsers } from "./mockData";
import { getAllOnboardingFeedback, type OnboardingFeedback } from "./onboardingFeedback";
import { normalizeOverviewUser, type BackendTeamOverviewUser } from "./overviewShape";

/** The team overview as the backend has it, without the unread-feedback flag. Throws on failure. */
async function readTeamOverviewUsers(
  roleId?: string,
  sortBy?: string,
  projectIds?: string[],
): Promise<TeamOverviewUser[]> {
  const params = new URLSearchParams();
  if (roleId && roleId !== "all") params.append("roleIds", roleId);
  projectIds?.forEach((projectId) => params.append("projectIds", projectId));
  if (sortBy) params.append("sortBy", sortBy);
  params.append("size", "100");

  const query = params.toString();
  const url = `/api/v1/onboarding/team-overview${query ? `?${query}` : ""}`;

  const response = await apiClient.fetch<{
    content: BackendTeamOverviewUser[];
  }>(url);

  return response.content.map(normalizeOverviewUser);
}

/** Sets `hasFeedback` on every member with at least one feedback item nobody has read. */
function withUnreadFeedbackFlag(
  users: TeamOverviewUser[],
  feedback: OnboardingFeedback[],
): TeamOverviewUser[] {
  const usersWithUnreadFeedback = new Set(
    feedback
      .filter((item) => item.read !== true && !item.readAt)
      .map((item) => item.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );

  return users.map((user) => ({
    ...user,
    hasFeedback: usersWithUnreadFeedback.has(user.userId),
  }));
}

/**
 * The team overview, each member flagged when they have unread feedback.
 *
 * Forgiving on purpose, for the screens that list the team: if the feedback list cannot be read
 * the members come without the flag, and if the overview itself cannot be read this falls back to
 * mock users. Anything that draws conclusions from the answer — a count, a finding — must use
 * {@link getTeamOverviewOrThrow} instead, which never invents members.
 */
export async function getTeamOverview(
  roleId?: string,
  sortBy?: string,
  projectIds?: string[],
): Promise<TeamOverviewUser[]> {
  let users: TeamOverviewUser[];
  try {
    users = await readTeamOverviewUsers(roleId, sortBy, projectIds);
  } catch {
    return mockUsers;
  }

  try {
    return withUnreadFeedbackFlag(users, await getAllOnboardingFeedback());
  } catch {
    return users;
  }
}

/**
 * {@link getTeamOverview} without the fallbacks: the same members and the same unread-feedback
 * flag, but it throws when the overview or the feedback list cannot be read.
 *
 * For the project analysis, which turns the answer into findings and a score: made-up members
 * would become findings about people who do not exist, and a missing feedback list would read as
 * "nothing unread". A failure has to reach the caller, so the check is marked as not run.
 */
export async function getTeamOverviewOrThrow(projectIds: string[]): Promise<TeamOverviewUser[]> {
  const [users, feedback] = await Promise.all([
    readTeamOverviewUsers(undefined, undefined, projectIds),
    getAllOnboardingFeedback(),
  ]);
  return withUnreadFeedbackFlag(users, feedback);
}

/**
 * One member's row from the team overview, or `undefined` when they are not in it.
 *
 * Reads the whole overview through {@link getTeamOverview}, so it inherits its fallback: when
 * the backend is unreachable, the member is looked up among the mock users.
 */
export async function getTeamMember(userId: string): Promise<TeamOverviewUser | undefined> {
  const users = await getTeamOverview();

  return users.find((user) => user.userId === userId);
}

/**
 * The signed-in user's own row of the team overview: their roles, skills and position in
 * their onboarding.
 *
 * Failures propagate: a fixture answer is indistinguishable from a real one and would hand a user
 * somebody else's journey. Callers decide what an absent overview means for them.
 */
export async function getMyTeamOverview(): Promise<TeamOverviewUser> {
  const user = await apiClient.fetch<BackendTeamOverviewUser>(
    "/api/v1/onboarding/me/team-overview",
  );

  return normalizeOverviewUser(user);
}
