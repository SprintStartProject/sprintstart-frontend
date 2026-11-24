import { buddyQuery } from "./buddyQuery";
import { readBuddyStream } from "./readBuddyStream";
import type { BuddyStreamChunk } from "./streamChunk";
import type { BuddyOpeningAction } from "./suggestions";

/** How a caller receives a visit's greeting as it is written. */
export interface BuddyOpeningHandlers {
  onToken: (token: string) => void;
  /** The one suggested next step, if the mentor offered one. Arrives before `onDone`. */
  onAction?: (action: BuddyOpeningAction) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}

function relayOpeningAction(handlers: BuddyOpeningHandlers, chunk: BuddyStreamChunk): void {
  // Not an action proposal. `action_proposal` means the buddy is offering to *do*
  // something and is gated on the hire confirming; this only fills the composer.
  if (chunk.label && chunk.question) {
    handlers.onAction?.({ label: chunk.label, question: chunk.question });
  }
}

function handleOpeningChunk(
  handlers: BuddyOpeningHandlers,
  chunk: BuddyStreamChunk,
): "stop" | void {
  switch (chunk.type) {
    case "token":
      if (chunk.content !== undefined) handlers.onToken(chunk.content);
      break;
    case "opening_action":
      relayOpeningAction(handlers, chunk);
      break;
    case "done":
      handlers.onDone();
      return "stop";
    case "error":
      handlers.onError?.(chunk.message ?? "The buddy could not be reached.");
      return "stop";
  }
}

/**
 * Opens a buddy visit, streaming the greeting as the mentor writes it.
 *
 * The mentor greets the hire grounded in their durable memory and current state; the past
 * transcript is not replayed — a visit starts fresh with this greeting.
 *
 * The first token can still be tens of seconds away. The greeting is written before
 * anything the hire never sees, so nothing is queued behind invisible output — but the model is
 * remote and conditionally reasoning, and it emits nothing while it thinks. Handlers must treat a
 * long silence before the first token as normal, not as a failed stream.
 *
 * Opening twice without the hire saying anything is the same visit: the greeting already there is
 * replayed whole and no model is called.
 *
 * @param handlers - How the streamed greeting is received.
 * @param sessionId - The conversation to open. Required for the hire's own conversations.
 * @param teamProjectId - Pass to open a *team-mode* visit with a managed project instead of the
 *   hire's own conversation — the backend greets a manager about their team there.
 */
export async function streamOpenBuddy(
  handlers: BuddyOpeningHandlers,
  sessionId: string | undefined,
  teamProjectId?: string,
): Promise<void> {
  const outcome = await readBuddyStream(
    `/api/v1/onboarding/me/buddy/open/stream${buddyQuery({ sessionId, teamProjectId })}`,
    undefined,
    (chunk) => handleOpeningChunk(handlers, chunk),
    handlers.onError,
  );

  // The greeting is all there is here, so a body that ends without a terminal event still
  // finished it -- the page must stop waiting either way.
  if (outcome === "ended") handlers.onDone();
}
