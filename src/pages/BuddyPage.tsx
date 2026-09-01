import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Inbox, Sparkles, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useBuddySession } from "../features/buddy/buddySessionContext";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { announceBuddyPageReady } from "../features/buddy/aiBuddyBus";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddyPmReplies } from "../features/buddy/components/BuddyPmReplies";
import { usePmReplies } from "../features/buddy/hooks/usePmReplies";
import { BuddySuggestionChips } from "../features/buddy/components/BuddySuggestionChips";
import { BuddyQuestionActions } from "../features/buddy/components/BuddyQuestionActions";

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
 * box they fill, sending a question to a person hangs off that question, and the record of what
 * was sent stands in a rail beside the conversation rather than on top of it.
 *
 * The dock (`BuddyWidget`, mounted app-wide) shares the same one buddy session, so a hire can
 * pick the conversation up from anywhere and grow it into this page when it needs room.
 */

/**
 * The page's shape, shared by the mentor and the no-project state so nothing moves between
 * them.
 *
 * It fills the panel `AssistantShell` gives it rather than claiming a height of its own — the
 * shell owns the viewport, the page header and the switch. What is left here is the
 * conversation, the rail beside it, and the handful of controls that only mean anything on
 * this half of the assistant.
 *
 * It still never grows past that panel, for the reason it used to set its own fixed height:
 * the composer has to stay on screen. A conversation whose input scrolls away is one you have
 * to scroll back to in order to answer.
 */
function BuddyPageShell({
  actions,
  rail,
  children,
}: {
  /** Controls that only make sense once there is a conversation — a fresh start, mainly. */
  actions?: ReactNode;
  /** The left column, when the page has one open. */
  rail?: ReactNode;
  children: ReactNode;
}) {
  // Tells the dock's hand-off that the page is really on screen, so it can stop standing in
  // for it. No entrance animation of its own any more: arriving from the dock, the page is
  // revealed by that window fading away, and a second fade underneath it only ever showed the
  // background through both.
  useEffect(() => {
    announceBuddyPageReady();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-app-bg xl:flex-row">
      {/* A column beside the conversation where there is room for one, a band above it where
                there is not — one element either way, laid out by the parent's direction.
                Rendering it twice and hiding one per breakpoint would put the same answers in the
                document twice, which is a duplicate to anything that reads the page rather than
                looks at it.

                Deliberately not hidden below `xl`: this is where a hire reads the answer their PM
                sent, and putting it out of reach on a laptop would quietly break the promise
                `FlagToPmButton` makes. */}
      {rail && (
        <aside
          aria-label="Questions you sent to your PM"
          className="max-h-[45vh] shrink-0 overflow-y-auto border-b border-app-border bg-app-bg-soft xl:max-h-none xl:w-80 xl:border-r xl:border-b-0"
        >
          {rail}
        </aside>
      )}

      {/* `app-rail-open` collapses this column's left gutter, so the rail opens *into* the empty
                gutter instead of shoving the conversation right. The separating space belongs
                before the `${'{'}` — prettier-plugin-tailwindcss trims class strings when it sorts
                them, and gluing two classes together here once turned a whole page into a flex
                row (see ChatPage). */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${rail ? "app-rail-open" : ""}`}>
        {/* Only what belongs to this conversation and nowhere else. The title, the switch and
                    "New chat" are the shell's; the board is in the app sidebar. What is left is
                    the PM's answers, which appear only once a PM has sent one — so most visits
                    have no row here at all, and the conversation starts straight under the page
                    header. */}
        {actions && (
          <div className="app-page-frame flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-3">
            {actions}
          </div>
        )}

        {children}
      </div>
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
    openError,
    ensureOpened,
    retryOpen,
  } = useBuddySession();

  // The same conversation the dock shows, brought on screen the same way. It used to open a
  // *new* visit here, which is what threw away whatever the hire had already asked.
  useEffect(() => {
    void ensureOpened();
  }, [ensureOpened]);

  const suggestions = useBuddySuggestions();
  const replies = usePmReplies();

  // Open when there is an answer waiting, closed otherwise. `FlagToPmButton` promises the hire
  // that the answer "will show up here", and a reply sitting behind a control they have to find
  // does not keep that promise. A rail holding nothing but "still waiting" has nothing to say
  // that the toggle's own count does not, so it stays out of the way.
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [railDecided, setRailDecided] = useState(false);
  if (!railDecided && replies.hasAny) {
    // React's documented "adjust state when a prop changes" pattern — a guarded setState during
    // render rather than an effect, so the first paint already has the right layout instead of
    // showing the closed one and shifting.
    setRailDecided(true);
    setIsRailOpen(replies.answered.length > 0);
  }

  // Whatever they were typing in the dock when they asked for more room.
  useHandedOffDraft(setDraft);

  const hasUserMessage = messages.some((m) => m.role === "USER");

  // Opening does not gate the page. The greeting costs a model call, and blanking everything
  // behind a spinner until it lands made the hire's landing page unusable for ~20 seconds.
  // Nothing here needs the greeting in order to work: the composer sends, the chips render, and
  // the greeting arrives in its own bubble — as the buddy typing, which is the honest picture
  // of what is happening and reads as somebody writing to you rather than as a page loading.
  return (
    <BuddyPageShell
      rail={
        isRailOpen ? (
          <BuddyPmReplies {...replies} onClose={() => setIsRailOpen(false)} />
        ) : undefined
      }
      actions={
        // Only offered when there is something behind it: a toggle that opens an empty panel is
        // worse than no toggle. Starting a fresh visit is a page-level action and lives in the
        // header with the switch — see `BuddyNewChatAction`.
        replies.hasAny ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isRailOpen}
            icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
            title="What you sent to your PM"
            onClick={() => setIsRailOpen((open) => !open)}
          >
            PM replies
            <span className="ml-1 rounded-full bg-app-brand-soft px-1.5 text-[11px] font-semibold text-app-brand-text">
              {replies.answered.length + replies.waiting.length + replies.dismissed.length}
            </span>
          </Button>
        ) : undefined
      }
    >
      <BuddyConversation
        messages={messages}
        isThinking={isThinking || isOpening}
        activeTool={activeTool}
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        confirmAction={confirmAction}
        dismissAction={dismissAction}
        // Escalating hangs off the hire's own question now, not off the buddy's answer — see
        // `BuddyQuestionActions`. What is left here is the greeting's own next step, offered
        // where a messenger offers a quick reply: right under the message that suggested it. It
        // sends on one click, unlike the chips, because accepting something the mentor just
        // offered is not composing a question of your own.
        lastMessageFooter={
          !hasUserMessage && openerAction ? (
            <Button
              variant="primary"
              size="sm"
              className="mt-1.5"
              icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void sendMessage(openerAction.question)}
            >
              {openerAction.label}
            </Button>
          ) : undefined
        }
        renderQuestionAction={(question) => <BuddyQuestionActions question={question} />}
        openError={openError}
        onRetryOpen={() => void retryOpen()}
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
        focusComposerOnMount
      />
    </BuddyPageShell>
  );
}

export function BuddyPage() {
  const { selectedProjectId, isLoading } = useProjectContext();

  if (!isLoading && !selectedProjectId) {
    return (
      <BuddyPageShell>
        <div className="app-page-frame flex flex-1 items-center justify-center py-8">
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
