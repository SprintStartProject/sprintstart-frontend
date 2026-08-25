import { Fragment } from "react";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
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
  /**
   * Why the conversation could not be brought on screen at all, if it could not.
   *
   * Distinct from a turn that failed, which carries its own reason: this one has no turn to hang
   * on, and it is the difference between "the buddy could not answer" and "there is no buddy
   * here". Passed by both surfaces, because the read is made once for both of them.
   */
  openError?: string | null;
  /** Tries the read again. The banner is only worth showing when there is something to press. */
  onRetryOpen?: () => void;
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
  openError,
  onRetryOpen,
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

      {/* Above the thread rather than in it: what failed is the whole conversation, so there is
                nothing below for it to belong to -- and on a first visit there is nothing below at
                all. `alert`, because it arrives without the hire doing anything. */}
      {openError && (
        <div
          role="alert"
          className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{openError}</span>
          {onRetryOpen && (
            <Button variant="secondary" size="sm" onClick={onRetryOpen}>
              Try again
            </Button>
          )}
        </div>
      )}

      {messages.map((message) => {
        const isUser = message.role === "USER";
        const hasText = message.content.trim().length > 0;
        const hasActions = (message.actions?.length ?? 0) > 0;

        // Until the first token (or an action proposal) arrives the streaming placeholder has
        // nothing to show, and the typing bubble below already stands in for it — so skip it,
        // otherwise an empty second bubble appears while the buddy is working. A turn that
        // failed before writing a word is the exception: its reason *is* the message, and
        // dropping it here is what made a failed reply look like no reply.
        if (!isUser && !hasText && !hasActions && !message.error) return null;

        return (
          <Fragment key={message.id}>
            {/* Everything above belongs to the last conversation; the buddy has just opened a
                            new one under it, grounded in what it remembers rather than in the text
                            above. Saying so is what stops the greeting reading as a non-sequitur
                            replying to a question from an hour ago. */}
            {message.startsVisit && (
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-app-border" aria-hidden="true" />
                <span className="text-xs font-medium text-app-text-muted">New conversation</span>
                <span className="h-px flex-1 bg-app-border" aria-hidden="true" />
              </div>
            )}

            <BuddyMessage
              speaker={isUser ? "YOU" : "BUDDY"}
              showName={showNames}
              isStreaming={message.id === streamingId}
              error={message.error}
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
          </Fragment>
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
