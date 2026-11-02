import { useInvalidateBoard } from "../../board/hooks/useInvalidateBoard";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";
import { buddySessionApi } from "./buddySessionApi";
import { useComposerFlow } from "./useComposerFlow";
import { useConversationParts } from "./useConversationParts";
import { useSessionFlow } from "./useSessionFlow";
import { useTurnFlow } from "./useTurnFlow";

export type { ProjectSelectionSlice } from "../conversation/projectSelection";

/**
 * The conversation core behind every buddy surface: the message list, the optimistic
 * send-and-stream loop, and the "which tool is it running" signal.
 *
 * Deliberately knows nothing about *where* it is shown. It is instantiated exactly once, by
 * [BuddyProvider], and both surfaces read that one instance through `useBuddySession` — so a
 * hire's one buddy session really is one, rather than two lists that happen to share a name.
 *
 * Nothing is requested until a surface calls [ensureOpened].
 */
export function useBuddyConversation(
  selection: ProjectSelectionSlice,
  onTeamModeLeft?: () => void,
  /**
   * Called when a move to another conversation cut a running answer short, so the surface can
   * say so — the answer went on in a conversation the hire is no longer looking at.
   */
  onTurnStopped?: () => void,
) {
  const invalidateBoard = useInvalidateBoard();
  const dinoUnlocked = useDinoUnlocked();
  const parts = useConversationParts(selection, onTeamModeLeft, {
    invalidateBoard,
    dinoUnlocked,
    useDinoGame: useSpaceOpensDino,
  });
  const turn = useTurnFlow(parts, onTurnStopped);
  const session = useSessionFlow(parts, turn);
  const composer = useComposerFlow(parts, turn, session, selection);

  return buddySessionApi(parts, { turn, session, composer });
}
