import type { ReactNode } from "react";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toolLabel } from "../toolLabel";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";
import { BuddyMessage, BuddyTypingMessage } from "./BuddyMessage";

type BuddyThreadProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /** The tool the buddy is running right now, if any — becomes "Checking your progress…". */
  activeTool: string | null;
  /** Confirms a buddy-proposed action (the only path that mutates). */
  confirmAction: (messageId: string, action: ProposedAction) => void;
  /** Declines a proposed action; nothing changes. */
  dismissAction: (messageId: string, actionId: string) => void;
  /** Names above the bubbles — on for the page, off in the dock. */
  showNames?: boolean;
  /** Rendered above the first message: what came back from the hire's PM. */
  before?: ReactNode;
  /**
   * Rendered under the buddy's most recent reply — the greeting's suggested next step.
   */
  lastMessageFooter?: ReactNode;
  /**
   * Rendered under each of the hire's *own* questions, handed that question's text.
   *
   * This is where escalating belongs. It hung off the buddy's answer before, which read as a
   * verdict on the reply — but a hire does not flag an answer, they flag the question they
   * still need answered, and they may well want to send one they asked ten minutes ago. Under
   * every question, they can. Both surfaces pass it, so the corner window can escalate too.
   */
  renderQuestionAction?: (question: string) => ReactNode;
};

/**
 * The conversation itself: every message, in order, with whoever is talking beside it.
 *
 * Shared by the dock and the page so there is one buddy with one voice, not two components
 * that drift. The only differences are the ones the width forces: names above the bubbles on
 * the page, none in the dock.
 *
 * It scrolls down, never sideways. `min-w-0` runs unbroken from here to `BuddyMarkdown`,
 * because a flex item's default `min-width: auto` refuses to shrink below its content — without
 * it a wide code block widens the bubble, the column and the panel, and the per-block scrollers
 * never engage.
 */
export function BuddyThread({
  messages,
  isThinking,
  activeTool,
  confirmAction,
  dismissAction,
  showNames = false,
  before,
  lastMessageFooter,
  renderQuestionAction,
}: BuddyThreadProps) {
  // The send loop appends an empty assistant message up front and streams into it, so the last
  // one is the turn receiving tokens.
  const streamingId = messages[messages.length - 1]?.id;

  // Which message the escalation offer hangs under: the buddy's most recent reply. Not every
  // reply — an offer to give up repeated under all of them reads as the buddy expecting to fail.
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "ASSISTANT" && message.content.trim().length > 0)?.id;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {before}

      {messages.map((message) => {
        const isUser = message.role === "USER";
        const hasText = message.content.trim().length > 0;
        const hasActions = (message.actions?.length ?? 0) > 0;

        // Until the first token (or an action proposal) arrives the streaming placeholder has
        // nothing to show, and the typing bubble below already stands in for it — so skip it,
        // otherwise an empty second bubble appears while the buddy is working.
        if (!isUser && !hasText && !hasActions) return null;

        return (
          <BuddyMessage
            key={message.id}
            speaker={isUser ? "YOU" : "BUDDY"}
            showName={showNames}
            isStreaming={message.id === streamingId}
            footer={
              <>
                {isUser && renderQuestionAction?.(message.content)}
                {!isUser && hasActions && (
                  <BuddyActionProposals
                    messageId={message.id}
                    actions={message.actions ?? []}
                    onConfirm={confirmAction}
                    onDismiss={dismissAction}
                  />
                )}
                {!isThinking && message.id === lastAssistantId && lastMessageFooter}
              </>
            }
          >
            {hasText ? (
              isUser ? (
                message.content
              ) : (
                <BuddyMarkdown content={message.content} />
              )
            ) : undefined}
          </BuddyMessage>
        );
      })}

      {isThinking && (
        <BuddyTypingMessage
          label={activeTool ? toolLabel(activeTool) : undefined}
          showName={showNames}
        />
      )}
    </div>
  );
}
