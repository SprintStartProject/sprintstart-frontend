import type { Dispatch, SetStateAction } from "react";
import type { OpeningLatches } from "./openingLatches";
import { HISTORY_FAILED } from "./replyMessages";

/**
 * Puts up the banner for a conversation that could not be read.
 *
 * This failure owns the banner: "Try again" must redo this read, so a stale "new conversation"
 * marker from an earlier failed move is forgotten.
 */
export function reportOpenFailure(
  latches: OpeningLatches,
  setOpenError: Dispatch<SetStateAction<string | null>>,
): void {
  latches.setRetryMove(null);
  setOpenError(HISTORY_FAILED);
}

/** Whether anything is in flight that the thread cannot be cleared under. */
export function threadBusy(flags: {
  isThinking: boolean;
  isStreaming: boolean;
  isOpening: boolean;
  isGreeting: boolean;
  isDeciding: boolean;
}): boolean {
  return (
    flags.isThinking || flags.isStreaming || flags.isOpening || flags.isGreeting || flags.isDeciding
  );
}
