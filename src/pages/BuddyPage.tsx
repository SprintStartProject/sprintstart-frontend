import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutDashboard, Users } from "lucide-react";
import { SleepyBot } from "../features/chatbot/components/SleepyBot";
import { EmptyState } from "../components/ui/EmptyState";
import { useBuddyConversation } from "../features/buddy/hooks/useBuddyConversation";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddyWelcome } from "../features/buddy/components/BuddyWelcome";
import { FlagToPmButton } from "../features/knowledge-request/components/FlagToPmButton";
import { MyEscalations } from "../features/knowledge-request/components/MyEscalations";

/**
 * The buddy's home: the hire's onboarding front door as a full-page conversation.
 *
 * The buddy is not a feature of the onboarding — it *is* the onboarding. The mentor
 * answers from the docs *and* from the hire's own state, and renders what it opens
 * (like a task's orientation packet) in the thread rather than navigating away.
 *
 * The floating widget (mounted app-wide) shares the same one buddy session, so a hire
 * can pick up the conversation from anywhere.
 *
 * The page is three bands and nothing else — header, conversation, composer. Everything that
 * used to sit in a `shrink-0` strip between the header and the thread (the escalation record,
 * the opener, the chips, the flag trigger) now belongs to one of the two ends: the record
 * scrolls with the conversation, and the rest lives with the box you type in. Four blocks
 * stacked above the transcript is what made this page's own content the last thing on it.
 */

/**
 * The conversation's header.
 *
 * `showBoardLink` is off for a hire with no project: the board is where durable things are kept,
 * and there is nothing durable on it yet. Offering it would send somebody to an almost empty page
 * on their first minute here.
 */
function BuddyHeader({
  subtitle,
  showBoardLink = false,
}: {
  subtitle: string;
  showBoardLink?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.header
      {...(prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: -8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
          })}
      // Translucent rather than solid: the app's aurora layer sits behind every page, and a
      // flat bar across the top of this one cut a hard line through it.
      className="shrink-0 border-b border-app-border bg-app-bg/70 backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
        {/* The soft brand disc is the buddy's mark on this page, and the only place the bot
                    gets one — in the thread the glyph stands on its own (see `BuddyMessageBubble`),
                    but up here it is an identity, not a speaker. */}
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft ring-1 ring-app-brand-border/60">
          <SleepyBot size={30} canSleep={false} tracksPointer className="text-app-brand-text" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-bold text-app-text">Buddy</h1>
          <p className="truncate text-sm text-app-text-muted">{subtitle}</p>
        </div>

        {/* This conversation opens fresh every visit by design, so anything worth keeping
                    lives on the board. Linking it here is what stops it being a page nobody finds. */}
        {showBoardLink && (
          <Link
            to="/board"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Board
          </Link>
        )}
      </div>
    </motion.header>
  );
}

/**
 * The mentor buddy: opens each visit with a proactive, memory-grounded greeting rather than a
 * replayed transcript, then carries the conversation.
 */
function BuddyMentorHome() {
  const {
    messages,
    isThinking,
    isOpening,
    activeTool,
    openerAction,
    draft,
    setDraft,
    sendMessage,
    handleSubmit,
    confirmAction,
    dismissAction,
    bottomRef,
  } = useBuddyConversation({ open: true });

  const suggestions = useBuddySuggestions();

  // Whatever they were typing in the floating panel when they asked for more room.
  useHandedOffDraft(setDraft);

  const hasUserMessage = messages.some((m) => m.role === "USER");
  const lastQuestion = [...messages].reverse().find((m) => m.role === "USER")?.content ?? "";

  // The greeting can carry a proposal the hire has to confirm, and a confirm affordance in a
  // centred welcome column would sit under the words it belongs to but nowhere near them. That
  // one case falls through to the thread, which is built for it.
  const greetingHasActions = messages.some((m) => (m.actions?.length ?? 0) > 0);
  const showWelcome = !hasUserMessage && !greetingHasActions;
  const greeting = showWelcome ? (messages.find((m) => m.role === "ASSISTANT")?.content ?? "") : "";

  // Opening does not gate the page. The greeting costs a model call, and blanking
  // everything behind a spinner until it lands made the hire's landing page unusable for ~20
  // seconds. Nothing here needs the greeting to work: the composer sends, the escalation channel
  // and the chips render, and the greeting drops into the welcome the moment it arrives. It is
  // the same rule the board already holds itself to -- a page that waits on a model to open is a
  // page nobody opens.
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      <BuddyHeader
        subtitle="Your always-on mentor — ask about the codebase, or about your own onboarding."
        showBoardLink
      />

      <BuddyConversation
        messages={messages}
        // While the visit opens, the same indicator stands in for the greeting that is on
        // its way -- it does not disable the composer, so the hire can type straight past it.
        // The welcome does that job itself, so it is not doubled there.
        isThinking={isThinking || (isOpening && !showWelcome)}
        activeTool={activeTool}
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        confirmAction={confirmAction}
        dismissAction={dismissAction}
        bottomRef={bottomRef}
        // Not conditioned on the hire having spoken: an escalation is the last-resort
        // channel, so a hire with an answer waiting is the one most likely to be blocked.
        // It owns its own spacing and renders nothing at all when they have never flagged
        // anything -- a wrapper here would leave a gap instead.
        topSlot={<MyEscalations />}
        welcome={
          showWelcome ? (
            <BuddyWelcome
              greeting={greeting}
              isOpening={isOpening}
              openerAction={openerAction}
              // The opener sends on one click, deliberately: that is accepting something the
              // mentor just offered, not composing a question.
              onTakeOpener={(question) => void sendMessage(question)}
              suggestions={suggestions}
              // The chips *fill* the composer instead of sending. The hire presses send: the
              // words stay theirs, and they can edit the question first — which is how somebody
              // learns they are allowed to. The list is the backend's too, built from the tools
              // it actually mounts for this hire, so the chips and the mentor cannot disagree
              // about whether this role has pull requests.
              onPickSuggestion={setDraft}
            />
          ) : undefined
        }
        composerFooter={
          hasUserMessage ? <FlagToPmButton defaultQuestion={lastQuestion} /> : undefined
        }
      />
    </div>
  );
}

export function BuddyPage() {
  const { selectedProjectId, isLoading } = useProjectContext();

  if (!isLoading && !selectedProjectId) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
        <BuddyHeader subtitle="Your onboarding buddy, once you're on a project." />
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Users className="h-8 w-8" aria-hidden="true" />}
            title="No project yet"
            className="max-w-md"
          >
            You&rsquo;re not on a project yet — once you&rsquo;re added to one, your buddy will meet
            you here.
          </EmptyState>
        </div>
      </div>
    );
  }

  return <BuddyMentorHome />;
}
