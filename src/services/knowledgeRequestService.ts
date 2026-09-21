import { ApiError, apiClient } from "./apiClient";
import type { CanonicalAnswer, KnowledgeRequest } from "../features/knowledge-request/types";

const BASE = "/api/v1/onboarding";

/**
 * The buddy's growth loop. A hire escalates a question the buddy could not answer; a PM works the
 * inbox and answers it, minting a durable answer the buddy then serves. Mirrors the backend's
 * hire (`/me/...`) vs PM split — the PM calls are only reachable from PM-gated surfaces.
 */
/**
 * Told when the open queue changes, so a badge showing its size can re-read at once instead of
 * waiting for the next navigation.
 *
 * The same shape as `onPmAttentionChanged` in `teamManagementService`, and for the same reason: the
 * PM who empties the queue is looking at the sidebar while they do it, and a count that disagrees
 * with the list beside it is worse than no count.
 */
type EscalationsChangedListener = () => void;

const escalationsChangedListeners = new Set<EscalationsChangedListener>();

export function onOpenEscalationsChanged(listener: EscalationsChangedListener): () => void {
  escalationsChangedListeners.add(listener);
  return () => {
    escalationsChangedListeners.delete(listener);
  };
}

function notifyOpenEscalationsChanged(): void {
  escalationsChangedListeners.forEach((listener) => {
    listener();
  });
}

/**
 * Set once this deployment has answered 404 for the open-escalation count.
 *
 * Module-wide, because the shape of the backend does not change while the tab is open -- but it is
 * cleared again after a while: a single 404 during a rolling deploy used to silence the PM's badge
 * for the rest of the session, with the log suppressed by design, and there is no way back from
 * that short of a reload. The endpoint now exists on the matching backend and `canAccessProject`
 * answers 403 rather than 404, so this is only a guard for running against an older backend.
 */
let countEndpointMissing = false;
let countEndpointMissingAt = 0;
/** How long a 404 is taken as "this backend does not have it" before asking again. */
const COUNT_ENDPOINT_RETRY_MS = 5 * 60 * 1000;

export const knowledgeRequestService = {
  /** Hire: flag a question the buddy could not answer to the project's PM. */
  async escalate(projectId: string, question: string): Promise<KnowledgeRequest> {
    return apiClient.fetch<KnowledgeRequest>(`${BASE}/me/knowledge-requests`, {
      method: "POST",
      body: JSON.stringify({ projectId, question }),
    });
  },

  /** Hire: my escalated questions, newest first, each with its answer once given. */
  async listMine(): Promise<KnowledgeRequest[]> {
    return apiClient.fetch<KnowledgeRequest[]>(`${BASE}/me/knowledge-requests`);
  },

  /** PM: the open escalation queue for a project, longest-waiting first. */
  async listOpen(projectId: string): Promise<KnowledgeRequest[]> {
    return apiClient.fetch<KnowledgeRequest[]>(
      `${BASE}/knowledge-requests?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * PM: how many questions are still waiting on a person.
   *
   * Its own endpoint rather than `listOpen(...).length`: the full read resolves every asker's name
   * and onboarding position, which is a page of work to produce one integer, and the sidebar badge
   * asks for it on every navigation.
   */
  async countOpen(projectId: string): Promise<number> {
    // A backend that does not have this endpoint will not grow one mid-session, and the sidebar
    // asks on every navigation — so a 404 is remembered and the badge quietly reports nothing
    // instead of writing a failed request to the console for every view. Any other failure is
    // thrown as usual: a 500 or a dropped connection may well be gone by the next check.
    if (countEndpointMissing && Date.now() - countEndpointMissingAt < COUNT_ENDPOINT_RETRY_MS) {
      return 0;
    }
    countEndpointMissing = false;

    try {
      const { open } = await apiClient.fetch<{ open: number }>(
        `${BASE}/knowledge-requests/count?projectId=${encodeURIComponent(projectId)}`,
      );
      return open;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        countEndpointMissing = true;
        countEndpointMissingAt = Date.now();
        return 0;
      }
      throw reason;
    }
  },

  /** PM: answer an open request, minting the durable answer and closing the request. */
  async answer(requestId: string, answer: string, question?: string): Promise<CanonicalAnswer> {
    const minted = await apiClient.fetch<CanonicalAnswer>(
      `${BASE}/knowledge-requests/${encodeURIComponent(requestId)}/answer`,
      { method: "POST", body: JSON.stringify({ answer, question }) },
    );
    notifyOpenEscalationsChanged();
    return minted;
  },

  /** PM: dismiss a one-off or duplicate without minting an answer. */
  async dismiss(requestId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${BASE}/knowledge-requests/${encodeURIComponent(requestId)}/dismiss`,
      { method: "POST" },
    );
    notifyOpenEscalationsChanged();
  },

  /** PM: every durable answer on a project — the knowledge the buddy now serves. */
  async listAnswers(projectId: string): Promise<CanonicalAnswer[]> {
    return apiClient.fetch<CanonicalAnswer[]>(
      `${BASE}/canonical-answers?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /** PM: keep a durable answer current when reality changes; the buddy serves the new text. */
  async editAnswer(answerId: string, question: string, answer: string): Promise<CanonicalAnswer> {
    return apiClient.fetch<CanonicalAnswer>(
      `${BASE}/canonical-answers/${encodeURIComponent(answerId)}`,
      { method: "PUT", body: JSON.stringify({ question, answer }) },
    );
  },
};
