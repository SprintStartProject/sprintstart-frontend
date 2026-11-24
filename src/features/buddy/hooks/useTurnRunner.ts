import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { BuddyOpeningAction } from "../../../services/buddyService";
import { runTurn, type TurnEnv, type TurnSession } from "../conversation/runTurn";
import { createTurnTracker } from "../conversation/turnTracker";
import type { TurnView } from "../conversation/streamHandlers";

type TurnParts = TurnView &
  TurnSession & {
    setOpenerAction: Dispatch<SetStateAction<BuddyOpeningAction | null>>;
    invalidateBoard: () => void;
    onResolveFailed: () => void;
    commitQueued: (next: never[]) => void;
    setQueuePaused: (paused: boolean) => void;
    /**
     * Called when a move to another conversation cut a running answer short, so the surface can
     * say so — the answer went on in a conversation the hire has left.
     */
    onTurnStopped?: () => void;
  };

/**
 * The message turns: sending one, stopping the one that is running, and cutting it short for a
 * move to another conversation.
 *
 * What the rest of the conversation needs to know about the running turn — is one streaming, how
 * many sends have started — is read from the returned `tracker`, which answers in the same tick a
 * turn starts rather than a render later.
 */
export function useTurnRunner(parts: TurnParts) {
  const [tracker] = useState(createTurnTracker);
  const { commitQueued, setQueuePaused, onTurnStopped } = parts;
  const onTurnStoppedRef = useRef(onTurnStopped);
  useEffect(() => {
    onTurnStoppedRef.current = onTurnStopped;
  });

  const env = useTurnEnv(parts, tracker);

  const sendMessage = useCallback(
    (text: string): Promise<void> => {
      const turn = runTurn(env, text);
      tracker.track(turn);
      return turn;
    },
    [env, tracker],
  );

  /**
   * Stops the reply being written, keeping what arrived. A no-op when nothing is streaming, so the
   * button it is bound to needs no separate guard. Stop holds the queue too: the messages stay in
   * the strip with a "Send queued" button rather than being dropped or sent.
   */
  const stopStreaming = useCallback(() => {
    if (!tracker.hasRunningHandle()) return;
    setQueuePaused(true);
    tracker.abort();
  }, [tracker, setQueuePaused]);

  /**
   * Cuts the running answer short and waits until its close-out has run — the first half of every
   * move that clears the thread, so none of them has to refuse while a turn is writing.
   *
   * Stop, minus the pause: the queue is not held back but emptied, because what was queued was
   * written for the conversation being left, and the closing turn would otherwise drain it into
   * that conversation.
   */
  const stopRunningTurn = useCallback(async () => {
    commitQueued([]);
    tracker.abort();
    onTurnStoppedRef.current?.();
    await tracker.settled();
  }, [tracker, commitQueued]);

  return { tracker, sendMessage, stopStreaming, stopRunningTurn };
}

function useTurnEnv(parts: TurnParts, tracker: TurnEnv["tracker"]): TurnEnv {
  const { setMessages, setIsThinking, setIsStreaming, setActiveTool, setOpenerAction } = parts;
  const { teamProjectNow, currentSessionNow, sessionsNow, resolveHireSession } = parts;
  const { refreshSessions, capabilitiesNow, filtersNow, invalidateBoard, onResolveFailed } = parts;

  return useMemo(
    () => ({
      tracker,
      view: { setMessages, setIsThinking, setIsStreaming, setActiveTool, setOpenerAction },
      session: {
        teamProjectNow,
        currentSessionNow,
        sessionsNow,
        resolveHireSession,
        refreshSessions,
        capabilitiesNow,
        filtersNow,
      },
      invalidateBoard,
      onResolveFailed,
    }),
    [
      tracker,
      setMessages,
      setIsThinking,
      setIsStreaming,
      setActiveTool,
      setOpenerAction,
      teamProjectNow,
      currentSessionNow,
      sessionsNow,
      resolveHireSession,
      refreshSessions,
      capabilitiesNow,
      filtersNow,
      invalidateBoard,
      onResolveFailed,
    ],
  );
}
