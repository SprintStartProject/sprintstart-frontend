import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { actionDraftKey, type ActionDrafts } from "../actionDrafts";
import { confirmProposal, dismissStored } from "../conversation/proposalDecisions";
import { patchAction as patchActionIn } from "../conversation/messageReducers";
import { isStored, mayConfirm, mayDismissStored } from "../conversation/proposals";
import type { ActionPatch, BuddyMessageView, ProposedAction } from "../types";

/**
 * The hire's wording for the proposals that carry an editable message — a flag's question, the
 * only payload a person reads and the hire therefore rewords (see `actionDrafts` for the key).
 *
 * Session state rather than card state, for the same reason the composer's words are: the dock
 * unmounts when it closes, the full page mounts a second card for the same action, and either
 * one would otherwise throw away words the hire was halfway through. Unlike the composer's,
 * nothing below this provider needs to write it, so it lives here rather than in a context.
 */
function useActionDrafts() {
  const [actionDrafts, setActionDrafts] = useState<ActionDrafts>({});

  /**
   * Records what the hire typed into a proposal's field, so it survives a closed dock, a handed-
   * over conversation and the retry a refusal offers.
   */
  const setActionDraft = useCallback((key: string, text: string) => {
    setActionDrafts((current) => ({ ...current, [key]: text }));
  }, []);

  /**
   * Forgets a draft whose proposal is done with — it was sent, or the hire declined it. Nothing
   * is left to edit, and a card re-rendered later must not offer wording that has already left
   * the product.
   */
  const clearActionDraft = useCallback((key: string) => {
    setActionDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const clearActionDrafts = useCallback(() => setActionDrafts({}), []);

  return { actionDrafts, setActionDraft, clearActionDraft, clearActionDrafts };
}

/**
 * True while a proposal confirm or dismissal is in flight. Unlike the message streams, these
 * decisions mutate state without setting any of the streaming flags, and every operation that
 * clears the transcript (a switch, a fresh visit) must wait for them: a manager who confirms
 * a destructive change and immediately switches projects would otherwise lose the one place
 * the outcome was going to be shown.
 */
function useDecisionGate() {
  const pending = useRef(0);
  const [isDeciding, setIsDeciding] = useState(false);
  // The proposal currently on its way to the backend, per message and action id: two clicks inside
  // one React frame both see the pre-render state, so the second is refused here.
  const inFlight = useRef<Set<string>>(new Set());

  /**
   * Takes the one lock per proposal card, shared by confirm and dismiss, so the slower response
   * cannot overwrite the faster one. Returns what to call when the decision is over, or `null`
   * when this card already has one in flight.
   */
  const enter = useCallback((key: string): (() => void) | null => {
    if (inFlight.current.has(key)) return null;
    inFlight.current.add(key);
    pending.current += 1;
    setIsDeciding(true);

    return () => {
      inFlight.current.delete(key);
      pending.current -= 1;
      if (pending.current === 0) setIsDeciding(false);
    };
  }, []);

  const decidingNow = useCallback(() => pending.current > 0, []);

  return { isDeciding, enter, decidingNow };
}

type ProposalActionsInput = {
  setMessages: Dispatch<SetStateAction<BuddyMessageView[]>>;
  invalidateBoard: () => void;
};

/** Confirming and declining what the buddy proposed, with the drafts and the gate they share. */
export function useProposalActions({ setMessages, invalidateBoard }: ProposalActionsInput) {
  const drafts = useActionDrafts();
  const gate = useDecisionGate();
  const { clearActionDraft } = drafts;
  const { enter } = gate;

  /** Patches one proposed action in place, keyed by its message and action id. */
  const patchAction = useCallback(
    (messageId: string, actionId: string, patch: ActionPatch) => {
      setMessages((prev) => patchActionIn(prev, messageId, actionId, patch));
    },
    [setMessages],
  );

  const confirmAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      // Retryable after a transport error or a hire offer's legible "couldn't"; a stored team
      // proposal that resolved is spent, because confirming a success twice claims the same task
      // twice.
      if (!mayConfirm(action)) return;

      const release = enter(`${messageId}:${action.id}`);
      if (!release) return;

      patchAction(messageId, action.id, { status: "confirming" });
      // Fire-and-forget: the outcome lands back in message state, so the handler stays a plain
      // void callback (no Promise handed to a JSX prop).
      void confirmProposal(messageId, action, {
        patchAction,
        clearActionDraft,
        invalidateBoard,
      }).finally(release);
    },
    [enter, patchAction, clearActionDraft, invalidateBoard],
  );

  /**
   * Declines a proposed action — nothing changes; the conversation simply continues.
   *
   * A stored proposal is declined *at the backend* rather than only on screen, because it may
   * also be sitting in another tab waiting to be confirmed: dismissal closes that door too, and
   * only the backend can. A hire offer was never stored, so there is nothing to tell the
   * backend — declining is purely local.
   */
  const dismissAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      // A hire offer, or one that arrived without its details: nothing to decline at the backend,
      // but still worth putting away here.
      if (!isStored(action)) {
        patchAction(messageId, action.id, { status: "dismissed" });
        // A hire offer is the only kind that carries a draft, and this is the one place one is
        // declined — the wording goes with the offer it belonged to.
        clearActionDraft(actionDraftKey(messageId, action.id));
        return;
      }

      if (!mayDismissStored(action)) return;

      // The confirm's lock, shared: one question, one in-flight decision.
      const release = enter(`${messageId}:${action.id}`);
      if (!release) return;

      patchAction(messageId, action.id, { status: "confirming" });
      void dismissStored(messageId, action, patchAction).finally(release);
    },
    [enter, patchAction, clearActionDraft],
  );

  return {
    actionDrafts: drafts.actionDrafts,
    setActionDraft: drafts.setActionDraft,
    clearActionDrafts: drafts.clearActionDrafts,
    isDeciding: gate.isDeciding,
    decidingNow: gate.decidingNow,
    confirmAction,
    dismissAction,
  };
}
