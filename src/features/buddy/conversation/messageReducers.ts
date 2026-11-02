import type { ActionPatch, BuddyMessage, BuddyMessageView, ProposedAction } from "../types";

type Messages = BuddyMessageView[];
type Citation = NonNullable<BuddyMessageView["citations"]>[number];

/** Changes the one message with this id and leaves every other message as it was. */
function updateMessage(
  messages: Messages,
  id: string,
  change: (message: BuddyMessageView) => BuddyMessageView,
): Messages {
  return messages.map((message) => (message.id === id ? change(message) : message));
}

/** The buddy's opening line, empty until its first token arrives. */
export function greetingPlaceholder(id: string, createdAt: string): BuddyMessageView {
  return { id, role: "ASSISTANT", content: "", createdAt, citations: [], isGreeting: true };
}

export function appendToken(messages: Messages, id: string, token: string): Messages {
  return updateMessage(messages, id, (message) => ({
    ...message,
    content: message.content + token,
  }));
}

/**
 * The greeting once its stream has ended.
 *
 * A greeting that wrote something stays, with the reason attached when the stream then failed. One
 * that wrote nothing is dropped — unless it is all the conversation has, where an empty bubble
 * carrying the reason is the only thing that tells the hire why nothing greeted them.
 */
export function settleGreeting(
  messages: Messages,
  id: string,
  outcome: { wroteSomething: boolean; failure: string | null },
): Messages {
  const withoutPlaceholder = messages.filter((message) => message.id !== id);

  if (!outcome.failure) return outcome.wroteSomething ? messages : withoutPlaceholder;

  if (!outcome.wroteSomething && withoutPlaceholder.length > 0) return withoutPlaceholder;

  return updateMessage(messages, id, (message) => ({ ...message, error: outcome.failure! }));
}

/** History read from the server, put in front of whatever the conversation already holds. */
export function withHistory(messages: Messages, history: BuddyMessage[]): Messages {
  return [
    ...history.map((message) => ({
      ...message,
      id: message.id ?? crypto.randomUUID(),
      isGreeting: history.length === 1 && message.role === "ASSISTANT",
    })),
    ...messages,
  ];
}

/** The hire's message and the empty answer that is about to stream in under it. */
export function withTurn(messages: Messages, user: BuddyMessageView, answer: BuddyMessageView) {
  return [...messages, user, answer];
}

/** Text the stream has produced since the last flush, appended in one go. */
export function appendChunk(
  messages: Messages,
  id: string,
  chunk: { content: string; reasoning: string },
): Messages {
  return updateMessage(messages, id, (message) => ({
    ...message,
    content: message.content + chunk.content,
    ...(chunk.reasoning ? { reasoning: (message.reasoning ?? "") + chunk.reasoning } : {}),
  }));
}

/** The answer so far thrown away, because the buddy started again. */
export function clearContent(messages: Messages, id: string): Messages {
  return updateMessage(messages, id, (message) => ({ ...message, content: "" }));
}

export function addCitation(messages: Messages, id: string, citation: Citation): Messages {
  return updateMessage(messages, id, (message) => ({
    ...message,
    citations: [...(message.citations ?? []), citation],
  }));
}

export function addActions(messages: Messages, id: string, proposed: ProposedAction[]): Messages {
  return updateMessage(messages, id, (message) => ({
    ...message,
    actions: [...(message.actions ?? []), ...proposed],
  }));
}

export function markStopped(messages: Messages, id: string): Messages {
  return updateMessage(messages, id, (message) => ({ ...message, stopped: true }));
}

export function setError(messages: Messages, id: string, reason: string): Messages {
  return updateMessage(messages, id, (message) => ({ ...message, error: reason }));
}

/** One proposed action on one message changed — confirming, resolved, dismissed. */
export function patchAction(
  messages: Messages,
  messageId: string,
  actionId: string,
  patch: ActionPatch,
): Messages {
  return updateMessage(messages, messageId, (message) => ({
    ...message,
    actions: message.actions?.map((action) =>
      action.id === actionId ? { ...action, ...patch } : action,
    ),
  }));
}
