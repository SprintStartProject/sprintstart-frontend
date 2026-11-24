import { useCallback } from "react";
import { useNewConversationShortcut } from "../../hooks/useNewConversationShortcut";
import type { BuddySession } from "./buddyPageTypes";

type ConversationStart = {
  canStart: boolean;
  startConversation: () => void;
  selectConversation: (id: string) => void;
};

/**
 * Starting and switching conversations, with the one gate for all three ways of starting one — the
 * button, the chord and the dock's own copy — so a control that is live in one place is live in all.
 *
 * `hasUserMessage`: a conversation nobody has spoken in is already the new one, so asking for
 * another would only pile up empty ones. `isHireMode`: team mode has one conversation per project
 * and nothing to start. Not `!isBusy`: `newConversation` aborts a streaming answer itself. It does
 * wait out what it cannot cut short — the greeting stream and any proposal decision whose outcome
 * line would be cleared before it was read.
 */
export function useConversationStart(
  session: BuddySession,
  isHireMode: boolean,
  hasUserMessage: boolean,
): ConversationStart {
  const { newConversation, selectSession } = session;
  const canStart =
    isHireMode &&
    hasUserMessage &&
    !session.isOpening &&
    !session.isGreeting &&
    !session.isDeciding;

  // Memoised so the listener is bound once rather than torn down and rebuilt on every streamed
  // token, and so the conversation list does not re-render every row for a fresh handler.
  const startConversation = useCallback(() => void newConversation(), [newConversation]);
  const selectConversation = useCallback((id: string) => void selectSession(id), [selectSession]);

  // The keyboard half of the buttons that start a conversation, gated the same way they are.
  useNewConversationShortcut(startConversation, canStart);

  return { canStart, startConversation, selectConversation };
}
