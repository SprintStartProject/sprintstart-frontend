import { motion, useReducedMotion } from "framer-motion";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { BuddyMessageView, ProposedAction } from "../types";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";

type BuddyTurnProps = {
  message: BuddyMessageView;
  /** True for the turn currently receiving tokens — that bot is visibly working, so it stays awake. */
  isStreaming?: boolean;
  onConfirm: (messageId: string, action: ProposedAction) => void;
  onDismiss: (messageId: string, actionId: string) => void;
};

/**
 * One turn of the conversation, as a **transcript entry rather than a chat bubble**.
 *
 * This is the change that stops the buddy looking like a phone messenger. Opposing bubbles
 * pinned to the left and right edges are the visual signature of one — and no desktop tool
 * reads that way. Both speakers start at the same left margin here, each under its own name,
 * the way a transcript or a document does. The hire's question is set in a quiet block so it
 * is still findable when scanning back; the reply is plain prose on the surface, because it is
 * the content and does not need a container to prove it.
 *
 * Role is carried by the name and the avatar, never by which side of the panel something is
 * on and never by colour alone — a right-aligned bubble is invisible to a screen reader and
 * useless to anyone reading the transcript linearly.
 *
 * The measure is capped on the text, not on the column: the card is wide on a desktop, and a
 * reply running the full width of it would be unreadable, but centring a narrow column inside
 * a wide card is exactly the phone layout in a different frame.
 *
 * Shared by the dock and the full page, so a turn reads the same wherever the hire meets it —
 * the dock is simply narrower, and the same markup wraps into it.
 */
export function BuddyTurn({ message, isStreaming = false, onConfirm, onDismiss }: BuddyTurnProps) {
  const prefersReducedMotion = useReducedMotion();
  const isUser = message.role === "USER";
  const hasText = message.content.trim().length > 0;

  // A turn arrives rather than appearing mid-frame — the short rise the escalation card and
  // the admin drawer's rows use, so everything in the app enters at one cadence.
  const entrance = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.article
      {...entrance}
      aria-label={isUser ? "Your message" : "Your buddy's reply"}
      className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2rem_minmax(0,1fr)]"
    >
      <div className="flex size-7 items-center justify-center sm:size-8">
        {isUser ? (
          <UserAvatar fallbackName="You" size={28} />
        ) : (
          // Every reply gets a bot that can doze off; each draws its own idle window, so a
          // long thread nods off raggedly rather than all at once. The turn currently
          // receiving tokens is held awake — that one is visibly working.
          <SleepyBot size={28} canSleep={!isStreaming} className="text-app-brand-text" />
        )}
      </div>

      <p className="self-center text-xs font-semibold tracking-wide text-app-text-muted uppercase">
        {isUser ? "You" : "Buddy"}
      </p>

      {/* Column two of row two: the avatar column stays empty, so the content lines up under
                the name rather than under the glyph. */}
      <div className="col-start-2 mt-1.5 flex min-w-0 flex-col gap-2">
        {hasText &&
          (isUser ? (
            <p className="max-w-[70ch] rounded-xl border border-app-border-muted bg-app-surface-muted/70 px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-app-text">
              {message.content}
            </p>
          ) : (
            // `min-w-0` unbroken from here down is what lets `BuddyMarkdown`'s per-block
            // scrollers engage: a grid item's default `min-width: auto` refuses to shrink
            // below its content, so a wide code block would widen the turn instead.
            <div className="max-w-[75ch] min-w-0 text-sm leading-relaxed break-words text-app-text">
              <BuddyMarkdown content={message.content} />
            </div>
          ))}

        {!isUser && message.actions && message.actions.length > 0 && (
          <BuddyActionProposals
            messageId={message.id}
            actions={message.actions}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        )}
      </div>
    </motion.article>
  );
}

/**
 * The turn the buddy has not written yet — same shape as a real one, so the thread does not
 * jump when the first token lands.
 */
export function BuddyThinkingTurn({ label }: { label?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      {...(prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
          })}
      role="status"
      className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2rem_minmax(0,1fr)]"
    >
      <div className="flex size-7 items-center justify-center sm:size-8">
        <SleepyBot size={28} canSleep={false} className="text-app-brand-text" />
      </div>

      <p className="self-center text-xs font-semibold tracking-wide text-app-text-muted uppercase">
        Buddy
      </p>

      <div className="col-start-2 mt-1.5 flex items-center gap-2">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
        </span>
        {/* What it is *doing*, when the backend says so. "Checking your progress…" answers
                    "why is this taking a moment"; three dots do not. */}
        {label && <span className="text-sm text-app-text-muted italic">{label}</span>}
      </div>
    </motion.div>
  );
}
