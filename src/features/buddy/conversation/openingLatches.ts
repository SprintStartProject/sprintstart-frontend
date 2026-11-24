/** The move a failed banner's "Try again" must redo, when it is not the opening read itself. */
export type RetryMove = "newConversation";

/**
 * The flags that keep the conversation's opening moves from overlapping, as plain variables:
 * each is read in the same tick it is written (a click and a mount effect can land in one
 * frame), before any render could carry it.
 */
export function createOpeningLatches() {
  let loaded = false;
  let greeting = false;
  let retry: RetryMove | null = null;

  return {
    /**
     * Claims the once-per-conversation opening read. `false` when it is already claimed, so the
     * dock's mount effect and the page's can both call without either double-fetching.
     */
    claimLoad(): boolean {
      if (loaded) return false;
      loaded = true;
      return true;
    },
    /**
     * Gives the claim back, so the next opening read runs: after a failure ("Try again" is the
     * only way back) and when the conversation changes under it.
     */
    releaseLoad(): void {
      loaded = false;
    },

    /** Whether a greeting or a conversation move holds the thread — the guard against overlapping calls. */
    isBusy: () => greeting,
    setBusy(next: boolean): void {
      greeting = next;
    },

    /** Which move "Try again" redoes; `null` means the opening read. Set by the failure site, consumed by `retryOpen`. */
    retryMove: (): RetryMove | null => retry,
    setRetryMove(next: RetryMove | null): void {
      retry = next;
    },
  };
}

export type OpeningLatches = ReturnType<typeof createOpeningLatches>;
