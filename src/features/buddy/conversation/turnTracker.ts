/**
 * What the conversation knows about its message turns, held in plain variables rather than React
 * state: every reader (the composer, a conversation switch, a queued send) has to see the answer
 * in the same tick a turn starts, before any render could have carried it.
 */
export function createTurnTracker() {
  let controller: AbortController | null = null;
  let streaming = false;
  let sends = 0;
  let inFlight: Promise<void> | null = null;
  let drain: () => void = () => {};

  return {
    /**
     * Claims the turn slot: counts the send, hands out the handle Stop reaches for and marks a
     * turn as running. `newConversation` compares the count across its create round trip to tell
     * that a send began meanwhile.
     */
    begin(): AbortController {
      sends += 1;
      controller = new AbortController();
      streaming = true;
      return controller;
    },

    /**
     * Releases the slot once a turn is over, then lets the next queued message go. Only the
     * current turn's own handle is dropped: an older turn ending must not orphan a newer one.
     */
    end(finished: AbortController): void {
      if (controller === finished) controller = null;
      streaming = false;
      drain();
    },

    /** Where the queue's drain plugs in: the turn's close-out calls it, so the queue starts the next one. */
    onEnd(next: () => void): void {
      drain = next;
    },

    isStreaming: () => streaming,
    hasRunningHandle: () => controller !== null,
    sendCount: () => sends,

    /** Aborts the running turn, if any. */
    abort(): void {
      controller?.abort();
    },

    /**
     * Remembers the running turn's promise so a move to another conversation can wait for its
     * close-out. Only the latest turn clears it: a queued message starts from inside the closing
     * turn, so the slot may already hold the next one.
     */
    track(turn: Promise<void>): void {
      inFlight = turn;
      const release = () => {
        if (inFlight === turn) inFlight = null;
      };
      void turn.then(release, release);
    },

    /** Settles once the running turn has closed out; never rejects, the turn reports its own failures. */
    async settled(): Promise<void> {
      try {
        await inFlight;
      } catch {
        // Only waiting for it to be over.
      }
    },
  };
}

export type TurnTracker = ReturnType<typeof createTurnTracker>;
