import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessagesSquare, Send, Sparkles } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  ConversationRail,
  RailToggle,
  RAIL_DESKTOP_QUERY,
} from "../components/layout/ConversationRail";
import { PageHeader } from "../components/layout/PageHeader";
import { MainContent } from "../components/layout/MainContent";
import { SidePanel } from "../components/ui/SidePanel";
import { useIsSmUp } from "../hooks/useIsSmUp";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useRailOverlayGuard } from "../hooks/useRailOverlayGuard";
import { useBuddySession } from "../features/buddy/buddySessionContext";
import { useBuddyDraftActions } from "../features/buddy/buddyDraftContext";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useBuddySuggestions } from "../features/buddy/hooks/useBuddySuggestions";
import { BuddyModeSwitcher } from "../features/buddy/components/BuddyModeSwitcher";
import { useGreetingReveal } from "../features/buddy/hooks/useGreetingReveal";
import { announceBuddyPageReady } from "../features/buddy/aiBuddyBus";
import {
  NEW_CONVERSATION_CHORD,
  useNewConversationShortcut,
} from "../hooks/useNewConversationShortcut";
import { BuddyConversation } from "../features/buddy/components/BuddyConversation";
import { CitationPopover } from "../features/buddy/citations/CitationPopover";
import { citationDrawerProjectId } from "../features/buddy/citations/citationArtifact";
import { useCitationViewer } from "../features/buddy/citations/useCitationViewer";
import { ArtifactViewerDrawer } from "../features/knowledge-base/components/ArtifactViewerDrawer";
import { BuddyNewConversationButton } from "../features/buddy/components/BuddyNewConversationButton";
import { BuddyConversationList } from "../features/buddy/components/BuddyConversationList";
import { BuddyPmReplies } from "../features/buddy/components/BuddyPmReplies";
import { usePmReplies } from "../features/buddy/hooks/usePmReplies";
import { useAuth } from "../context/useAuth";
import { BuddySuggestionChips } from "../features/buddy/components/BuddySuggestionChips";
import { BuddyQuestionActions } from "../features/buddy/components/BuddyQuestionActions";
import { FOCUS_COMPOSER_SHORTCUT, useShortcutListener } from "../features/shortcuts";

/**
 * Names the rail — the hire's conversations — for assistive tech and labels the control that
 * reopens it.
 *
 * One constant, because those two have to say the same thing: `aria-controls` points the
 * second at the first, and a screen reader that announced two different names for one region
 * would be describing two things that do not exist.
 */
const RAIL_LABEL = "Your conversations";

/** The rail region's id — the toggle's `aria-controls` points at it. */
const RAIL_ID = "buddy-rail";

/**
 * Where the rail's collapsed state lives between visits. Per window rather than per user: it is a
 * statement about how much room this window has to spare, not about a conversation or a user.
 */
const RAIL_OPEN_KEY = "buddyRailOpen";

/** `null` when the hire has never said either way — the rail then starts closed. */
function readRailOpen(): boolean | null {
  try {
    // Read through the pre-rename key once: the rail used to be the PM-replies panel
    // (`buddyPmRepliesOpen`), and a rename must not throw away a choice already made.
    const stored =
      localStorage.getItem(RAIL_OPEN_KEY) ?? localStorage.getItem("buddyPmRepliesOpen");

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
 * The answered replies the hire has already looked at, so the header's badge can say "new"
 * rather than "ever".
 *
 * `usePmReplies` has no read state of its own and the backend has none to give: an answer is
 * ANSWERED, and whether it has been seen is a fact about this browser. Ids, not a count — an
 * answer read yesterday must not make today's answer look seen.
 */
function seenRepliesKey(userId: string): string {
  return `buddyPmRepliesSeen:${userId}`;
}

function readSeenReplyIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(seenRepliesKey(userId));

    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private modes can refuse storage outright. Erring towards showing the badge says
    // something rather than staying silent about an answer.
    return [];
  }
}

function writeSeenReplyIds(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(seenRepliesKey(userId), JSON.stringify(ids));
  } catch {
    // Same as above: the badge stays up, nothing breaks.
  }
}

