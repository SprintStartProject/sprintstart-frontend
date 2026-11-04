import { apiClient } from "../apiClient";
import { buddyQuery } from "./buddyQuery";
import type { BuddyMessage } from "./featureTypes";

/**
 * One conversation the hire owns: its id, its title (empty until the first message writes
 * one) and when it was started. Newest first, as the backend orders them.
 */
export interface BuddySessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: string;
}

/**
 * The hire's conversations, newest first.
 *
 * Read before every opening: the client picks the one to show — the most recent, or the one
 * it was last in — and names it on every request that follows.
 */
export async function getSessions(): Promise<BuddySessionSummary[]> {
  const response = await apiClient.fetch<{ sessions: BuddySessionSummary[] }>(
    `/api/v1/onboarding/me/buddy/sessions`,
  );

  return response.sessions;
}

/**
 * Starts a conversation for the hire and returns its id.
 *
 * No project is named, deliberately: the hire's conversation is not one project's, and the
 * backend already scopes retrieval to every project they are on. A conversation created by
 * "new conversation" therefore behaves exactly like the first one.
 */
export async function createSession(): Promise<string> {
  const response = await apiClient.fetch<{ id: string }>(`/api/v1/onboarding/me/buddy/sessions`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.id;
}

/**
 * Bins one of the hire's conversations.
 *
 * The conversation leaves the hire's list — the backend keeps it, messages and all, until its
 * retention window ends and then deletes it for good. The list read no longer returns it, so
 * taking the row out client-side is the same thing the next read would show.
 *
 * @param sessionId - The conversation to bin. One of the hire's own; the backend answers `404`
 *   for anyone else's.
 */
export async function binSession(sessionId: string): Promise<void> {
  await apiClient.fetch<void>(
    `/api/v1/onboarding/me/buddy/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

/**
 * Retrieves one conversation's messages, oldest first (the window since its last opening —
 * not the whole transcript).
 *
 * @param sessionId - The conversation to read. Required for the hire's own conversations — the
 *   backend answers `400` without one.
 * @param teamProjectId - Pass to read the *team-mode* conversation with a managed project
 *   instead; the backend keeps the two apart and team reads name no session.
 */
export async function getMessages(
  sessionId: string | undefined,
  teamProjectId?: string,
): Promise<BuddyMessage[]> {
  return await apiClient.fetch<BuddyMessage[]>(
    `/api/v1/onboarding/me/buddy/messages${buddyQuery({ sessionId, teamProjectId })}`,
  );
}
