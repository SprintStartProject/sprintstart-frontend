import {
  confirmStoredProposal,
  dismissStoredProposal,
  performAction,
} from "../../../services/buddyService";
import { announceBuddyPathChanged } from "../aiBuddyBus";
import { actionDraftKey } from "../actionDrafts";
import type { ActionPatch, ProposedAction, StoredActionProposal } from "../types";
import { actionExtras, isStored, movesPath, touchesBoard } from "./proposals";
import { PROPOSAL_GONE, isNotFound } from "./replyMessages";

/** What carrying out a decision touches beyond the card it was made on. */
export type DecisionEffects = {
  patchAction: (messageId: string, actionId: string, patch: ActionPatch) => void;
  clearActionDraft: (key: string) => void;
  invalidateBoard: () => void;
};

/**
 * Confirms a proposed action: the one call that mutates. Reflects the outcome inline — a
 * legible line whether it changed something (`ok`) or legibly couldn't, or a retryable error
 * if the request itself failed.
 *
 * The two kinds confirm differently, and the split is what keeps each honest: a hire offer
 * echoes its own payload back (`performAction`), while a stored team proposal confirms by id
 * alone (`confirmStoredProposal`) — the client sends back exactly what it was given, nothing
 * derived. A `404` from either stored call arrives as a *resolved* outcome: the proposal was
 * already confirmed or dismissed (a reload between sessions, or a second tab), and the
 * backend's message says so legibly — not an error to retry.
 */
export async function confirmProposal(
  messageId: string,
  action: ProposedAction,
  effects: DecisionEffects,
): Promise<void> {
  const { patchAction, clearActionDraft, invalidateBoard } = effects;

  try {
    const result = isStored(action)
      ? await confirmStoredProposal(action.proposalId)
      : await performAction(action.action, actionExtras(action));
    patchAction(messageId, action.id, {
      status: "resolved",
      ok: result.ok,
      outcome: result.message,
    });
    // It went out: the wording has left the product, so the session keeps none of it. A
    // refusal keeps it — that card is about to be handed the hire's text back to correct.
    if (result.ok) clearActionDraft(actionDraftKey(messageId, action.id));
    // A path action just moved something on a page that may be open behind this dock. Told
    // rather than polled, and only on success: a refused confirm changed nothing to refresh.
    if (result.ok && movesPath(action)) announceBuddyPathChanged();

    // `board.all()`, not a project key: the backend re-resolves the project server-side
    // (the caller's single onboarding project) and never tells the client which board —
    // see `useInvalidateBoard`.
    if (result.ok && touchesBoard(action)) invalidateBoard();
  } catch (e) {
    console.error(e);
    // A settled proposal answers 200 with ok: false, handled above; a 404 means no such
    // proposal for this caller, so the card resolves instead of offering a retry.
    patchAction(
      messageId,
      action.id,
      isNotFound(e)
        ? { status: "resolved", ok: false, outcome: PROPOSAL_GONE }
        : { status: "error" },
    );
  }
}

/** Declines a stored proposal at the backend, where it may also be waiting in another tab. */
export async function dismissStored(
  messageId: string,
  action: StoredActionProposal,
  patchAction: DecisionEffects["patchAction"],
): Promise<void> {
  try {
    // A 200 with ok: false means the proposal was already confirmed, expired or beaten to it,
    // and its message says which; that beats claiming nothing changed.
    const result = await dismissStoredProposal(action.proposalId);
    patchAction(
      messageId,
      action.id,
      result.ok
        ? { status: "dismissed" }
        : { status: "resolved", ok: false, outcome: result.message },
    );
  } catch (e) {
    console.error(e);
    // 404: no such proposal for this caller, so the card resolves. Any other failure keeps
    // the offer on the table and retryable.
    patchAction(
      messageId,
      action.id,
      isNotFound(e)
        ? { status: "resolved", ok: false, outcome: PROPOSAL_GONE }
        : { status: "idle" },
    );
  }
}