/**
 * The page's shape: the conversation, with the rail and the floating controls around it.
 *
 * It fills the panel the page's frame gives it rather than claiming a height of its own — the
 * frame owns the viewport and the page header. What is left here is the conversation, the rail
 * beside it, and the handful of controls that only mean anything on this page.
 *
 * It still never grows past that panel, for the reason it used to set its own fixed height:
 * the composer has to stay on screen. A conversation whose input scrolls away is one you have
 * to scroll back to in order to answer.
 */
function BuddyPageShell({
  rail,
  railToggle,
  newConversationControl,
  modeControl,
  reserveFloatingClearance = false,
  isRailOpen = false,
  children,
}: {
  /** The standing column beside the conversation — see `ConversationRail`. */
  rail?: ReactNode;
  /** What brings it back when it is closed. Positioned by the rail's own control. */
  railToggle?: ReactNode;
  /**
   * "Start a new conversation", floating over the top of the transcript. Here rather than in
   * the page header for the reason `921cf26` took it out of that header: the header is shared
   * with Chat, and only the buddy half has conversations to start.
   */
  newConversationControl?: ReactNode;
  /**
   * The conversation switcher, in a slim row above the transcript. In flow, not floating: it
   * is a standing answer to "which conversation am I in", not a transient control. Omitted for
   * a hire-only user, so nobody gets a row of nothing.
   */
  modeControl?: ReactNode;
  /**
   * Whether the floating controls above the column (the rail toggle, "start a new conversation")
   * need their room reserved. Computed by the page from the stable facts — a control withdraws
   * mid-turn, the room it withdraws from must not — and applied to the mode row, which is the
   * element those controls overlap when it renders.
   */
  reserveFloatingClearance?: boolean;
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
                row. */}
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isRailOpen ? "app-rail-open" : ""}`}
      >
        {railToggle}
        {newConversationControl}
        {modeControl && (
          <div
            data-testid="buddy-mode-band"
            className={`app-page-frame shrink-0 ${reserveFloatingClearance ? "pt-14 min-[1660px]:pt-4" : "pt-4"}`}
          >
            {modeControl}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

/**
 * The mentor buddy: the hire's conversations, the first one opened with a proactive,
 * memory-grounded greeting, the rest read as they are.
 */
function BuddyMentorHome() {
  const {
    messages,
    isThinking,
    isStreaming,
    isOpening,
    activeTool,
    openerAction,
    sendMessage,
    confirmAction,
    dismissAction,
    actionDrafts,
    setActionDraft,
    openError,
    dinoGameActive,
    closeDinoGame,
    registerDinoSurface,
    ensureOpened,
    retryOpen,
    sessions,
    currentSessionId,
    newConversation,
    selectSession,
    binSession,
    refreshSessions,
    presentedGreetingId,
    markGreetingPresented,
    teamProjectId,
    switchTeamProject,
    isGreeting,
    isDeciding,
    stopStreaming,
    retryReply,
    queued,
    queuePaused,
    removeQueued,
    pullQueuedMessage,
    resumeQueue,
    filters,
    setFilters,
    capabilitiesEnabled,
    setCapabilitiesEnabled,
  } = useBuddySession();

  // The page fills the composer (the chips, the hand-off from the dock) but never reads it — so
  // it takes the write-only half, which never changes, rather than the per-keystroke value. That
  // is what keeps a character typed into the box from re-rendering this page at all. See
  // `BuddyDraftProvider`.
  const { setDraft } = useBuddyDraftActions();
  const navigate = useNavigate();

  // The page shows the thread, so Space may open the dino game here; leaving the page releases
  // it (and closes a game still running) — see `registerDinoSurface`.
  useEffect(() => registerDinoSurface(), [registerDinoSurface]);

  // A greeting written while the hire was somewhere else still gets the buddy thinking and
  // writing it, the first time it is on screen — the same as in the dock.
  const greeting = useGreetingReveal({
    messages,
    active: true,
    presentedGreetingId,
    markGreetingPresented,
  });

  // The same conversation the dock shows, brought on screen the same way. It used to open a
  // *new* visit here, which is what threw away whatever the hire had already asked.
  useEffect(() => {
    void ensureOpened();
  }, [ensureOpened]);

  // A conversation named in the URL — the address the dock's expand hands over, and the one a
  // reload has to land on — is opened instead of the resolved newest, and the address follows
  // the conversation when it changes under it. One reconciler for both directions, because two
  // would fight: a rail pick moves the conversation while the URL still names where it was, and
  // a "honour the URL" pass reading that stale name would drag the hire straight back.
  //
  // Precedence: a URL that names neither where we are nor where we just were is an explicit
  // address — a deep link, a reload, the back button — and wins; it opens when the list knows
  // it and falls back to the bare page when it does not (a stale link is not a failed read, and
  // the banner's retry would only fail again). Otherwise a conversation that *changed* — a rail
  // pick, a bin of the current row, a new conversation — takes the address with it. The first
  // resolve is deliberately left out: the bare page keeps its bare address, and naming happens
  // up front only through the dock's hand-off, which navigates to `/buddy/<id>` itself. (A
  // reload of `/buddy/<id>` resolves to that conversation in the first place — see
  // `resolveHireSession` — so this only has to switch for an address that changed after.)
  //
  // An address that cannot be followed *now* is never left to be followed later. A switch
  // clears the thread, the composer and the queue, so one that waited out a running turn and
  // then fired on its own threw away whatever the hire had typed in the meantime — and until
  // it fired, the address named a conversation the screen was not showing. So while a turn or
  // a decision is running, or in team mode, the address goes back to the conversation on
  // screen. Only the first open is waited for: it is a moment, and nothing has been typed into
  // a conversation that is not on screen yet.
  const { id: urlSessionId } = useParams<{ id: string }>();
  const previousSessionIdRef = useRef<string | null>(currentSessionId);
  // The latest of both, for the continuations below that settle after the render that started them.
  const latestUrlSessionIdRef = useRef(urlSessionId);
  const latestSessionIdRef = useRef(currentSessionId);
  useEffect(() => {
    latestUrlSessionIdRef.current = urlSessionId;
    latestSessionIdRef.current = currentSessionId;
  });
  // The unknown address a list re-read is already answering, so the refreshed list arriving does
  // not start a second one before the first has said whether it found the conversation.
  const refreshedForRef = useRef<string | null>(null);
  const isSettling = isOpening || isGreeting;
  const cannotSwitch = isThinking || isStreaming || isDeciding || teamProjectId !== null;
  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    previousSessionIdRef.current = currentSessionId;
    // A re-read answers the address it was started for; once the address has moved on, the
    // next unknown one (or the same one, visited again) deserves its own.
    if (refreshedForRef.current !== null && refreshedForRef.current !== urlSessionId) {
      refreshedForRef.current = null;
    }

    const addressScreen = () => {
      const onScreen = latestSessionIdRef.current;
      void navigate(onScreen ? `/buddy/${onScreen}` : "/buddy", { replace: true });
    };

    if (urlSessionId && urlSessionId !== previousSessionId && urlSessionId !== currentSessionId) {
      if (sessions.length === 0 || isSettling) return;

      if (!sessions.some((session) => session.id === urlSessionId)) {
        // The list is this app session's read, and a conversation started in another tab (or
        // listed by the dashboard's fresher read) is newer than it — so one re-read before the
        // address counts as stale. Its arrival re-runs this effect, which opens a conversation
        // it found; the continuation handles the one it did not.
        if (refreshedForRef.current === urlSessionId) return;
        const target = urlSessionId;
        refreshedForRef.current = target;
        void refreshSessions().then((list) => {
          if (latestUrlSessionIdRef.current !== target) return;
          if (list?.some((session) => session.id === target)) return;
          void navigate("/buddy", { replace: true });
        });
        return;
      }

      if (cannotSwitch) {
        addressScreen();
        return;
      }

      // The session's own guards are read synchronously and can still refuse in the same frame
      // a turn starts — the answer says so, and the address goes back the same way.
      const target = urlSessionId;
      void selectSession(target).then((switched) => {
        if (!switched && latestUrlSessionIdRef.current === target) addressScreen();
      });
      return;
    }

    if (!currentSessionId || previousSessionId === null) return;
    if (urlSessionId === currentSessionId) return;
    if (urlSessionId !== undefined && urlSessionId !== previousSessionId) return;

    void navigate(`/buddy/${currentSessionId}`, { replace: true });
  }, [
    urlSessionId,
    sessions,
    currentSessionId,
    isSettling,
    cannotSwitch,
    selectSession,
    refreshSessions,
    navigate,
  ]);

  // Hire-only: the suggestions describe the *hire's* next useful question, and the backend has
  // no team-scoped list, so a team-mode conversation asks for none and shows no chips.
  const isHireMode = teamProjectId === null;
  const suggestions = useBuddySuggestions(isHireMode);
  const replies = usePmReplies(isHireMode);

  // The PM drawer's own state, and the ids the badge has already been told about. Per user,
  // because whether an answer has been seen is per person — a shared browser must not let one
  // hire's read mark another's answer as seen.
  const { profile } = useAuth();
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [seenReplyIds, setSeenReplyIds] = useState<string[]>(() =>
    readSeenReplyIds(profile?.id ?? "anonymous"),
  );
  const unseenReplyCount = replies.answered.filter(
    (request) => !seenReplyIds.includes(request.id),
  ).length;

  const openReplies = () => {
    setRepliesOpen(true);

    // Opening is reading: everything answered so far is marked seen, so the badge answers "is
    // there something I have not looked at?" rather than "has a PM ever answered me?".
    const answeredIds = replies.answered.map((request) => request.id);
    setSeenReplyIds(answeredIds);
    writeSeenReplyIds(profile?.id ?? "anonymous", answeredIds);
  };

  // Below `md` the rail is a drawer over the conversation, so it must never open by itself
  // there: the stored preference does not reopen an overlay, and nothing else opens the rail
  // on the hire's behalf.
  const isDesktop = useMediaQuery(RAIL_DESKTOP_QUERY);

  // The stored preference is only honoured where the rail is a column beside the conversation.
  // Restoring it below `md` would put the hire behind their own conversation list on every
  // visit from a phone — the rail is a drawer over the page there, with a backdrop, and nobody
  // asked for it. Their choice is still remembered; it just does not reopen an overlay.
  //
  // The rail is the hire's conversations now, so nothing opens it on their behalf — what came
  // back from the PM announces itself with the header button's badge, and a drawer nobody
  // asked for would be an overlay on a page they may be reading.
  const [rail, setRail] = useState(() => {
    const stored = readRailOpen();

    return { open: (stored ?? false) && isDesktop };
  });

  // The same rule the initial state applies, for the window narrowing after load. Not through
  // `setRailOpen` below: this is the column no longer fitting, not the hire choosing, so it
  // neither writes the preference through nor counts as having decided.
  useRailOverlayGuard(!isDesktop, () =>
    setRail((current) => (current.open ? { ...current, open: false } : current)),
  );

  // Their choice is written through as they make it, the way the chat's own rail remembers
  // being collapsed. Not inside the updater: React may run one twice.
  //
  // Recorded only from the column, which is the same width it is honoured at. Below `md` the
  // rail is a drawer somebody opens to read one answer and dismisses again — a transient thing,
  // not a statement about how they want the page laid out — and letting it write through meant
  // one tap on a phone decided how the next desktop visit opened.
  const setRailOpen = useCallback(
    (open: boolean) => {
      if (isDesktop) writeRailOpen(open);
      setRail({ open });
    },
    [isDesktop],
  );

  const hasUserMessage = messages.some((m) => m.role === "USER");

  /**
   * Whether starting a new conversation is something that can be offered at all, right now.
   *
   * One gate for all three ways of doing it — the button, the chord and the dock's own copy —
   * because they run the same function and a hire who found the one that is still live
   * mid-answer would hit exactly the bug the others are avoiding.
   *
   * `hasUserMessage`: a conversation nobody has spoken in is already the new one, so asking
   * for another would only pile up empty ones.
   *
   * `isHireMode`: team mode has one conversation per project and nothing to start.
   *
   * `!isBusy`: `newConversation` clears the thread, but it cannot call back a request already
   * streaming into it. That stream's callbacks hold the shared session rather than the thread
   * they started in, so its tool events land in the new one and its completion clears the new
   * one's thinking state. Aborting the stream is the durable fix and belongs in the session;
   * not offering the control mid-turn is the reachable half, and the same half `BuddyDock`
   * applies to its own copy.
   */
  const isBusy = isThinking || isStreaming;
  // A new conversation clears the thread, so it waits out everything writing into it — the
  // turn, the greeting stream (past its first token), and any proposal decision whose outcome
  // line would otherwise be cleared before it was read.
  const canStartConversation =
    isHireMode && hasUserMessage && !isBusy && !isOpening && !isGreeting && !isDeciding;

  // The switcher is offered on the page exactly like in the dock — to whoever manages at least
  // one project, and to nobody else, so a hire never meets a row of nothing. Read here rather
  // than inside the page-wide gate above: the gate is about *having* a project, the switcher
  // about *managing* one.
  const { projects, selectedProjectId } = useProjectContext();
  const canSwitchModes = projects.some((project) => project.isManaged);

  // Memoised so the listener is bound once rather than torn down and rebuilt on every token
  // that arrives while the buddy is answering.
  const startConversation = useCallback(() => void newConversation(), [newConversation]);

  // Memoised for the same reason: the conversation list sits in the memoised shell's subtree,
  // and a fresh handler per streamed token would re-render every row it draws.
  const selectConversation = useCallback((id: string) => void selectSession(id), [selectSession]);

  /**
   * The props the transcript's memo compares, each held in one identity.
   *
   * `BuddyThread` and its rows are memoised — that is what keeps a keystroke, and each streamed
   * token, from re-rendering every reply in the conversation — and any of these built inline
   * would hand the thread a new prop on every render of this page, which is exactly the dance
   * the memo exists to avoid. Each one's dependencies are what it is actually made of.
   */
  const renderQuestionAction = useCallback(
    (question: string) => (isHireMode ? <BuddyQuestionActions question={question} /> : undefined),
    [isHireMode],
  );
  const retryOpenAction = useCallback(() => void retryOpen(), [retryOpen]);
  // Escalating hangs off the hire's own question now, not off the buddy's answer — see
  // `BuddyQuestionActions`. What is left here is the greeting's own next step, offered where a
  // messenger offers a quick reply: right under the message that suggested it. It sends on one
  // click, unlike the chips, because accepting something the mentor just offered is not composing
  // a question of your own.
  const lastMessageFooter = useMemo(
    () =>
      !hasUserMessage && openerAction && !greeting.isRevealing ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-1.5"
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => void sendMessage(openerAction.question)}
        >
          {openerAction.label}
        </Button>
      ) : undefined,
    [hasUserMessage, openerAction, greeting.isRevealing, sendMessage],
  );

  const isSmUp = useIsSmUp();

  // The citation popover and the artifact drawer — one state pair per surface, rendered at the
  // bottom of this one. The handlers are stable, which is what the memoised thread compares.
  const citationViewer = useCitationViewer();

  // The drawer's content read is project-scoped: open citations in the conversation's own
  // project, not the globally selected one — the hire may have switched since it started.
  const citationSession = sessions.find((session) => session.id === currentSessionId);
  const citationProjectId = citationDrawerProjectId(
    citationSession?.projectId,
    teamProjectId,
    selectedProjectId,
  );

  /**
   * The suggestion row above the composer, held in one identity — the conversation below it is
   * memoised now, and an element built inline in the render would be the one prop that always
   * changed.
   *
   * The chips *fill* the composer instead of sending, which is why they sit on top of it. The
   * hire presses send: the words stay theirs, and they can edit the question first — which is how
   * somebody learns they are allowed to. The list is the backend's, built from the tools it
   * actually mounts for this hire, so the chips and the mentor cannot disagree about whether this
   * role has pull requests. Hire-only, matching the fetch gate: a team-mode conversation would
   * otherwise show the heading over an empty list, since there is nothing team-scoped to load.
   */
  const aboveComposer = useMemo(
    () =>
      isHireMode && !hasUserMessage ? (
        <BuddySuggestionChips
          suggestions={suggestions}
          onPick={setDraft}
          heading="Not sure where to start?"
          // Fewer chips on phones, not smaller ones: capping the count answers the space the
          // dock's compact mode was worried about, without shrinking a tap target right after
          // this PR grew every other one.
          limit={isSmUp ? undefined : 3}
        />
      ) : undefined,
    [isHireMode, hasUserMessage, suggestions, setDraft, isSmUp],
  );

  // The keyboard half of the buttons that start a conversation, gated the same way they are:
  // a conversation nobody has spoken in is already the new one, so the chord would only replay
  // the greeting. (There used to be a second gate on being the visible half of the assistant;
  // one surface later, the page is only ever mounted at its own addresses.)
  useNewConversationShortcut(startConversation, canStartConversation);

  // `/` puts the caret in the composer — the chord the shortcut help lists for this page. It
  // lived on the chat page and was not carried over when that page went, so the help promised a
  // key nothing answered. Text fields keep their own `/` (see `isShortcutPress`).
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const focusComposer = useCallback(() => setComposerFocusToken((token) => token + 1), []);
  useShortcutListener(FOCUS_COMPOSER_SHORTCUT, focusComposer);

  // The floating controls withdraw mid-turn (the new-conversation button while a reply streams),
  // and the room they need must not go with them — so the mode row reserves it from the stable
  // facts rather than from the controls' own presence: the rail toggle's conditions, or simply
  // that this conversation has been spoken in. The row keeps the phone value of that clearance
  // up to `min-[1660px]`, where the fluid page gutter (clamp(2rem, 9vw - 4rem, 10rem)) first
  // clears the counted rail toggle with a real margin: a two-digit reply count puts its halo at
  // ~79px, and the gutter only passes that with ~6px to spare at 1660px. Below it a select
  // sitting at the column edge would tuck its top-left corner under the toggle. Hire-flow only;
  // a team conversation has no floating controls to clear.
  // The PM button lives in the page header, so only the rail toggle and the new-conversation
  // button still float over the conversation and need their room reserved.
  const needsFloatingRoom = isHireMode && ((sessions.length > 1 && !rail.open) || hasUserMessage);

  // Opening does not gate the page. The greeting costs a model call, and blanking everything
  // behind a spinner until it lands made the hire's landing page unusable for ~20 seconds.
  // Nothing here needs the greeting in order to work: the composer sends, the chips render, and
  // the greeting arrives in its own bubble — as the buddy typing, which is the honest picture
  // of what is happening and reads as somebody writing to you rather than as a page loading.
  return (
    <>
      {/* The frame used to belong to `AssistantShell`, shared with the chat; one surface later
          it belongs to this page, and the PM drawer's button joins the header it owns. */}
      <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-app-bg lg:h-dvh">
        <header className="shrink-0 border-b border-app-border bg-app-bg">
          <div className="app-page-frame py-6">
            <PageHeader
              icon={Sparkles}
              title="Buddy"
              subtitle="Your onboarding mentor — here whenever you're stuck."
              // The subtitle is the line with the least to say on a phone, so it is the one
              // that makes room rather than pushing the conversation further down.
              hideSubtitleBelow="md"
              actions={
                // Hire-flow only, like the replies themselves: what came back from the PM is
                // an answer to the hire's own questions, and a team thread has none.
                isHireMode && replies.hasAny ? (
                  <Button
                    variant="secondary"
                    onClick={openReplies}
                    icon={<Send className="h-4 w-4" aria-hidden="true" />}
                    aria-label={
                      unseenReplyCount > 0
                        ? `Sent to your PM — ${unseenReplyCount} not looked at yet`
                        : undefined
                    }
                  >
                    Sent to your PM
                    {unseenReplyCount > 0 && (
                      <Badge variant="brand" size="sm" className="ml-1.5" aria-hidden="true">
                        {unseenReplyCount}
                      </Badge>
                    )}
                  </Button>
                ) : undefined
              }
            />
          </div>
        </header>

        <MainContent className="flex min-h-0 flex-1 flex-col">
          <BuddyPageShell
            reserveFloatingClearance={needsFloatingRoom}
            isRailOpen={rail.open}
            rail={
              // Mounted whenever it holds something, open or not: a rail that unmounted would lose
              // its scroll position every time it was put away. The hire's conversations are all it
              // holds now — what came back from the PM moved to the drawer the header button opens —
              // and two of them are the point: with one, there is nothing to switch between.
              // Hire-flow only: a team-mode conversation is not one of the hire's own.
              isHireMode && sessions.length > 1 ? (
                <ConversationRail
                  id={RAIL_ID}
                  isOpen={rail.open}
                  label={RAIL_LABEL}
                  onDismiss={() => setRailOpen(false)}
                  dismissLabel="Close your conversations"
                >
                  <div className="flex h-full min-h-0 flex-col">
                    <BuddyConversationList
                      sessions={sessions}
                      currentSessionId={currentSessionId}
                      disabled={isBusy || isOpening || isGreeting || isDeciding}
                      onSelect={selectConversation}
                      // Binning needs the awaited promise (the dialog shows its spinner on it), so
                      // this one is not wrapped in `void` like the selection above.
                      onBin={binSession}
                      // The rail's one cross, at its top: the replies panel used to carry one
                      // mid-rail, which read as closing that section alone — and a conversations-only
                      // rail had no way out at all. See the list's own `onClose`.
                      onClose={() => setRailOpen(false)}
                      // The cap only ever existed to leave the PM replies their share of the rail;
                      // they have their own drawer now, so the conversations are the whole rail.
                      className="min-h-0 flex-1"
                    />
                  </div>
                </ConversationRail>
              ) : undefined
            }
            newConversationControl={
              canStartConversation ? (
                <BuddyNewConversationButton
                  onClick={startConversation}
                  shortcut={NEW_CONVERSATION_CHORD}
                />
              ) : undefined
            }
            modeControl={
              canSwitchModes ? (
                <BuddyModeSwitcher
                  teamProjectId={teamProjectId}
                  onSwitch={(projectId) => void switchTeamProject(projectId)}
                  disabled={isBusy || isOpening || isGreeting || isDeciding}
                  className="max-w-xs"
                />
              ) : undefined
            }
            railToggle={
              // Only offered when there is something behind it: a control that opens an empty panel
              // is worse than no control. Hire-flow only, for the same reason the rail itself is.
              // No count: what a count on this toggle used to say was "your PM answered", and that
              // signal lives on the header button now.
              isHireMode && sessions.length > 1 && !rail.open ? (
                <RailToggle
                  label={RAIL_LABEL}
                  controls={RAIL_ID}
                  icon={<MessagesSquare className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setRailOpen(true)}
                />
              ) : undefined
            }
          >
            <BuddyConversation
              messages={greeting.messages}
              isThinking={isThinking || isOpening || greeting.isThinking}
              isStreaming={isStreaming}
              turnActive={isThinking || isStreaming}
              onStop={stopStreaming}
              queue={{
                items: queued,
                paused: queuePaused,
                onRemove: removeQueued,
                onPull: pullQueuedMessage,
                onSendQueued: resumeQueue,
              }}
              filters={filters}
              onFiltersChange={setFilters}
              capabilitiesEnabled={capabilitiesEnabled}
              onCapabilitiesChange={setCapabilitiesEnabled}
              composerFocusToken={composerFocusToken}
              activeTool={activeTool}
              confirmAction={confirmAction}
              dismissAction={dismissAction}
              actionDrafts={actionDrafts}
              setActionDraft={setActionDraft}
              dinoGameActive={dinoGameActive}
              onDinoGameExit={closeDinoGame}
              // Both held in one identity above, with the reasons written there — the thread's memo
              // compares them.
              lastMessageFooter={lastMessageFooter}
              // Hire-flow only: "Send this to your PM" escalates the hire's own question, and a
              // team-mode conversation is not one — the offer must not even render there.
              renderQuestionAction={renderQuestionAction}
              openError={openError}
              onRetryOpen={retryOpenAction}
              onRetryReply={retryReply}
              // Citation interaction for this surface: a `[N]` click opens the popover, and the
              // footer's "Open source" hands the artifact to the drawer — both mounted below.
              // No project to open a drawer in: pass no artifact opener, so the popover (and the
              // footer's chips) fall back to the external source link instead of dead-ending.
              onCitationClick={citationViewer.handleCitationClick}
              onOpenArtifact={citationProjectId ? citationViewer.handleOpenArtifact : undefined}
              // `hasUserMessage`, not `canStartConversation`: the button withdraws mid-turn, the room
              // it withdraws from must not. Below `md` the two clearances differ by 24px, and for a
              // hire with one conversation this is the only term that is ever true — so tying the
              // space to the button shunted the whole transcript down and back on every single turn.
              // Visible while the transcript is shorter than the viewport, which is exactly the
              // first few turns this control exists for.
              // When the mode row renders it is the element the floating controls overlap, and it
              // already carries their clearance (see the shell above) — the transcript below must
              // not reserve a second gap for the same controls.
              hasFloatingControl={
                !canSwitchModes &&
                ((isHireMode && sessions.length > 1 && !rail.open) || hasUserMessage)
              }
              // Built above, in one identity — the conversation is memoised, and the chips' own reasons
              // are written where they are built.
              aboveComposer={aboveComposer}
              focusComposerOnMount
            />
          </BuddyPageShell>
        </MainContent>
      </div>

      {/* The citation popover and the artifact drawer, once a reply's sources are clicked:
          the popover near the `[N]`, the drawer for the source itself. Rendered by the surface
                    (not the thread) so the fixed overlays are not clipped by the scroll container, and
                    gated on the conversation's project the same way the chat gates its own — the drawer
                    fetches the artifact content by id within one. */}
      {citationViewer.selectedCitation && (
        <CitationPopover
          selected={citationViewer.selectedCitation}
          onClose={citationViewer.closeCitation}
          onOpenArtifact={citationProjectId ? citationViewer.handleOpenArtifact : undefined}
        />
      )}

      {citationViewer.citationArtifact && citationProjectId && (
        <ArtifactViewerDrawer
          artifact={citationViewer.citationArtifact}
          onClose={citationViewer.closeArtifact}
          projectId={citationProjectId}
          highlightLines={citationViewer.highlightLines}
          canDelete={false}
          onDelete={() => {}}
        />
      )}

      {/* What the hire sent to a person, in the drawer the header button opens — out of the
          rail, where it used to push the conversations down and hide behind the same toggle. */}
      <SidePanel
        isOpen={repliesOpen}
        onClose={() => setRepliesOpen(false)}
        title="Sent to your PM"
        widthClassName="w-full sm:w-[26rem]"
        contentClassName="py-4"
        closeAriaLabel="Close what you sent to your PM"
      >
        <BuddyPmReplies {...replies} />
      </SidePanel>
    </>
  );
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
 *
 * Bound to `/buddy` — and `/buddy/:id` for one named conversation — open to every permission
 * group, and drawn as its own page now that the two-surface shell is gone. The header and frame
 * that used to belong to the chat-and-buddy pair live in `BuddyMentorHome` with the rest of the
 * page. A user without a selected project gets the conversation anyway: the hire's buddy is not
 * one project's, and a dead end for everyone redirected here from `/chat` is exactly what the
 * merge of the two surfaces is not allowed to leave behind.
 */
export function BuddyPage() {
  return <BuddyMentorHome />;
}
