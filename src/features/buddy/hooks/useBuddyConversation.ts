import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuddyOpeningAction } from "../../../services/buddyService";
import { useAuth } from "../../../context/useAuth";
import { useInvalidateBoard } from "../../board/hooks/useInvalidateBoard";
import type { BuddyMessageView } from "../types";
import type { BuddySessionFilters, QueuedBuddyMessage } from "../types";
import { HISTORY_FAILED } from "../conversation/replyMessages";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame";
import { useDinoSurface } from "./useDinoSurface";
import { useProposalActions } from "./useProposalActions";
import { useThreadReset } from "./useThreadReset";
import { useMentorTools } from "./useMentorTools";
import { useMessageQueue } from "./useMessageQueue";
import { useSessionStore } from "./useSessionStore";
import { useTeamMode } from "./useTeamMode";
import { useTurnRunner } from "./useTurnRunner";
import { useOpening } from "./useOpening";
import { useSessionMoves } from "./useSessionMoves";
import { useSessionResolution } from "./useSessionResolution";
import { createOpeningLatches } from "../conversation/openingLatches";

export type { ProjectSelectionSlice } from "../conversation/projectSelection";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";

/**
 * The conversation core behind every buddy surface: the message list, the optimistic
 * send-and-stream loop, and the "which tool is it running" signal.
 *
 * Deliberately knows nothing about *where* it is shown. It is instantiated exactly once, by
 * [BuddyProvider], and both surfaces read that one instance through `useBuddySession` — so a
 * hire's one buddy session really is one, rather than two lists that happen to share a name.
 *
 * Nothing is requested until a surface calls [ensureOpened].
 */
