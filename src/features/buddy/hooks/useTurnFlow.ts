import { useCallback } from "react";
import { reportOpenFailure } from "../conversation/openFailure";
import type { ConversationParts } from "./useConversationParts";
import { useSessionResolution } from "./useSessionResolution";
import { useTurnRunner } from "./useTurnRunner";

/**
 * Sending: finding the conversation to speak into, and running the message turns in it.
 *
 * `onTurnStopped` is called when a move to another conversation cut a running answer short, so the
 * surface can say so — the answer went on in a conversation the hire has left.
 */
export function useTurnFlow(parts: ConversationParts, onTurnStopped: (() => void) | undefined) {
  const { thread, options, sessionStore, team, queue, latches, invalidateBoard } = parts;
  const { setOpenError } = thread;

  const { resolveHireSession, refreshSessions } = useSessionResolution(sessionStore);

  const onResolveFailed = useCallback(
    () => reportOpenFailure(latches, setOpenError),
    [latches, setOpenError],
  );

  const runner = useTurnRunner({
    ...thread,
    ...options,
    ...queue,
    teamProjectNow: team.teamProjectNow,
    currentSessionNow: sessionStore.currentSessionNow,
    sessionsNow: sessionStore.sessionsNow,
    resolveHireSession,
    refreshSessions,
    invalidateBoard,
    onResolveFailed,
    onTurnStopped,
  });

  return { ...runner, resolveHireSession, refreshSessions };
}

export type TurnFlow = ReturnType<typeof useTurnFlow>;
