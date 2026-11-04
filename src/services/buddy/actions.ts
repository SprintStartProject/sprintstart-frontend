import { apiClient } from "../apiClient";

/** The outcome of confirming a buddy-proposed action — a single line to relay in the thread. */
export interface BuddyActionResult {
  ok: boolean;
  message: string;
}

/** The confirm payloads a proposing action echoes back, by the name the backend reads. */
type BuddyActionExtras = {
  question?: string;
  taskId?: string;
  title?: string;
  attesterId?: string;
  githubLogin?: string;
  competencyKey?: string;
  level?: string;
  stepId?: string;
  questionId?: string;
  phaseId?: string;
  onboardingTaskId?: string;
  answer?: string;
  optionIds?: string[];
  description?: string;
  reason?: string;
  waitsOnIds?: string[];
  unlocksIds?: string[];
  checklistTitle?: string;
  checklistItems?: string[];
  cardId?: string;
  noteText?: string;
  lineBefore?: string;
  lineAfter?: string;
  linkUrl?: string;
  linkLabel?: string;
  cardIds?: string[];
};

/**
 * Confirms a buddy-proposed action. This is the only call that mutates — the proposal itself
 * changed nothing. The project is re-resolved server-side from the caller, so only the action name
 * and the proposal's own confirm payloads are sent: `question` for flag-to-PM, `taskId` for a
 * goal claim, `title` + `attesterId` for an attestation request, `githubLogin` for saving a
 * username, `competencyKey` + `level` for recording where a conversation placed the hire, and the
 * path-node ids (`stepId`, `questionId`, `phaseId`, plus `answer`, `description` and `reason`) for
 * the actions that move the hire along their onboarding path.
 */
export async function performAction(
  action: string,
  extras: BuddyActionExtras = {},
): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(`/api/v1/onboarding/me/buddy/actions`, {
    method: "POST",
    body: JSON.stringify({ action, ...extras }),
  });
}

/**
 * Confirms a *team-mode* proposal by id. The proposal is stored server-side, so the id is the
 * whole payload — nothing about the change is re-sent, because what the change is lives on the
 * backend, which the manager already saw described in the card's preview.
 *
 * A proposal that has already been confirmed or dismissed comes back `404` — the caller renders
 * that as the outcome line, not as an error.
 */
export async function confirmStoredProposal(proposalId: string): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(
    `/api/v1/onboarding/me/buddy/proposals/${encodeURIComponent(proposalId)}/confirm`,
    { method: "POST" },
  );
}

/**
 * Dismisses a *team-mode* proposal by id. Nothing changes but the proposal — it can no longer be
 * confirmed. The same `404` rule as `confirmStoredProposal` applies.
 */
export async function dismissStoredProposal(proposalId: string): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(
    `/api/v1/onboarding/me/buddy/proposals/${encodeURIComponent(proposalId)}/dismiss`,
    { method: "POST" },
  );
}
