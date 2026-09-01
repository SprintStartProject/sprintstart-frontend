import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Inbox, Sparkles, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  ConversationRail,
  RailToggle,
  RAIL_DESKTOP_QUERY,
} from "../components/layout/ConversationRail";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useBuddySession } from "../features/buddy/buddySessionContext";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { announceBuddyPageReady } from "../features/buddy/aiBuddyBus";
import { useNewConversationShortcut } from "../hooks/useNewConversationShortcut";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddyPmReplies } from "../features/buddy/components/BuddyPmReplies";
import { usePmReplies } from "../features/buddy/hooks/usePmReplies";
import { BuddySuggestionChips } from "../features/buddy/components/BuddySuggestionChips";
import { BuddyQuestionActions } from "../features/buddy/components/BuddyQuestionActions";

/**
 * Names the rail for assistive tech and labels the control that reopens it.
 *
 * One constant, because those two have to say the same thing: `aria-controls` points the
 * second at the first, and a screen reader that announced two different names for one region
 * would be describing two things that do not exist.
 */
const PM_REPLIES_LABEL = "What you sent to your PM";

/**
 * Where the rail's collapsed state lives between visits, next to the chat's own
 * (`chatSidebarOpen`) and for the same reason: it is a statement about how much room this
 * window has to spare, not about a conversation or a user.
 */
const RAIL_OPEN_KEY = "buddyPmRepliesOpen";

/** `null` when the hire has never said either way — see the auto-open in `BuddyMentorHome`. */
function readRailOpen(): boolean | null {
  try {
    const stored = localStorage.getItem(RAIL_OPEN_KEY);

    return stored === null ? null : stored === "true";
  } catch {
    // Private modes can refuse storage outright. Not a reason to fail to render a rail.
    return null;
  }
}

function writeRailOpen(open: boolean): void {
  try {
    localStorage.setItem(RAIL_OPEN_KEY, String(open));
  } catch {
    // Nothing to do: the rail still opens and closes, it just will not be remembered.
  }
}

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
  rail,
  railToggle,
  isRailOpen = false,
  children,
}: {
  /** The standing column beside the conversation — see `ConversationRail`. */
  rail?: ReactNode;
  /** What brings it back when it is closed. Positioned by the rail's own control. */
  railToggle?: ReactNode;
  /** Whether that column is currently taking width, which decides this column's left gutter. */
  isRailOpen?: boolean;
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
    <div className="flex min-h-0 flex-1 bg-app-bg">
      {rail}

      {/* `app-rail-open` collapses this column's left gutter, so the rail opens *into* the empty
                gutter instead of shoving the conversation right. The separating space belongs
                before the `${'{'}` — prettier-plugin-tailwindcss trims class strings when it sorts
                them, and gluing two classes together here once turned a whole page into a flex
                row (see ChatPage). */}
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isRailOpen ? "app-rail-open" : ""}`}
      >
        {railToggle}

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
    startFreshVisit,
  } = useBuddySession();

  // The same conversation the dock shows, brought on screen the same way. It used to open a
  // *new* visit here, which is what threw away whatever the hire had already asked.
  useEffect(() => {
    void ensureOpened();
  }, [ensureOpened]);

  const suggestions = useBuddySuggestions();
  const replies = usePmReplies();

  // Below `md` the rail is a drawer over the conversation, so it must never open by itself
  // there — the auto-open below is a desktop courtesy, not a takeover.
  const isDesktop = useMediaQuery(RAIL_DESKTOP_QUERY);

  const [rail, setRail] = useState(() => {
    const stored = readRailOpen();

    return { open: stored ?? false, decided: stored !== null };
  });

  // Open when there is an answer waiting, closed otherwise — but only until the hire says
  // otherwise, and never again after that. `FlagToPmButton` promises them the answer "will show
  // up here", and a reply sitting behind a control they have to find does not keep that
  // promise; a rail holding nothing but "still waiting" has nothing to say that the toggle's
  // own count does not.
  if (!rail.decided && replies.hasAny) {
    // React's documented "adjust state when a prop changes" pattern — a guarded setState during
    // render rather than an effect, so the first paint already has the right layout instead of
    // showing the closed one and shifting.
    setRail({ open: isDesktop && replies.answered.length > 0, decided: true });
  }

  // Their choice is written through as they make it, the way the chat's own rail remembers
  // being collapsed. Not inside the updater: React may run one twice.
  const setRailOpen = useCallback((open: boolean) => {
    writeRailOpen(open);
    setRail({ open, decided: true });
  }, []);

  // Whatever they were typing in the dock when they asked for more room.
  useHandedOffDraft(setDraft);

  const hasUserMessage = messages.some((m) => m.role === "USER");

  // Memoised so the listener is bound once rather than torn down and rebuilt on every token
  // that arrives while the buddy is answering.
  const startFresh = useCallback(() => void startFreshVisit(), [startFreshVisit]);

  // The keyboard half of the control in the visit divider. Gated the same way that control is:
  // a visit nobody has spoken in is already the fresh one, and re-opening it would only replay
  // the greeting.
  useNewConversationShortcut(startFresh, hasUserMessage);

  // Opening does not gate the page. The greeting costs a model call, and blanking everything
  // behind a spinner until it lands made the hire's landing page unusable for ~20 seconds.
  // Nothing here needs the greeting in order to work: the composer sends, the chips render, and
  // the greeting arrives in its own bubble — as the buddy typing, which is the honest picture
  // of what is happening and reads as somebody writing to you rather than as a page loading.
  return (
    <BuddyPageShell
      isRailOpen={rail.open}
      rail={
        // Mounted whenever the hire has ever escalated something, open or not: the count on the
        // control that reopens it is read from the same list the rail is showing, and a rail
        // that unmounted would lose its scroll position every time it was put away.
        replies.hasAny ? (
          <ConversationRail id="buddy-pm-replies" isOpen={rail.open} label={PM_REPLIES_LABEL}>
            <BuddyPmReplies {...replies} onClose={() => setRailOpen(false)} />
          </ConversationRail>
        ) : undefined
      }
      railToggle={
        // Only offered when there is something behind it: a control that opens an empty panel
        // is worse than no control.
        replies.hasAny && !rail.open ? (
          <RailToggle
            label={PM_REPLIES_LABEL}
            controls="buddy-pm-replies"
            icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
            count={replies.answered.length + replies.waiting.length + replies.dismissed.length}
            onClick={() => setRailOpen(true)}
          />
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
        onStartFreshVisit={startFresh}
        hasFloatingControl={replies.hasAny && !rail.open}
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
