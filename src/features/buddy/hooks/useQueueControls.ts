import { useCallback, useEffect } from "react";
import { questionBefore, withQueued, withoutQueued } from "../conversation/queueRules";
import type { TurnTracker } from "../conversation/turnTracker";
import type { BuddyMessageView, QueuedBuddyMessage } from "../types";
import type { useMessageQueue } from "./useMessageQueue";

type Queue = ReturnType<typeof useMessageQueue>;
type Parts = Pick<Queue, "commitQueued" | "setQueuePaused" | "queuedNow" | "pausedNow"> & {
  tracker: TurnTracker;
  sendMessage: (text: string) => Promise<void>;
  /** The thread as of now, not the last render. */
  messagesNow: () => BuddyMessageView[];
};

/**
 * What the composer does with the send queue: send or queue a message, re-ask a failed one, take a
 * queued one back, and release a queue Stop held.
 *
 * Also plugs the drain into the turn tracker, so a turn's close-out starts the next queued message.
 */
export function useQueueControls(parts: Parts) {
  const { tracker, sendMessage, messagesNow } = parts;
  const { commitQueued, setQueuePaused, queuedNow, pausedNow } = parts;

  /**
   * Removes one queued message and starts its turn — the queue's single exit.
   *
   * Takes the item out first, so a send that throws cannot leave the same message to be sent
   * twice. Goes through `sendMessage`, never `submitMessage`: the caller has already decided this
   * message's turn is due.
   */
  const startQueuedTurn = useCallback(
    (item: QueuedBuddyMessage) => {
      commitQueued(withoutQueued(queuedNow(), item.id));
      void sendMessage(item.text);
    },
    [commitQueued, sendMessage, queuedNow],
  );

  /**
   * The composer's entry point — and the only path a keypress or click takes to send.
   *
   * A turn already running → the message joins the queue instead of cutting the answer off.
   * Sending something new is also the hire taking over again, so a queue held back by Stop starts
   * moving without another press — whether or not a turn is running when they send.
   */
  const submitMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setQueuePaused(false);
      if (tracker.isStreaming()) {
        commitQueued(withQueued(queuedNow(), { id: crypto.randomUUID(), text }));
        return;
      }
      void sendMessage(text);
    },
    [tracker, commitQueued, setQueuePaused, sendMessage, queuedNow],
  );

  /**
   * Re-asks the question a failed turn was answering — the "Try again" under its error line.
   * Goes through `submitMessage`: idle it sends, mid-turn it queues, exactly as if the hire had
   * typed the question again. The failed pair stays in the thread.
   */
  const retryReply = useCallback(
    (messageId: string) => {
      const question = questionBefore(messagesNow(), messageId);
      if (question !== null) submitMessage(question);
    },
    [messagesNow, submitMessage],
  );

  const removeQueued = useCallback(
    (id: string) => commitQueued(withoutQueued(queuedNow(), id)),
    [commitQueued, queuedNow],
  );

  /** Takes one queued message back out, for the composer to put in the box and edit. */
  const pullQueuedMessage = useCallback(
    (id: string): string | null => {
      const item = queuedNow().find((queued) => queued.id === id);
      if (!item) return null;
      removeQueued(id);
      return item.text;
    },
    [queuedNow, removeQueued],
  );

  /**
   * Sends the oldest queued message, unless Stop is holding the queue back. Called from a turn's
   * terminal path, i.e. only ever when nothing is streaming, so it cannot race the answer it follows.
   */
  const drainNextQueued = useCallback(() => {
    const next = queuedNow()[0];
    if (!pausedNow() && next) startQueuedTurn(next);
  }, [startQueuedTurn, pausedNow, queuedNow]);

  useEffect(() => {
    tracker.onEnd(drainNextQueued);
  }, [tracker, drainNextQueued]);

  /**
   * Releases a queue Stop paused, starting with the oldest message.
   *
   * Unless a turn is running again: a message sent after Stop goes straight out while the hold
   * stays, and starting a second stream beside it would interleave two answers. The release is
   * then only the flag, and the running turn's close-out drains the queue, in order.
   */
  const resumeQueue = useCallback(() => {
    setQueuePaused(false);
    const next = queuedNow()[0];
    if (!tracker.isStreaming() && next) startQueuedTurn(next);
  }, [tracker, setQueuePaused, startQueuedTurn, queuedNow]);

  return { submitMessage, retryReply, removeQueued, pullQueuedMessage, resumeQueue };
}
