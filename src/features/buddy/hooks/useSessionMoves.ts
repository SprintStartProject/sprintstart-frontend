import { useCallback, useMemo } from "react";
import {
  binSession,
  newConversation,
  selectSession,
  type MoveEnv,
} from "../conversation/sessionMoves";

type Parts = Omit<MoveEnv, "blocked"> & {
  /** Render-time state of the opening read and of a proposal decision; the latch and the synchronous gate are read live. */
  isOpening: boolean;
  isDeciding: boolean;
  isBinned: (sessionId: string) => boolean;
};

/**
 * The hire's moves across their conversations: pick one from the list, start a new one, bin one.
 *
 * The rules are in `conversation/sessionMoves`; this only hands them the live readers. "Blocked"
 * is asked of the latest render's state and of the synchronous decision gate together — a decision
 * and a click can land in one frame, before the "deciding" state has re-rendered.
 */
export function useSessionMoves(parts: Parts) {
  const { isOpening, isDeciding, isBinned, ...rest } = parts;
  const { latches, decidingNow } = rest;

  const blocked = useCallback(
    () => latches.isBusy() || isOpening || isDeciding || decidingNow(),
    [latches, isOpening, isDeciding, decidingNow],
  );
  const env = useMoveEnv(rest, blocked);

  const select = useCallback((sessionId: string) => selectSession(env, sessionId), [env]);
  const start = useCallback(() => newConversation(env), [env]);
  const bin = useCallback((sessionId: string) => binSession(env, sessionId), [env]);
  /**
   * Whether a conversation was binned in this app session — what the composer asks before it
   * files a draft under one it is leaving, since a binned conversation has nothing to keep it for.
   */
  const isSessionBinned = useCallback((sessionId: string) => isBinned(sessionId), [isBinned]);

  return {
    selectSession: select,
    newConversation: start,
    binSession: bin,
    isSessionBinned,
  };
}

function useMoveEnv(
  rest: Omit<Parts, "isOpening" | "isDeciding" | "isBinned">,
  blocked: () => boolean,
) {
  const { latches, tracker, decidingNow, currentSessionNow, sessionsNow, teamProjectNow } = rest;
  const { applySessions, applyCurrentSession, markBinned, clearThread, setOpenError } = rest;
  const { stopRunningTurn, openSession, userId } = rest;

  return useMemo<MoveEnv>(
    () => ({
      latches,
      tracker,
      blocked,
      decidingNow,
      currentSessionNow,
      sessionsNow,
      teamProjectNow,
      applySessions,
      applyCurrentSession,
      markBinned,
      clearThread,
      setOpenError,
      stopRunningTurn,
      openSession,
      userId,
    }),
    [
      latches,
      tracker,
      blocked,
      decidingNow,
      currentSessionNow,
      sessionsNow,
      teamProjectNow,
      applySessions,
      applyCurrentSession,
      markBinned,
      clearThread,
      setOpenError,
      stopRunningTurn,
      openSession,
      userId,
    ],
  );
}
