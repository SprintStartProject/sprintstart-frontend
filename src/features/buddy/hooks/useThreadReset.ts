import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { BuddyOpeningAction } from "../../../services/buddyService";
import type { BuddyMessageView } from "../types";

type ThreadParts = {
  setMessages: Dispatch<SetStateAction<BuddyMessageView[]>>;
  setOpenerAction: Dispatch<SetStateAction<BuddyOpeningAction | null>>;
  setOpenError: Dispatch<SetStateAction<string | null>>;
  setActiveTool: Dispatch<SetStateAction<string | null>>;
  setPresentedGreetingId: Dispatch<SetStateAction<string | null>>;
  commitQueued: (next: never[]) => void;
  setQueuePaused: (paused: boolean) => void;
  clearActionDrafts: () => void;
  closeDinoGame: () => void;
};

/**
 * Puts the thread on screen away, leaving nothing of the conversation that was in it.
 *
 * Every move to another conversation does this — a switch, a fresh conversation, a change of
 * project. The composer's words follow the session by themselves (`BuddyDraftProvider` keys drafts
 * on it); anything queued was written for the conversation being left. Wording the hire had
 * half-edited in a proposal belonged to the offers that are going with the transcript — it is not
 * a composer draft and must not outlive them. A game left open from the previous conversation would
 * keep claiming "Reply ready" for a thread that has just been cleared.
 */
export function useThreadReset(parts: ThreadParts) {
  const { setMessages, setOpenerAction, setOpenError, setActiveTool, setPresentedGreetingId } =
    parts;
  const { commitQueued, setQueuePaused, clearActionDrafts, closeDinoGame } = parts;

  return useCallback(() => {
    setMessages([]);
    setOpenerAction(null);
    setOpenError(null);
    commitQueued([]);
    setQueuePaused(false);
    clearActionDrafts();
    setActiveTool(null);
    setPresentedGreetingId(null);
    closeDinoGame();
  }, [
    setMessages,
    setOpenerAction,
    setOpenError,
    setActiveTool,
    setPresentedGreetingId,
    commitQueued,
    setQueuePaused,
    clearActionDrafts,
    closeDinoGame,
  ]);
}
