import { apiClient } from "./apiClient";
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
    const { open } = await apiClient.fetch<{ open: number }>(
      `${BASE}/knowledge-requests/count?projectId=${encodeURIComponent(projectId)}`,
    );
    return open;
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
