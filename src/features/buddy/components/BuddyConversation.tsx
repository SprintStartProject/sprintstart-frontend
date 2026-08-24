import type { ReactNode, RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toolLabel } from "../toolLabel";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyMessageBubble } from "./BuddyMessageBubble";

type BuddyConversationProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /** The tool the buddy is running right now, if any — shown as "Checking your progress…". */
  activeTool: string | null;
  draft: string;
  setDraft: (value: string) => void;
  handleSubmit: (event: React.FormEvent) => void;
  /** Confirms a buddy-proposed action (the only path that mutates). */
  confirmAction: (messageId: string, action: ProposedAction) => void;
  /** Declines a proposed action; nothing changes. */
  dismissAction: (messageId: string, actionId: string) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
  /** Composer placeholder — "Type your answer…" while the buddy is intaking. */
  placeholder?: string;
  /**
   * Rendered inside the scroller, above the thread — the record of what the hire asked a
   * person. It scrolls with the conversation rather than sitting pinned between the header
   * and the transcript, which is what used to push the thread halfway down the page.
   */
  topSlot?: ReactNode;
  /**
   * Shown in place of the thread until the hire has said something (see `BuddyWelcome`).
   * Passed in rather than decided here so this component keeps one job: render a conversation.
   */
  welcome?: ReactNode;
  /** The quiet row under the composer — the escalation trigger, once there is a question to flag. */
  composerFooter?: ReactNode;
};

/**
 * The full-page buddy conversation used by the `/buddy` home: the thread, and the box you
 * answer it in.
 *
 * Bubble styling is shared with the chat page's message row rather than with the floating
 * [BuddyPanel] alone, so the two model surfaces in this app read as one product. What stays
 * particular to the buddy is what the buddy does: a tool label instead of a bare spinner, and
 * proposals the hire confirms inline.
 *
 * It scrolls down, never sideways — `overflow-x-hidden` plus `min-w-0` down the column. This
 * page is wide, so an overflowing reply reads as a slightly odd layout rather than an obvious
 * bug, which is how such a regression survives review; see `BuddyPanel` for the full rule.
 */
export function BuddyConversation({
  messages,
  isThinking,
  activeTool,
  draft,
  setDraft,
  handleSubmit,
  confirmAction,
  dismissAction,
  bottomRef,
  placeholder,
  topSlot,
  welcome,
  composerFooter,
}: BuddyConversationProps) {
  const prefersReducedMotion = useReducedMotion();

  // The send loop appends an empty assistant message up front and streams into it, so the
  // last turn is the one receiving tokens — that bot stays awake while every older one is
  // free to doze off.
  const streamingId = messages[messages.length - 1]?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {topSlot}

        {welcome ?? (
          <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 px-4 py-6">
            {messages.map((message) => {
              const isUser = message.role === "USER";
              const hasText = message.content.trim().length > 0;
              const hasActions = (message.actions?.length ?? 0) > 0;

              // Until the first token (or an action proposal) arrives the streaming
              // placeholder has nothing to show, and the `isThinking` indicator below
              // already stands in for it — so skip it, otherwise an empty second bubble
              // appears while the buddy is thinking.
              if (!isUser && !hasText && !hasActions) {
                return null;
              }

              return (
                <BuddyMessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingId}
                  onConfirm={confirmAction}
                  onDismiss={dismissAction}
                />
              );
            })}

            {isThinking && (
              <motion.div
                {...(prefersReducedMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 10 },
                      animate: { opacity: 1, y: 0 },
                      transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
                    })}
                role="status"
                className="flex w-full gap-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <SleepyBot size={30} canSleep={false} className="text-app-brand-text" />
                </div>

                <div className="flex max-w-[85%] flex-col items-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted px-4 py-2.5 shadow-sm">
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
                    </span>
                    {/* What it is *doing*, when the backend says — "Checking your
                                        progress…" is an answer to "why is this taking a moment",
                                        which three dots are not. */}
                    {activeTool && (
                      <span className="text-sm text-app-text-muted italic">
                        {toolLabel(activeTool)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <BuddyComposer
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        placeholder={placeholder}
        footer={composerFooter}
      />
    </div>
  );
}
