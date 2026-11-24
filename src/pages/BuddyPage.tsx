import { useEffect } from "react";
import { MainContent } from "../components/layout/MainContent";
import { useBuddyDraftActions } from "../features/buddy/buddyDraftContext";
import { useBuddySession } from "../features/buddy/buddySessionContext";
import { useGreetingReveal } from "../features/buddy/hooks/useGreetingReveal";
import { usePmReplies } from "../features/buddy/hooks/usePmReplies";
import { useProjectContext } from "../features/projects/useProjectContext";
import { BuddyHomeConversation } from "./buddyPage/BuddyHomeConversation";
import { BuddyOverlays } from "./buddyPage/BuddyOverlays";
import { BuddyPageHeader } from "./buddyPage/BuddyPageHeader";
import { BuddyPageShell } from "./buddyPage/BuddyPageShell";
import { BuddyFloatingNewButton, BuddyRail, BuddyRailToggle } from "./buddyPage/BuddyRail";
import { useAddressSync } from "./buddyPage/useAddressSync";
import { useBuddyCitations } from "./buddyPage/useBuddyCitations";
import { useBuddyRail } from "./buddyPage/useBuddyRail";
import { useComposerFocus } from "./buddyPage/useComposerFocus";
import { useConversationStart } from "./buddyPage/useConversationStart";
import { usePmRepliesDrawer } from "./buddyPage/usePmRepliesDrawer";
import { useThreadSlots } from "./buddyPage/useThreadSlots";

/**
 * The mentor buddy: the hire's conversations, the first one opened with a proactive,
 * memory-grounded greeting, the rest read as they are.
 *
 * Opening does not gate the page. The greeting costs a model call, and blanking everything behind
 * a spinner until it lands made the landing page unusable for ~20 seconds. The composer sends, the
 * chips render, and the greeting arrives in its own bubble — as the buddy typing.
 */
function BuddyMentorHome() {
  const session = useBuddySession();
  const { messages, presentedGreetingId, markGreetingPresented, teamProjectId } = session;
  const { registerDinoSurface, ensureOpened } = session;

  // The page fills the composer (the chips, the hand-off from the dock) but never reads it — so it
  // takes the write-only half, which never changes. That is what keeps a character typed into the
  // box from re-rendering this page at all. See `BuddyDraftProvider`.
  const { setDraft } = useBuddyDraftActions();

  // The page shows the thread, so Space may open the dino game here; leaving the page releases it
  // (and closes a game still running) — see `registerDinoSurface`.
  useEffect(() => registerDinoSurface(), [registerDinoSurface]);

  // A greeting written while the hire was somewhere else still gets the buddy thinking and writing
  // it, the first time it is on screen — the same as in the dock.
  const greeting = useGreetingReveal({
    messages,
    active: true,
    presentedGreetingId,
    markGreetingPresented,
  });

  // The same conversation the dock shows, brought on screen the same way. Opening a *new* visit
  // here would throw away whatever the hire had already asked.
  useEffect(() => {
    void ensureOpened();
  }, [ensureOpened]);

  useAddressSync(session);

  const isHireMode = teamProjectId === null;
  const hasUserMessage = messages.some((m) => m.role === "USER");
  const replies = usePmReplies(isHireMode);
  const repliesDrawer = usePmRepliesDrawer(replies.answered);
  const rail = useBuddyRail();
  const start = useConversationStart(session, isHireMode, hasUserMessage);
  const slots = useThreadSlots({ session, greeting, isHireMode, hasUserMessage, setDraft });
  const { projects, selectedProjectId } = useProjectContext();
  const citations = useBuddyCitations(session, selectedProjectId);
  const composerFocusToken = useComposerFocus();
  const isBusy = session.isThinking || session.isStreaming;

  return (
    <>
      <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-app-bg lg:h-dvh">
        <BuddyPageHeader
          canSwitchModes={projects.some((project) => project.isManaged)}
          teamProjectId={teamProjectId}
          onSwitchMode={(projectId) => void session.switchTeamProject(projectId)}
          switchDisabled={isBusy || session.isOpening || session.isGreeting || session.isDeciding}
          showReplies={isHireMode && replies.hasAny}
          unseenReplyCount={repliesDrawer.unseenCount}
          onOpenReplies={repliesDrawer.open}
        />

        <MainContent className="flex min-h-0 flex-1 flex-col">
          <BuddyPageShell
            isRailOpen={rail.isOpen}
            rail={
              <BuddyRail
                session={session}
                isHireMode={isHireMode}
                isOpen={rail.isOpen}
                onSetOpen={rail.setOpen}
                canStart={start.canStart}
                onStart={start.startConversation}
                onSelect={start.selectConversation}
              />
            }
            newConversationControl={
              <BuddyFloatingNewButton
                isOpen={rail.isOpen}
                canStart={start.canStart}
                onStart={start.startConversation}
              />
            }
            railToggle={<BuddyRailToggle isOpen={rail.isOpen} onOpen={() => rail.setOpen(true)} />}
          >
            <BuddyHomeConversation
              session={session}
              greeting={greeting}
              slots={slots}
              viewer={citations.viewer}
              citationProjectId={citations.projectId}
              composerFocusToken={composerFocusToken}
              hasFloatingControl={!rail.isOpen}
            />
          </BuddyPageShell>
        </MainContent>
      </div>

      <BuddyOverlays
        viewer={citations.viewer}
        citationProjectId={citations.projectId}
        replies={replies}
        repliesOpen={repliesDrawer.isOpen}
        onCloseReplies={repliesDrawer.close}
      />
    </>
  );
}

/**
 * The buddy's home: the hire's onboarding front door, as one conversation.
 *
 * The buddy is not a feature of the onboarding — it *is* the onboarding. The mentor answers from
 * the docs *and* from the hire's own state, and renders what it opens (like a task's orientation
 * packet) in the thread rather than navigating away.
 *
 * It is a conversation with somebody, and it is built to feel like one, not a dashboard about a
 * conversation: the things worth asking sit above the box they fill, sending a question to a person
 * hangs off that question, and the record of what was sent stands beside the conversation.
 *
 * The dock (`BuddyWidget`, mounted app-wide) shares the same one buddy session, so a hire can pick
 * the conversation up from anywhere and grow it into this page when it needs room.
 *
 * Bound to `/buddy` — and `/buddy/:id` for one named conversation — open to every permission group.
 * A user without a selected project gets the conversation anyway: the hire's buddy is not one
 * project's, and everyone redirected here from `/chat` must not reach a dead end.
 */
export function BuddyPage() {
  return <BuddyMentorHome />;
}