export function useBuddyConversation(
  selection: ProjectSelectionSlice,
  onTeamModeLeft?: () => void,
  /**
   * Called when a move to another conversation cut a running answer short, so the surface can
   * say so — the answer went on in a conversation the hire is no longer looking at.
   */
  onTurnStopped?: () => void,
) {
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  /**
   * The thread as of the last render, readable from the opening callbacks without making them
   * depend on it. The composer is live before the opening read settles, so a hire can speak
   * while `openSession` is still awaiting `getMessages`; the greeting guard asks this ref
   * whether anyone has spoken, because a callback's closed-over state is a render behind.
   */
  const messagesRef = useRef<BuddyMessageView[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const invalidateBoard = useInvalidateBoard();
  const {
    actionDrafts,
    setActionDraft,
    clearActionDrafts,
    isDeciding,
    decidingNow,
    confirmAction,
    dismissAction,
  } = useProposalActions({ setMessages, invalidateBoard });
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const dinoUnlocked = useDinoUnlocked();
  const { dinoGameActive, closeDinoGame, registerDinoSurface } = useDinoSurface(isThinking, {
    unlocked: dinoUnlocked,
    useGame: useSpaceOpensDino,
  });

  // The one suggested next step the opening greeting invites, until the hire acts or asks.
  const [openerAction, setOpenerAction] = useState<BuddyOpeningAction | null>(null);
  // True while a surface is opening the conversation, so it can show a loading state rather
  // than an empty thread. Starts false: nothing is opening until somebody asks.
  const [isOpening, setIsOpening] = useState(false);
  /**
   * True for as long as a greeting is actually streaming — longer than `isOpening`, which the
   * first token deliberately releases so the composer unlocks while the words are still
   * arriving. The switcher reads this one: a switch mid-greeting would clear the thread under a
   * live stream, and `isOpening` alone cannot see that window.
   */
  const [isGreeting, setIsGreeting] = useState(false);
  // Set when the conversation could not be brought on screen at all -- distinct from a turn that
  // failed, which carries its own reason. Nothing is on screen to hang that on, so it is state.
  const [openError, setOpenError] = useState<string | null>(null);

  const {
    sessions,
    currentSessionId,
    applySessions,
    applyCurrentSession,
    sessionsNow,
    currentSessionNow,
    isBinned,
    binnedNow,
    markBinned,
    shareResolution,
  } = useSessionStore();

  /**
   * The last greeting a surface has actually put in front of the hire — either watched while it
   * streamed, or revealed by `useGreetingReveal`. Held here, not per surface, so a greeting the
   * dock already played is not played again on `/buddy`, and the other way round.
   */
  const [presentedGreetingId, setPresentedGreetingId] = useState<string | null>(null);

  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const {
    isTeamMode,
    teamProjectId,
    setTeamMode,
    teamProjectNow,
    adoptTeamProject,
    bindTeamTarget,
  } = useTeamMode(selection, userId, onTeamModeLeft);

  // Guards the opening moves against overlapping calls and remembers which one "Try again" redoes.
  const [latches] = useState(createOpeningLatches);

  const { queued, queuePaused, commitQueued, setQueuePaused, queuedNow, pausedNow } =
    useMessageQueue();

  const clearThread = useThreadReset({
    setMessages,
    setOpenerAction,
    setOpenError,
    setActiveTool,
    setPresentedGreetingId,
    commitQueued,
    setQueuePaused,
    clearActionDrafts,
    closeDinoGame,
  });

  /**
   * The composer's "what goes into this message" controls: which source systems and indexed-date
   * window retrieval may use, and whether the mentor may act.
   *
   * Session-level rather than per-composer state (the dock and the page share one set): the hire
   * sets them the way they set a lens, not per question. `toWireFilters` maps the camelCase
   * shape onto the wire vocabulary when a message goes out; the switch is persisted per user,
   * default on.
   */
  const [filters, setFilters] = useState<BuddySessionFilters>({
    sourceSystems: [],
    from: "",
    to: "",
  });
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const { capabilitiesEnabled, setCapabilitiesEnabled, capabilitiesNow } = useMentorTools(userId);
  const filtersNow = useCallback(() => filtersRef.current, []);
  const onResolveFailed = useCallback(() => {
    // The banner this puts up owns the retry, like every other failure site: a stale "new
    // conversation" marker must not outvote the move that actually failed.
    latches.setRetryMove(null);
    setOpenError(HISTORY_FAILED);
  }, [latches]);

  const { resolveHireSession, refreshSessions } = useSessionResolution({
    applySessions,
    applyCurrentSession,
    sessionsNow,
    currentSessionNow,
    binnedNow,
    shareResolution,
  });

  const { tracker, sendMessage, stopStreaming, stopRunningTurn } = useTurnRunner({
    setMessages,
    setIsThinking,
    setIsStreaming,
    setActiveTool,
    setOpenerAction,
    teamProjectNow,
    currentSessionNow,
    sessionsNow,
    resolveHireSession,
    refreshSessions,
    capabilitiesNow,
    filtersNow,
    invalidateBoard,
    onResolveFailed,
    commitQueued,
    setQueuePaused,
    onTurnStopped,
  });

  const openView = useMemo(
    () => ({ setMessages, setOpenerAction, setIsOpening, setIsGreeting, setOpenError }),
    [],
  );
  const messagesNow = useCallback(() => messagesRef.current, []);
  const { openSession, ensureOpened } = useOpening({
    latches,
    view: openView,
    messagesNow,
    sessionsNow,
    currentSessionNow,
    teamProjectNow,
    resolveHireSession,
  });

  const { selectSession, newConversation, binSession, isSessionBinned } = useSessionMoves({
    latches,
    tracker,
    isOpening,
    isDeciding,
    decidingNow,
    currentSessionNow,
    sessionsNow,
    teamProjectNow,
    applySessions,
    applyCurrentSession,
    markBinned,
    isBinned,
    clearThread,
    setOpenError,
    stopRunningTurn,
    openSession,
    userId,
  });

  /**
   * Tries again after [ensureOpened] failed.
   *
   * Its own function rather than handing the surfaces `ensureOpened` directly, because the two
   * differ in the one way that matters: this is somebody asking, so it clears the failure first
   * and always attempts the read. `ensureOpened` is a mount-time warm-up that must stay a no-op
   * once the conversation is there.
   */
  const retryOpen = useCallback(async () => {
    setOpenError(null);
    // A failed "new conversation" retries as itself: `ensureOpened` would no-op out of a loaded
    // conversation.
    if (latches.retryMove() === "newConversation") {
      latches.setRetryMove(null);
      await newConversation();
      return;
    }
    await ensureOpened();
  }, [latches, ensureOpened, newConversation]);

  /**
   * The composer's entry point — and the only path a keypress or click takes to send.
   *
   * A turn already running → the message joins the queue instead of cutting the answer off;
   * that is the whole point of the queue. Sending something new is also the hire taking over
   * again, so a queue held back by Stop starts moving without another press — whether or not a
   * turn is running when they send. (Idle, the new message goes out now and the held messages
   * follow it once it closes; before, they stayed held behind a message that had overtaken them.)
   */
  const submitMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setQueuePaused(false);
      if (tracker.isStreaming()) {
        commitQueued([...queuedNow(), { id: crypto.randomUUID(), text }]);
        return;
      }
      void sendMessage(text);
    },
    [tracker, commitQueued, setQueuePaused, sendMessage, queuedNow],
  );

  /**
   * Re-asks the question a failed turn was answering — the "Try again" under its error line.
   *
   * Goes through [submitMessage], the composer's own entry point: idle it sends, mid-turn it
   * queues, exactly as if the hire had typed the question again. The failed pair stays in the
   * thread — the retired chat's toast retry did the same; trying again does not erase what
   * happened — and the question is read back out of the messages, so nothing extra is stored.
   * A turn that failed before any question (the greeting) has nothing to re-ask, and the
   * caller offers no button for it.
   */
  const retryReply = useCallback(
    (messageId: string) => {
      const list = messagesRef.current;
      const index = list.findIndex((message) => message.id === messageId);
      if (index < 0) return;
      for (let i = index - 1; i >= 0; i -= 1) {
        const message = list[i];
        if (message.role === "USER") {
          submitMessage(message.content);
          return;
        }
      }
    },
    [submitMessage],
  );

  /** Drops one queued message without sending it. */
  const removeQueued = useCallback(
    (id: string) => {
      commitQueued(queuedNow().filter((item) => item.id !== id));
    },
    [commitQueued, queuedNow],
  );

  /** Takes one queued message back out, for the composer to put in the box and edit. */
  const pullQueuedMessage = useCallback(
    (id: string): string | null => {
      const item = queuedNow().find((queued) => queued.id === id);
      if (!item) return null;
      commitQueued(queuedNow().filter((queued) => queued.id !== id));
      return item.text;
    },
    [commitQueued, queuedNow],
  );

  /**
   * Removes one queued message and starts its turn — the queue's single exit.
   *
   * Takes the item out first, so a send that throws cannot leave the same message to be sent
   * twice. Goes through `sendMessage`, never `submitMessage`: the caller has already decided
   * this message's turn is due.
   */
  const startQueuedTurn = useCallback(
    (item: QueuedBuddyMessage) => {
      commitQueued(queuedNow().filter((queued) => queued.id !== item.id));
      void sendMessage(item.text);
    },
    [commitQueued, sendMessage, queuedNow],
  );

  /**
   * Sends the oldest queued message, unless Stop is holding the queue back.
   *
   * Called from a turn's terminal path, i.e. only ever when nothing is streaming, so it cannot
   * race the answer it follows.
   */
  const drainNextQueued = useCallback(() => {
    if (pausedNow()) return;
    const next = queuedNow()[0];
    if (next) startQueuedTurn(next);
  }, [startQueuedTurn, pausedNow, queuedNow]);

  useEffect(() => {
    tracker.onEnd(drainNextQueued);
  }, [tracker, drainNextQueued]);

  /**
   * Releases a queue Stop paused, starting with the oldest message.
   *
   * Unless a turn is running again — Stop holds the queue, but a message sent after it goes
   * straight out while the hold stays (see `submitMessage`), and the hire may then ask for the
   * queue before that turn is done. Starting a second stream beside it would interleave two
   * answers; the release is then only the flag, and the running turn's close-out drains the
   * queue, in order, the moment it finishes.
   */
  const resumeQueue = useCallback(() => {
    setQueuePaused(false);
    if (tracker.isStreaming()) return;
    const next = queuedNow()[0];
    if (next) startQueuedTurn(next);
  }, [tracker, setQueuePaused, startQueuedTurn, queuedNow]);

  /**
   * The thread on screen always belongs to exactly one conversation, and when the derived
   * target moves — a switch, a restored preference arriving, an involuntary exit — the thread
   * is cleared and the new conversation opens exactly as an untouched visit would: read first,
   * then greeted. The drafts of the thread it clears go with it, like every other piece of
   * state that belonged to those offers. The backend keeps the conversations separate, so
   * reusing the latch would show one inside the other. Mid-turn the move waits: the busy flags
   * are in the dependency list, so the effect re-runs the moment the turn ends and applies then.
   */
  const openedForRef = useRef<string>("hire");
  useEffect(() => {
    const target = teamProjectId ?? "hire";
    if (openedForRef.current === target) return;
    // `pendingDecisionsRef` is read alongside the state: a decision and this move can land in
    // one frame, before the "deciding" state has re-rendered.
    if (isThinking || isStreaming || isOpening || isGreeting || isDeciding || decidingNow()) return;

    openedForRef.current = target;
    adoptTeamProject(teamProjectId);

    // Deferred to a microtask so setState never runs synchronously in the effect body; the latch
    // and the target above are already set, so nothing can start the same switch twice.
    void (async () => {
      await Promise.resolve();
      clearThread();
      setIsThinking(false);
      setIsStreaming(false);
      // The latch is per conversation: releasing it is what lets `ensureOpened` read and greet
      // the one being switched to, exactly as it did the first time.
      latches.releaseLoad();

      void ensureOpened();
    })();
  }, [
    latches,
    teamProjectId,
    isThinking,
    isStreaming,
    isOpening,
    isGreeting,
    isDeciding,
    ensureOpened,
    closeDinoGame,
    commitQueued,
    setQueuePaused,
    adoptTeamProject,
    clearThread,
    decidingNow,
  ]);

  /**
   * Points the buddy at a managed project (`null` returns to the hire's own onboarding). The
   * conversation itself is switched by the target effect above; this only sets the preference
   * and, for a project target, the global selection — team mode and the rest of the app then
   * agree on the project by construction, because they share it.
   *
   * Refused while anything is in flight, for the same reason the switcher disables itself: a
   * stream cannot call its callbacks into a thread that has just been cleared.
   */
  const switchTeamProject = useCallback(
    (projectId: string | null) => {
      // `pendingDecisionsRef` is read alongside the state: a decision and a switch can land in
      // one frame, before the "deciding" state has re-rendered.
      if (isThinking || isStreaming || isOpening || isGreeting || isDeciding || decidingNow())
        return;

      if (projectId === null) {
        setTeamMode(false);
        return;
      }

      selection.setSelectedProjectId(projectId);
      // Bind the conversation target before the derived value settles, so the adopt/exit
      // effect sees a matching pair and does not read the buddy's own switch as an exit.
      bindTeamTarget(projectId);
      setTeamMode(true);
    },
    [
      isThinking,
      isStreaming,
      isOpening,
      isGreeting,
      isDeciding,
      selection,
      setTeamMode,
      bindTeamTarget,
      decidingNow,
    ],
  );

  return {
    messages,
    isThinking,
    isStreaming,
    activeTool,
    openerAction,
    isOpening,
    // Longer than `isOpening` — the greeting keeps streaming after the composer unlocks. The
    // switch gate reads it; a surface's own "opening" indicator does not need to.
    isGreeting,
    openError,

    // Team mode: which managed project this conversation is about (`null` = the hire's own),
    // whether the manager asked for team mode at all, whether a proposal decision is in flight
    // (it gates every operation that clears the transcript), and how to switch.
    teamProjectId,
    isTeamMode,
    isDeciding,
    switchTeamProject,

    // The composer's words live in `BuddyDraftProvider`, keyed on
    // `currentSessionId`/`teamProjectId`; the wording of a proposal's fields lives here so it
    // survives a closed dock.
    actionDrafts,
    setActionDraft,
    sendMessage,
    submitMessage,
    retryReply,
    stopStreaming,
    queued,
    queuePaused,
    removeQueued,
    pullQueuedMessage,
    resumeQueue,
    filters,
    setFilters,
    capabilitiesEnabled,
    setCapabilitiesEnabled,
    confirmAction,
    dismissAction,

    dinoGameActive,
    closeDinoGame,
    dinoUnlocked,
    registerDinoSurface,

    ensureOpened,
    retryOpen,

    // The conversations on this surface: what the hire has, which one is on screen, and the
    // moves across them — a new one, a switch, and a bin. A new conversation starts empty —
    // the composer is the hire's from there (see `newConversation`).
    sessions,
    currentSessionId,
    newConversation,
    selectSession,
    binSession,
    isSessionBinned,
    refreshSessions,

    presentedGreetingId,
    markGreetingPresented: setPresentedGreetingId,
  };
}
