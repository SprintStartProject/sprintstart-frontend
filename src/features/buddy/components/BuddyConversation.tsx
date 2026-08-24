import type { ReactNode, RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessagesSquare } from "lucide-react";
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
   * Shown in place of the thread until the hire has said something (see `BuddyWelcome`).
   * Passed in rather than decided here so this component keeps one job: render a conversation.
   */
  welcome?: ReactNode;
};

/**
 * The conversation, as a card on a page rather than as the page.
 *
 * It used to be the whole viewport: a full-bleed column with a bar on top, which is the shape
 * of a phone messaging app and looked like one dropped into a desktop tool. It is a bounded
 * surface now — the app's ordinary `rounded-2xl` card, with its own title row, its own
 * scrolling body and the composer pinned to its bottom edge — so it sits inside the page grid
 * next to `BuddySidePanel` the way every other panel in this app sits inside a page.
 *
 * Bubble styling is shared with the chat page's message row rather than only with the floating
 * [BuddyPanel], so the two model surfaces in this app read as one product. What stays
 * particular to the buddy is what the buddy *does*: a live tool label in the title row instead
 * of a bare spinner, and proposals the hire confirms inline.
 *
 * It scrolls down, never sideways — `overflow-x-hidden` plus `min-w-0` down the column. The
 * card is wide, so an overflowing reply reads as a slightly odd layout rather than an obvious
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
  welcome,
}: BuddyConversationProps) {
  const prefersReducedMotion = useReducedMotion();

  // The send loop appends an empty assistant message up front and streams into it, so the
  // last turn is the one receiving tokens — that bot stays awake while every older one is
  // free to doze off.
  const streamingId = messages[messages.length - 1]?.id;

  return (
    <section
      aria-label="Conversation with your buddy"
      className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm xl:h-full xl:min-h-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border-muted px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0 text-app-brand-text" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-app-text">Conversation</h2>
        </div>

        {/* What the buddy is *doing*, where a desktop app puts a status: in the panel's
                    title row, not as a line inside the transcript. "Checking your progress…" is an
                    answer to "why is this taking a moment", which three dots are not. */}
        {isThinking && activeTool && (
          <span
            role="status"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-app-brand-soft px-2.5 py-1 text-xs font-medium text-app-brand-text"
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-brand"
              aria-hidden="true"
            />
            {toolLabel(activeTool)}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {welcome ?? (
          <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
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
                className="flex w-full gap-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <SleepyBot size={30} canSleep={false} className="text-app-brand-text" />
                </div>

                <div className="flex flex-col items-start">
                  <div
                    aria-label="Your buddy is writing"
                    className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted px-4 py-3 shadow-sm"
                  >
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
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
      />
    </section>
  );
}
