import { useCallback, useRef, useState } from "react";
import type { QueuedBuddyMessage } from "../types";

/**
 * Messages submitted while a turn was still running, oldest first — the visible queue — and
 * whether it is paused.
 *
 * Held in refs as well as in state, written through `commitQueued` and `setQueuePaused`: the drain
 * runs from the send path's terminal `finally` (a callback, not a render) and has to read the queue
 * as it is *now*, while the state half is what the composer's strip renders.
 */
export function useMessageQueue() {
  const [queued, setQueued] = useState<QueuedBuddyMessage[]>([]);
  const queuedRef = useRef<QueuedBuddyMessage[]>([]);
  const commitQueued = useCallback((next: QueuedBuddyMessage[]) => {
    queuedRef.current = next;
    setQueued(next);
  }, []);

  // Same split for the paused flag: Stop sets it and the drain reads it, neither inside a
  // render. A paused queue keeps its messages, visible in the strip with a "Send queued"
  // button — Stop means "stop doing things", not "throw away what I wrote".
  const [queuePaused, setQueuePausedState] = useState(false);
  const queuePausedRef = useRef(false);
  const setQueuePaused = useCallback((paused: boolean) => {
    queuePausedRef.current = paused;
    setQueuePausedState(paused);
  }, []);

  /** The queue as it is right now, for callbacks that must not wait for a render. */
  const queuedNow = useCallback(() => queuedRef.current, []);
  const pausedNow = useCallback(() => queuePausedRef.current, []);

  return { queued, queuePaused, commitQueued, setQueuePaused, queuedNow, pausedNow };
}
