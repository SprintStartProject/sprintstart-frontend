import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bot, LayoutDashboard, Users } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { useBuddyConversation } from "../features/buddy/hooks/useBuddyConversation";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { useHandedOffDraft } from "../features/buddy/useHandedOffDraft";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { BuddySidePanel } from "../features/buddy/components/BuddySidePanel";
import { BuddyWelcome } from "../features/buddy/components/BuddyWelcome";

/**
 * The buddy's home: the hire's onboarding front door.
 *
 * The buddy is not a feature of the onboarding — it *is* the onboarding. The mentor answers
 * from the docs *and* from the hire's own state, and renders what it opens (like a task's
 * orientation packet) in the thread rather than navigating away.
 *
 * **It is a page in this app, not a chat app inside it.** It used to be a full-bleed column
 * with a bar on top and four stacked strips above the transcript — the shape of a phone
 * messenger, on the one screen a new hire spends the most time on. It now wears what every
 * other page here wears: a `PageHeader` in a bordered band, an `app-page-frame` body, and a
 * card grid. The conversation is the wide card; everything that is *not* the conversation —
 * what came back from a person, what is worth asking, the way out when the buddy cannot help
 * — is the rail beside it, which is where the rest of the app already puts such things.
 *
 * The floating widget (mounted app-wide) shares the same one buddy session, so a hire can pick
 * up the conversation from anywhere.
 */

/** Subtitle for a hire who has a project to be onboarded onto. */
const MENTOR_SUBTITLE =
  "Your always-on mentor — ask about the codebase, or about your own onboarding.";

/**
 * The page's outer shape, shared by the mentor and the no-project state so the header does not
 * move between them.
 *
 * Fixed height rather than the `min-h-screen` its sibling pages use, and for one reason: the
 * composer has to stay on screen. A conversation whose input scrolls away is one you have to
 * scroll back to in order to answer. The body scrolls inside the two cards instead — until the
 * grid folds to one column below `xl`, where the page takes the scrolling back.
 */
function BuddyPageShell({
  showBoardLink = false,
  children,
}: {
  showBoardLink?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      <header className="shrink-0 border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-5 lg:py-6">
          <PageHeader
            icon={Bot}
            title="Buddy"
            subtitle={
              showBoardLink ? MENTOR_SUBTITLE : "Your onboarding buddy, once you're on a project."
            }
            actions={
              // This conversation opens fresh every visit by design, so anything worth
              // keeping lives on the board — linking it here is what stops that being a
              // page nobody finds. Off for a hire with no project: the board keeps durable
              // things and there is nothing durable on it yet, so the link would send
              // somebody to an empty page on their first minute here.
              //
              // A `Link`, styled to sit level with the header's buttons: a control that
              // changes the URL is an anchor, and dressing one as a `Button` does not make
              // it keyboard- or screen-reader-correct.
              showBoardLink ? (
                <Link
                  to="/board"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Board
                </Link>
              ) : undefined
            }
          />
        </div>
      </header>

      {/* Scrolls as a page in the stacked layout and hands the scrolling to the cards once
                the grid splits, so the composer stays put on the width this page is used at.
                A `div` and not a `main`, unlike the sibling pages that otherwise share this
                shape: `App.tsx` already wraps every route in one, and a second `main` is a
                duplicate landmark. The layout classes are the pages' — only the tag differs. */}
      <div className="app-page-frame min-h-0 flex-1 overflow-y-auto py-5 lg:py-6 xl:overflow-hidden">
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

  // Opening does not gate the page. The greeting costs a model call, and blanking everything
  // behind a spinner until it lands made the hire's landing page unusable for ~20 seconds.
  // Nothing here needs the greeting in order to work: the composer sends, the rail renders, and
  // the greeting drops into the welcome the moment it arrives. It is the rule the board already
  // holds itself to — a page that waits on a model to open is a page nobody opens.
  return (
    <BuddyPageShell showBoardLink>
      {/* Splits at `xl` and not before: the page gutters are already 10rem a side from `lg`,
                so a rail introduced there would leave the conversation narrower than the rail.
                It widens again at `2xl`, where there is room for the escalation answers to breathe. */}
      <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <BuddyConversation
          messages={messages}
          // While the visit opens, the same indicator stands in for the greeting that is on
          // its way -- it does not disable the composer, so the hire can type straight past
          // it. The welcome does that job itself, so it is not doubled there.
          isThinking={isThinking || (isOpening && !showWelcome)}
          activeTool={activeTool}
          draft={draft}
          setDraft={setDraft}
          handleSubmit={handleSubmit}
          confirmAction={confirmAction}
          dismissAction={dismissAction}
          bottomRef={bottomRef}
          welcome={
            showWelcome ? (
              <BuddyWelcome
                greeting={greeting}
                isOpening={isOpening}
                openerAction={openerAction}
                // The opener sends on one click, deliberately: that is accepting something
                // the mentor just offered, not composing a question.
                onTakeOpener={(question) => void sendMessage(question)}
              />
            ) : undefined
          }
        />

        <BuddySidePanel
          suggestions={suggestions}
          // The rail's suggestions *fill* the composer instead of sending. The hire presses
          // send: the words stay theirs, and they can edit the question first — which is how
          // somebody learns they are allowed to. The list is the backend's too, built from the
          // tools it actually mounts for this hire, so the rail and the mentor cannot disagree
          // about whether this role has pull requests.
          onPick={setDraft}
          lastQuestion={lastQuestion}
        />
      </div>
    </BuddyPageShell>
  );
}

export function BuddyPage() {
  const { selectedProjectId, isLoading } = useProjectContext();

  if (!isLoading && !selectedProjectId) {
    return (
      <BuddyPageShell>
        <div className="flex h-full items-center justify-center py-10">
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
