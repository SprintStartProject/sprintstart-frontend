import type { BuddyMessageView, QueuedBuddyMessage } from "../types";

/** The queue with one more message at the back. */
export function withQueued(queue: QueuedBuddyMessage[], item: QueuedBuddyMessage) {
  return [...queue, item];
}

/** The queue without one message, wherever it stood. */
export function withoutQueued(queue: QueuedBuddyMessage[], id: string): QueuedBuddyMessage[] {
  return queue.filter((item) => item.id !== id);
}

/**
 * The question a reply was answering: the hire's message nearest above it.
 *
 * `null` when the reply is not in the thread, or when nothing the hire said stands above it — a
 * turn that failed before any question (the greeting) has nothing to re-ask.
 */
export function questionBefore(messages: BuddyMessageView[], replyId: string): string | null {
  const index = messages.findIndex((message) => message.id === replyId);
  if (index < 0) return null;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i].role === "USER") return messages[i].content;
  }
  return null;
}
