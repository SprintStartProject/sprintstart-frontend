import { useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { createOpeningLatches } from "../conversation/openingLatches";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";
import { useComposerOptions } from "./useComposerOptions";
import { useDinoSurface } from "./useDinoSurface";
import { useMessageQueue } from "./useMessageQueue";
import { useProposalActions } from "./useProposalActions";
import { useSessionStore } from "./useSessionStore";
import { useTeamMode } from "./useTeamMode";
import { useThreadReset } from "./useThreadReset";
import { useThreadState } from "./useThreadState";

/**
 * What other features supply. Handed in rather than imported, so the one file that crosses into
 * those features stays `useBuddyConversation`.
 */
export type OtherFeatures = {
  /** Marks the board stale after a write the buddy made. */
  invalidateBoard: () => void;
  dinoUnlocked: boolean;
  /** The game's own hook: opens the game on Space while a reply is awaited. */
  useDinoGame: Parameters<typeof useDinoSurface>[1]["useGame"];
};

/**
 * The state the conversation's behaviour is built on: what is on screen, the pieces that hold the
 * rest (sessions, team target, queue, proposal drafts, the game), and the thread reset that ties
 * them together.
 *
 * Nothing here decides anything; the flows (`useTurnFlow`, `useSessionFlow`, `useComposerFlow`) are
 * handed this bundle and pick from it what they need.
 */
export function useConversationParts(
  selection: ProjectSelectionSlice,
  onTeamModeLeft: (() => void) | undefined,
  otherFeatures: OtherFeatures,
) {
  const { invalidateBoard, dinoUnlocked, useDinoGame } = otherFeatures;
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const thread = useThreadState();
  const options = useComposerOptions(userId);
  const proposals = useProposalActions({ setMessages: thread.setMessages, invalidateBoard });
  const dino = useDinoSurface(thread.isThinking, {
    unlocked: dinoUnlocked,
    useGame: useDinoGame,
  });
  const sessionStore = useSessionStore();
  const team = useTeamMode(selection, userId, onTeamModeLeft);
  const queue = useMessageQueue();
  // Guards the opening moves against overlapping calls and remembers which one "Try again" redoes.
  const [latches] = useState(createOpeningLatches);
  const clearThread = useThreadReset({
    ...thread,
    ...queue,
    clearActionDrafts: proposals.clearActionDrafts,
    closeDinoGame: dino.closeDinoGame,
  });

  return {
    userId,
    thread,
    options,
    invalidateBoard,
    proposals,
    dino: { ...dino, dinoUnlocked },
    sessionStore,
    team,
    queue,
    latches,
    clearThread,
  };
}

export type ConversationParts = ReturnType<typeof useConversationParts>;
