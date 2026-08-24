import { motion, useReducedMotion } from "framer-motion";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { BuddyMessageView, ProposedAction } from "../types";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";

type BuddyMessageBubbleProps = {
  message: BuddyMessageView;
  /** True for the turn currently receiving tokens — that bot is visibly working, so it stays awake. */
  isStreaming?: boolean;
  onConfirm: (messageId: string, action: ProposedAction) => void;
  onDismiss: (messageId: string, actionId: string) => void;
};

/**
 * One turn of the conversation.
 *
 * The bubble is the chat page's bubble — same radius, same one clipped corner on the speaker's
 * side, same border and resting shadow — because a hire who has used `/chat` should not have to
 * learn a second visual language to read `/buddy`. The avatar is the same character too: the
 * `SleepyBot` that answers on the chat page, rather than a static icon, so the buddy has a face
 * instead of a glyph.
 *
 * `break-words` on the bubble and `min-w-0` down the column are what keep a wide reply inside
 * the thread instead of widening it — see `BuddyMarkdown` for the per-block half of that rule.
 */
export function BuddyMessageBubble({
  message,
  isStreaming = false,
  onConfirm,
  onDismiss,
}: BuddyMessageBubbleProps) {
  const prefersReducedMotion = useReducedMotion();
  const isUser = message.role === "USER";
  const hasText = message.content.trim().length > 0;

  // A turn arrives rather than appearing mid-frame: the same short rise the escalation card
  // and the admin drawer's rows use, so everything in the app enters at one cadence.
  const entrance = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.div
      {...entrance}
      className={`flex w-full gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* No disc behind the bot: the drawn glyph has a silhouette of its own, and a ring
                around it reads as a badge holding a tiny icon rather than as a character. Same
                call the chat page's message row made. */}
      <div className="flex size-8 shrink-0 items-center justify-center">
        {isUser ? (
          <UserAvatar fallbackName="You" size={32} />
        ) : (
          <SleepyBot size={30} canSleep={!isStreaming} className="text-app-brand-text" />
        )}
      </div>

      {/* The chat page's two measures, kept identical here: a reply gets more room than a
                question, because one is prose and the other is a line somebody typed. */}
      <div
        className={`flex min-w-0 flex-col ${isUser ? "max-w-[70%] items-end" : "max-w-[85%] items-start"}`}
      >
        {hasText && (
          <div
            className={`max-w-full min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm ${
              isUser
                ? "rounded-tr-sm bg-app-brand whitespace-pre-wrap text-white"
                : "rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text"
            }`}
          >
            {isUser ? message.content : <BuddyMarkdown content={message.content} />}
          </div>
        )}

        {!isUser && message.actions && message.actions.length > 0 && (
          <BuddyActionProposals
            messageId={message.id}
            actions={message.actions}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        )}
      </div>
    </motion.div>
  );
}
