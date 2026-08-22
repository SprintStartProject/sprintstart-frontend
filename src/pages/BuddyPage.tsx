import { Link } from "react-router-dom";
import { Bot, LayoutDashboard, Sparkles, Users } from "lucide-react";
import { useBuddyConversation } from "../features/buddy/hooks/useBuddyConversation";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddySuggestionChips } from "../features/buddy/components/BuddySuggestionChips";
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
  return (
    <header className="shrink-0 border-b border-app-border px-4 py-5">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-brand/10">
          <Bot className="h-5 w-5 text-app-brand-text" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-bold text-app-text">Buddy</h1>
          <p className="text-sm text-app-text-muted">{subtitle}</p>
        </div>
        {/* This conversation opens fresh every visit by design, so anything worth keeping
                    lives on the board. Linking it here is what stops it being a page nobody finds. */}
        {showBoardLink && (
          <Link
            to="/board"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Board
          </Link>
        )}
      </div>
    </header>
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

  // Opening does not gate the page. The greeting costs a model call, and blanking
  // everything behind a spinner until it lands made the hire's landing page unusable for ~20
  // seconds. Nothing here needs the greeting to work: the composer sends, the escalation channel
  // and the chips render, and the greeting drops into the transcript when it arrives. It is the
  // same rule the board already holds itself to -- a page that waits on a model to open is a
  // page nobody opens.
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      <BuddyHeader
        subtitle="Your always-on mentor — ask about the codebase, or about your own onboarding."
        showBoardLink
      />

      {/* Directly under the header, and not conditioned on the hire having spoken: an
                escalation is the last-resort channel, so a hire with an answer waiting is the one
                most likely to be blocked. Owns its own spacing because it renders nothing at all
                when they have never flagged anything — a wrapper here would leave a gap instead. */}
      <MyEscalations />

      {/* The greeting invites one next step; offer it as a single prominent chip until the
                hire acts or asks something of their own. */}
      {openerAction && !hasUserMessage && (
        <div className="shrink-0 px-4 pt-4">
          <div className="mx-auto w-full max-w-3xl">
            <button
              type="button"
              onClick={() => void sendMessage(openerAction.question)}
              className="inline-flex items-center gap-2 rounded-full bg-app-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {openerAction.label}
            </button>
          </div>
        </div>
      )}

      {/* These used to be four hardcoded strings, one of which was "Is my PR stuck?" —
                offered to every hire, including the roles role-tracks exists to stop showing pull
                requests to. They now come from the backend, which builds them from the tools it
                actually mounts for this hire, so the chips and the mentor cannot disagree.

                They also *fill* the composer now instead of sending. The hire presses send: the
                words stay theirs, and they can edit the question first — which is how somebody
                learns they are allowed to. The opener's own chip above still sends on one click,
                deliberately: that one is accepting something the mentor just offered, not composing
                a question, and it looks different because it is different. */}
      {!hasUserMessage && (
        <div className="shrink-0 px-4 pt-4">
          <div className="mx-auto w-full max-w-3xl">
            <BuddySuggestionChips
              suggestions={suggestions}
              onPick={setDraft}
              heading="Or ask about something else"
            />
          </div>
        </div>
      )}

      {hasUserMessage && (
        <div className="shrink-0 px-4 pt-3">
          <div className="mx-auto w-full max-w-3xl">
            <FlagToPmButton defaultQuestion={lastQuestion} />
          </div>
        </div>
      )}

      <BuddyConversation
        messages={messages}
        // While the visit opens, the same indicator stands in for the greeting that is on
        // its way -- it does not disable the composer, so the hire can type straight past it.
        isThinking={isThinking || isOpening}
        activeTool={activeTool}
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        confirmAction={confirmAction}
        dismissAction={dismissAction}
        bottomRef={bottomRef}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Users className="h-8 w-8 text-app-text-muted" aria-hidden="true" />
          <p className="max-w-sm text-sm text-app-text-muted">
            You&rsquo;re not on a project yet — once you&rsquo;re added to one, your buddy will meet
            you here.
          </p>
        </div>
      </div>
    );
  }

  return <BuddyMentorHome />;
}
