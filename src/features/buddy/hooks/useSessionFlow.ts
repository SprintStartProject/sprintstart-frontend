import { useCallback, useMemo } from "react";
import type { ConversationParts } from "./useConversationParts";
import type { TurnFlow } from "./useTurnFlow";
import { useOpening } from "./useOpening";
import { useSessionMoves } from "./useSessionMoves";

/**
 * The conversations: bringing one on screen, moving between them, and trying again after the
 * opening failed.
 */
export function useSessionFlow(parts: ConversationParts, turn: TurnFlow) {
  const { thread, sessionStore, team, proposals, latches, userId, clearThread } = parts;
  const { setMessages, setOpenerAction, setIsOpening, setIsGreeting, setOpenError } = thread;

  const view = useMemo(
    () => ({ setMessages, setOpenerAction, setIsOpening, setIsGreeting, setOpenError }),
    [setMessages, setOpenerAction, setIsOpening, setIsGreeting, setOpenError],
  );
  const { openSession, ensureOpened } = useOpening({
    ...sessionStore,
    latches,
    view,
    messagesNow: thread.messagesNow,
    teamProjectNow: team.teamProjectNow,
    resolveHireSession: turn.resolveHireSession,
  });

  const moves = useSessionMoves({
    ...sessionStore,
    ...proposals,
    latches,
    clearThread,
    setOpenError,
    openSession,
    userId,
    tracker: turn.tracker,
    stopRunningTurn: turn.stopRunningTurn,
    teamProjectNow: team.teamProjectNow,
    isOpening: thread.isOpening,
  });
  const { newConversation } = moves;

  /**
   * Tries again after [ensureOpened] failed.
   *
   * Its own function rather than handing the surfaces `ensureOpened` directly, because the two
   * differ in the one way that matters: this is somebody asking, so it clears the failure first and
   * always attempts the read. `ensureOpened` is a mount-time warm-up that must stay a no-op once the
   * conversation is there. A failed "new conversation" retries as itself.
   */
  const retryOpen = useCallback(async () => {
    setOpenError(null);
    if (latches.retryMove() === "newConversation") {
      latches.setRetryMove(null);
      await newConversation();
      return;
    }
    await ensureOpened();
  }, [latches, setOpenError, ensureOpened, newConversation]);

  return { ...moves, ensureOpened, retryOpen };
}

export type SessionFlow = ReturnType<typeof useSessionFlow>;
