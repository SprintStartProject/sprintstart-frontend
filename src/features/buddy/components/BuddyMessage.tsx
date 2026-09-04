import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, UserRound } from "lucide-react";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { useAuth } from "../../../context/useAuth";

/** Who is talking. Three, because a hire's PM really does answer in here. */
export type BuddySpeaker = "BUDDY" | "YOU" | "PM";

const SPEAKER_NAME: Record<BuddySpeaker, string> = {
  BUDDY: "Buddy",
  YOU: "You",
  PM: "Your PM",
};

type BuddyMessageProps = {
  speaker: BuddySpeaker;
  /**
   * The bubble's contents — plain text for a person, rendered Markdown for the buddy. Left out
   * for a turn that is nothing but a proposal: the buddy offered to do something and wrote no
   * words with it, and an empty bubble above the offer is a message that says nothing.
   */
  children?: ReactNode;
  /**
   * Puts the speaker's name above the bubble. On for the page, off in the dock, where the
   * column is narrow and the avatars are two apart rather than twenty.
   */
  showName?: boolean;
  /** A quiet line under the bubble — a timestamp, or who answered and when. */
  meta?: ReactNode;
  /**
   * Why this turn has no answer in it, when a stream failed rather than finished.
   *
   * Sits beside the bubble rather than replacing it: whatever streamed before the failure is
   * still the buddy's answer, and half an answer plus the reason it stopped is more use than
   * either alone. A turn that failed before writing anything has no bubble at all, and then
   * this is the whole message.
   */
  error?: string;
  /** Rendered under the bubble, inside the speaker's column: the escalation offer, mostly. */
  footer?: ReactNode;
  /** True for the turn currently receiving tokens — that bot is working, so it stays awake. */
  isStreaming?: boolean;
};

/**
 * One message in the conversation.
 *
 * This *is* a chat, and it is meant to look like one: a face, a name, a bubble that leans
 * towards whoever said it. The buddy is a mentor a hire talks to, and the surest way to make
 * that feel like paperwork was to render it as an unattributed wall of prose — you could not
 * tell at a glance that the words were the buddy's rather than the page's.
 *
 * Attribution is carried three times over, because each covers a gap the others leave: the
 * avatar (recognisable at a glance), the name (the only one a screen reader can read out, and
 * the only one that survives someone who cannot tell the two bubble colours apart), and the
 * side. Never the colour alone.
 *
 * `PM` is not decoration. When a hire escalates a question, a *person* answers it, and showing
 * that reply in the buddy's voice would hide that a human was involved — so their answer gets
 * its own face and its own name in the same thread.
 *
 * Shared by the dock and the page, so a message reads the same wherever the hire meets it. The
 * dock is simply narrower, and the same markup wraps into it.
 */
