import type { ReactNode } from "react";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Users, X } from "lucide-react";
import { SleepyBot } from "../features/chatbot/components/SleepyBot";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useBuddyConversation } from "../features/buddy/hooks/useBuddyConversation";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddyPmReplies } from "../features/buddy/components/BuddyPmReplies";
import { BuddySuggestionChips } from "../features/buddy/components/BuddySuggestionChips";
import { FlagToPmButton } from "../features/knowledge-request/components/FlagToPmButton";

/**
 * The buddy's home: the hire's onboarding front door, as one conversation.
 *
 * The buddy is not a feature of the onboarding — it *is* the onboarding. The mentor answers
 * from the docs *and* from the hire's own state, and renders what it opens (like a task's
 * orientation packet) in the thread rather than navigating away.
 *
 * **It is a conversation with somebody, and it is built to feel like one.** Earlier passes at
 * this page tried to make it look like the rest of the app by putting the chat in a card and
 * standing a column of widgets next to it — "Ask about", "Not getting anywhere?" — and what
 * came out was a dashboard about a conversation rather than a conversation. Everything those
 * boxes held has moved to where a person would expect it: the things worth asking sit above the
 * box they fill, and "the buddy can't help" hangs off the answer that could not help, because
 * that is what it is about.
 *
 * The dock (`BuddyWidget`, mounted app-wide) shares the same one buddy session, so a hire can
 * pick the conversation up from anywhere and grow it into this page when it needs room.
 */

/**
 * The page's shape, shared by the mentor and the no-project state so nothing moves between
 * them.
 *
 * Fixed height rather than the `min-h-screen` its sibling pages use, for one reason: the
 * composer has to stay on screen. A conversation whose input scrolls away is one you have to
 * scroll back to in order to answer.
 */
function BuddyPageShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  /**
   * Leaves the conversation the way you came into it.
   *
   * `location.key` is `"default"` only on the entry the app was loaded at — a hard reload
   * straight onto `/buddy`, or a link from outside. There is no history to step back through
   * there, so going back would leave the app entirely; the board is where a hire belongs
   * instead, and it is the durable half of this same conversation.
   */
  const close = useCallback(() => {
    if (location.key !== "default") void navigate(-1);
    else void navigate("/board");
  }, [location.key, navigate]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-app-bg lg:h-screen">
      <motion.header
        {...(prefersReducedMotion
          ? {}
          : {
              initial: { opacity: 0, y: -8 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
            })}
        className="shrink-0 border-b border-app-border bg-app-bg/85 backdrop-blur-md"
      >
        {/* The conversation's own width, not the page's: the header sits directly over the
                    thread, and a name that starts 10rem to the left of the first message belongs
                    to a different page than the one underneath it. */}
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-app-brand-soft">
            <SleepyBot size={32} canSleep={false} tracksPointer className="text-app-brand-text" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-base leading-tight font-semibold text-app-text">Buddy</h1>
            <p className="truncate text-xs text-app-text-muted">{subtitle}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Close the conversation"
            title="Close"
            onClick={close}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </motion.header>

      {children}
    </div>
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

  // Whatever they were typing in the dock when they asked for more room.
  useHandedOffDraft(setDraft);

  const hasUserMessage = messages.some((m) => m.role === "USER");
  const lastQuestion = [...messages].reverse().find((m) => m.role === "USER")?.content ?? "";

  // Opening does not gate the page. The greeting costs a model call, and blanking everything
  // behind a spinner until it lands made the hire's landing page unusable for ~20 seconds.
  // Nothing here needs the greeting in order to work: the composer sends, the chips render, and
  // the greeting arrives in its own bubble — as the buddy typing, which is the honest picture
  // of what is happening and reads as somebody writing to you rather than as a page loading.
  return (
    <BuddyPageShell subtitle="Your onboarding mentor — here whenever you're stuck.">
      <BuddyConversation
        messages={messages}
        isThinking={isThinking || isOpening}
        activeTool={activeTool}
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        confirmAction={confirmAction}
        dismissAction={dismissAction}
        bottomRef={bottomRef}
        // What came back from a person, above what the buddy is saying now. Renders nothing at
        // all until the hire has escalated something.
        before={<BuddyPmReplies />}
        lastMessageFooter={
          hasUserMessage ? (
            // Hung off the buddy's answer, because that is what it is about: *this* reply did
            // not get you there, so take *this* question to a person. In a box on the side it
            // was an offer with no subject.
            <div className="mt-1.5 w-full">
              <FlagToPmButton defaultQuestion={lastQuestion} />
            </div>
          ) : (
            openerAction && (
              // The greeting's own next step, offered where a messenger offers a quick reply:
              // right under the message that suggested it. It sends on one click, unlike the
              // chips — accepting something the mentor just offered is not composing a
              // question of your own.
              <Button
                variant="primary"
                size="sm"
                className="mt-1.5"
                icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void sendMessage(openerAction.question)}
              >
                {openerAction.label}
              </Button>
            )
          )
        }
        aboveComposer={
          // The chips *fill* the composer instead of sending, which is why they sit on top of
          // it. The hire presses send: the words stay theirs, and they can edit the question
          // first — which is how somebody learns they are allowed to. The list is the
          // backend's, built from the tools it actually mounts for this hire, so the chips and
          // the mentor cannot disagree about whether this role has pull requests.
          !hasUserMessage ? (
            <BuddySuggestionChips
              suggestions={suggestions}
              onPick={setDraft}
              heading="Not sure where to start?"
            />
          ) : undefined
        }
      />
    </BuddyPageShell>
  );
}

export function BuddyPage() {
  const { selectedProjectId, isLoading } = useProjectContext();

  if (!isLoading && !selectedProjectId) {
    return (
      <BuddyPageShell subtitle="Your onboarding buddy, once you're on a project.">
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Users className="h-8 w-8" aria-hidden="true" />}
            title="No project yet"
            className="w-full max-w-md"
          >
            You&rsquo;re not on a project yet — once you&rsquo;re added to one, your buddy will meet
            you here.
          </EmptyState>
        </div>
      </BuddyPageShell>
    );
  }

  return <BuddyMentorHome />;
}