export function BuddyMessage({
  speaker,
  children,
  showName = false,
  meta,
  error,
  footer,
  isStreaming = false,
}: BuddyMessageProps) {
  const prefersReducedMotion = useReducedMotion();
  const isYou = speaker === "YOU";

  const entrance = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.div
      {...entrance}
      className={`flex w-full min-w-0 gap-2.5 ${isYou ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="flex size-8 shrink-0 items-center justify-center">
        <SpeakerAvatar speaker={speaker} isStreaming={isStreaming} />
      </div>

      <div
        // The reading measure lives here, not on the thread's column. The page runs the full
        // `app-page-frame` width like its siblings, and the bubble is what keeps a line short
        // enough to track back to: it hugs its speaker's edge and stops at 46rem. Capping the
        // column instead would have put the narrow centred layout back under another name.
        //
        // The buddy's own column then *fills* that measure rather than hugging its contents,
        // because the buddy's turn is the one that streams: a box re-measured on every token
        // widens word by word and snaps back whenever a re-parse changes the rendered markdown,
        // which is unreadable while it is being written. Everyone else's turns arrive whole and
        // still hug. Same rule, and the same reason, as `MessageRow` in the chat.
        className={`flex max-w-[min(85%,46rem)] min-w-0 flex-col gap-1 ${
          isYou ? "items-end" : "items-start"
        } ${speaker === "BUDDY" ? "w-full" : ""}`}
      >
        {showName && (
          <p className="px-1 text-xs font-medium text-app-text-muted">{SPEAKER_NAME[speaker]}</p>
        )}

        {children !== undefined && (
          <div
            className={`max-w-full min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm ${
              speaker === "BUDDY" ? "w-full" : ""
            } ${bubbleClasses(speaker)}`}
          >
            {children}
          </div>
        )}

        {error && (
          <div
            className={`flex max-w-full min-w-0 items-start gap-2 rounded-2xl rounded-tl-sm border border-app-danger-border bg-app-danger-bg px-4 py-2.5 text-sm leading-relaxed text-app-danger-text ${
              children === undefined ? "" : "mt-1"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {meta && <p className="px-1 text-[11px] text-app-text-disabled">{meta}</p>}
        {footer}
      </div>
    </motion.div>
  );
}

/**
 * The bubble's own clothes. The clipped corner points back at the speaker's avatar, which is
 * the detail that makes a stack of bubbles read as a conversation rather than as a list.
 *
 * The PM's bubble is deliberately *not* a third colour: two speakers a hire has to tell apart
 * at a glance is plenty, and a third accent competing with the brand would say "status" rather
 * than "somebody else". Their name and face carry it instead.
 */
function bubbleClasses(speaker: BuddySpeaker): string {
  if (speaker === "YOU") {
    return "rounded-tr-sm bg-app-brand whitespace-pre-wrap text-white";
  }
  if (speaker === "PM") {
    return "rounded-tl-sm border border-app-border bg-app-surface-muted whitespace-pre-wrap text-app-text";
  }
  return "rounded-tl-sm border border-app-border-muted bg-app-surface text-app-text";
}

/**
 * The face beside the bubble.
 *
 * The hire's own face is the one they picked in their settings, read from the profile here
 * rather than passed in: `BuddyMessage` is rendered from three places (the page, the dock and
 * the thread's own map), and threading the same three profile fields through all of them to
 * reach one leaf is more moving parts than a context read. It was `fallbackName="You"` with no
 * profile at all, which seeded `boring-avatars` with the literal word "You" — so every hire got
 * the same generated face, and a different one from the one the chat shows them.
 */
function SpeakerAvatar({ speaker, isStreaming }: { speaker: BuddySpeaker; isStreaming: boolean }) {
  const { profile } = useAuth();

  if (speaker === "YOU") {
    return (
      <UserAvatar
        profileIcon={profile?.profileIcon ?? undefined}
        fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : "You"}
        seed={profile?.id ?? undefined}
        size={32}
      />
    );
  }

  if (speaker === "PM") {
    // A person, drawn as a person. Not the bot glyph in another colour — the whole point of
    // this message is that a human answered it.
    return (
      <span className="flex size-8 items-center justify-center rounded-full border border-app-border bg-app-surface-muted text-app-text-muted">
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  // Each reply draws its own idle window, so a long thread nods off raggedly rather than all
  // at once. The turn currently receiving tokens is held awake — that one is visibly working.
  return <SleepyBot size={30} canSleep={!isStreaming} className="text-app-brand-text" />;
}

/**
 * The message the buddy has not written yet — the same bubble, with the three dots in it, so
 * the thread does not jump when the first token lands.
 */
export function BuddyTypingMessage({
  label,
  showName = false,
}: {
  label?: string;
  showName?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      {...(prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
          })}
      role="status"
      className="flex w-full min-w-0 gap-2.5"
    >
      <div className="flex size-8 shrink-0 items-center justify-center">
        <SleepyBot size={30} canSleep={false} className="text-app-brand-text" />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {showName && <p className="px-1 text-xs font-medium text-app-text-muted">Buddy</p>}

        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface px-4 py-3 shadow-sm">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
          </span>
          {/* What it is *doing*, when the backend says so. "Checking your progress…" answers
                        "why is this taking a moment"; three dots do not. */}
          {label && <span className="text-sm text-app-text-muted italic">{label}</span>}
        </div>
      </div>
    </motion.div>
  );
}
