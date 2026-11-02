import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMessages,
  getSessions,
  createSession,
  binSession as binSessionApi,
  streamOpenBuddy,
  type BuddyOpeningAction,
  type BuddySessionSummary,
} from "../../../services/buddyService";
import { buddySessionIdFromPath } from "../buddyPagePath";
import { clearDraft } from "../buddyDraftStorage";
import { useAuth } from "../../../context/useAuth";
import { useInvalidateBoard } from "../../board/hooks/useInvalidateBoard";
import type { BuddyMessage, BuddyMessageView } from "../types";
import type { BuddySessionFilters, QueuedBuddyMessage } from "../types";
import {
  BIN_MOVE_FAILED,
  CONVERSATION_FAILED,
  GREETING_FAILED,
  HISTORY_FAILED,
  isNotFound,
} from "../conversation/replyMessages";
import {
  appendToken,
  greetingPlaceholder,
  settleGreeting,
  withHistory,
} from "../conversation/messageReducers";
import {
  blankSession,
  chooseSession,
  mergeFetchedSessions,
  reusableBlankSession,
} from "../conversation/sessionRules";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame";
import { useDinoSurface } from "./useDinoSurface";
import { useProposalActions } from "./useProposalActions";
import { useThreadReset } from "./useThreadReset";
import { useMentorTools } from "./useMentorTools";
import { useMessageQueue } from "./useMessageQueue";
import { useSessionStore } from "./useSessionStore";
import { useTeamMode } from "./useTeamMode";
import { useTurnRunner } from "./useTurnRunner";

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

  const loadedRef = useRef(false);
  // Guards the greeting against overlapping calls — see `newConversation` and `selectSession`.
  const greetingRef = useRef(false);
  /**
   * Which move the banner's "Try again" must redo. A failed "new conversation" retries as
   * itself — `ensureOpened` would no-op out of it (the conversation is already loaded), which
   * cleared the banner and did nothing else. Set by the failure site, consumed by `retryOpen`.
   */
  const retryRef = useRef<"newConversation" | null>(null);

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
    retryRef.current = null;
    setOpenError(HISTORY_FAILED);
  }, []);

  /**
   * Streams the buddy's opening greeting into the thread.
   *
   * Only called for a conversation with nothing in it — the hire's first, or a team
   * conversation nobody has spoken in. A conversation that already has words is read, never
   * re-greeted: the greeting belongs to the conversation, and the second one *under* the
   * transcript was what the visit divider used to explain — both went with the visit model
   * (visits are replaced by conversations, and only the hire's first conversation opens with
   * the greeting; see the issue).
   *
   * The greeting is a single growing message rather than one per token, so the hire watches it
   * being written instead of watching messages pile up.
   *
   * @param target - Which conversation it is for — `sessionId` for the hire's own, or
   *   `teamProjectId` for a team conversation. Passed at call time, never captured: a switch
   *   that lands between turns opens the right one.
   */
  const greet = useCallback(async (target: { sessionId?: string; teamProjectId?: string }) => {
    const id = crypto.randomUUID();

    // The greeting claims its place in the thread before the stream is awaited: the composer is
    // live while it is written, and a question typed straight away must not land above it. An empty
    // assistant turn renders nothing (see `BuddyThread`).
    setMessages((prev) => [...prev, greetingPlaceholder(id, new Date().toISOString())]);

    // A bag rather than two `let`s: a local written only inside callbacks narrows to its initial
    // value at the read below, a property does not.
    const stream = { wroteSomething: false, failure: null as string | null };

    // The switch gate holds for the whole greeting, not just the empty-screen part — see
    // `isGreeting`.
    setIsGreeting(true);
    try {
      await streamOpenBuddy(
        {
          onToken: (token) => {
            stream.wroteSomething = true;
            setMessages((prev) => appendToken(prev, id, token));
            // The surface stops waiting at the first word, not the last: everything after this
            // is the hire reading along, and the composer is theirs from here.
            setIsOpening(false);
          },
          onAction: setOpenerAction,
          onDone: () => setIsOpening(false),
          onError: (message) => {
            console.error(message);
            stream.failure = GREETING_FAILED;
          },
        },
        target.sessionId,
        target.teamProjectId,
      );
    } catch (e) {
      console.error(e);
      stream.failure = GREETING_FAILED;
    } finally {
      setMessages((prev) => settleGreeting(prev, id, stream));

      setIsOpening(false);
      setIsGreeting(false);
    }
  }, []);

  /** Merges a read window in front of whatever is already there, never assigned over it.
   *
   * The fetch is in flight while the composer is live, so a hire who types straight away has
   * an optimistic turn in the list by the time this resolves — assigning would delete their
   * own message out from under them. History is older, so it belongs in front.
   */
  const mergeHistory = useCallback((history: BuddyMessage[]) => {
    setMessages((prev) => withHistory(prev, history));
  }, []);

  /**
   * The conversation the hire was last in: their newest one, or a brand-new one when they
   * have none at all.
   *
   * Prefers the conversation this app session was already in when the list still holds it —
   * a team-mode round trip or a retry must not move the hire out of their conversation. Before
   * that, a conversation the address names (`/buddy/:id` — a reload, a shared link): resolving
   * the newest and then switching would read a conversation nobody asked for and flash it, and
   * the switch is refused while that first read is still running. Read from the window at
   * resolve time, like `currentPage` on a send, because the dock resolves at app mount — before
   * the lazily loaded page could hand the address over.
   *
   * Memoised in flight, because the composer is live from the first paint: a send racing the
   * opening read must land on the same conversation, not create a second.
   */
  const resolveHireSession = useCallback(async (): Promise<string> => {
    return shareResolution(async () => {
      const list = await getSessions();

      if (list.length > 0) {
        const addressed = buddySessionIdFromPath(window.location.pathname);
        const chosen = chooseSession(list, addressed, currentSessionNow());
        applySessions(list);
        applyCurrentSession(chosen);
        return chosen;
      }

      const createdId = await createSession();
      applySessions([blankSession(createdId, new Date().toISOString())]);
      applyCurrentSession(createdId);
      return createdId;
    });
  }, [applySessions, applyCurrentSession, shareResolution, currentSessionNow]);

  /**
   * Re-reads the conversation list.
   *
   * The backend names a conversation from its first message, and the list is otherwise read
   * once at open and edited locally from there — so without this, every conversation started in
   * a session read "New conversation" in the rail until a reload. Called when a first turn
   * completes on a row that is still untitled; the refreshed read naturally stops needing it.
   * The page also calls it once before giving up on an address the list does not hold — a
   * conversation started in another tab is newer than this session's read.
   *
   * @returns The list as applied, or `null` when the read failed.
   */
  const refreshSessions = useCallback(async (): Promise<BuddySessionSummary[] | null> => {
    try {
      const read = await getSessions();

      // A conversation binned while this read was in flight is still in it — the read is a
      // moment — so the tombstone wins over the row (see `binnedSessionIdsRef`); and one created
      // while it was in flight is newer than that moment, so it stays in front.
      const next = mergeFetchedSessions(read, binnedNow(), sessionsNow());
      applySessions(next);
      return next;
    } catch (e) {
      // Cosmetic only: the rail keeps the titles it has; the next completed turn tries again.
      console.error(e);
      return null;
    }
  }, [applySessions, binnedNow, sessionsNow]);

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

  /**
   * Brings one conversation on screen: reads it, merges its window in front of anything the
   * composer has already put up, and greets only the hire's first, never-spoken conversation.
   * Never-spoken is read as of when the read settles: a turn the composer sent while
   * `getMessages` was still in flight is the hire having spoken, and a greeting over it would
   * answer their question with a hello.
   *
   * A conversation with anything in it is read, not re-greeted — the greeting belongs to the
   * conversation, not to every reopening of it — and a conversation the hire created on
   * purpose starts empty, the composer theirs (see `newConversation`).
   *
   * Throws when the read fails; the callers decide what that means (the mount warm-up
   * releases its latch so "Try again" can retry, a pick from the list reports it in place).
   */
  const openSession = useCallback(
    async (sessionId: string) => {
      setIsOpening(true);
      setOpenError(null);

      try {
        const history = await getMessages(sessionId);

        // A read for a conversation that has left the screen is not this thread's to show. Every
        // switch refuses while an open runs, so this guards the invariant for the next caller.
        if (currentSessionNow() !== sessionId) return;

        mergeHistory(history);

        if (
          history.length === 0 &&
          sessionsNow().length === 1 &&
          !messagesRef.current.some((message) => message.role === "USER")
        ) {
          greetingRef.current = true;
          try {
            await greet({ sessionId });
          } finally {
            greetingRef.current = false;
          }
        }
      } finally {
        setIsOpening(false);
      }
    },
    [greet, mergeHistory, currentSessionNow, sessionsNow],
  );

  /**
   * Brings the current conversation on screen, once per app session.
   *
   * For the hire it first resolves *which* conversation that is — the newest, or the one this
   * window was last in — then reads it and, only for the first, still-empty conversation,
   * opens the greeting. Reading first is what keeps a reload from replacing the transcript:
   * everything read is merged in front of what is already on screen, never assigned over it.
   *
   * Nothing is deleted by leaving a conversation, and nothing older than its current window is
   * replayed — `getMessages` returns from the conversation's last opening marker, and the
   * durable memory note, not the transcript, is what carries continuity.
   *
   * Team mode names its project instead of a session: one conversation per project, read the
   * same way and greeted only while it is still empty.
   *
   * Idempotent by ref rather than by state, so the dock's mount effect and the page's can both
   * call it without either double-fetching or racing.
   */
  const ensureOpened = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setIsOpening(true);
    setOpenError(null);

    try {
      const teamId = teamProjectNow();

      if (teamId === null) {
        const sessionId = await resolveHireSession();
        await openSession(sessionId);
      } else {
        const history = await getMessages(undefined, teamId);

        // Same invariant as `openSession`'s: a switch that happened while this read was in
        // flight makes the read stale, and stale history does not merge.
        if (teamProjectNow() !== teamId) return;

        mergeHistory(history);

        if (
          history.length === 0 &&
          !messagesRef.current.some((message) => message.role === "USER")
        ) {
          greetingRef.current = true;
          try {
            await greet({ teamProjectId: teamId });
          } finally {
            greetingRef.current = false;
          }
        }
      }
    } catch (e) {
      console.error(e);
      // This failure owns the banner: a retry must redo *this* read, not a stale move.
      retryRef.current = null;
      // The latch goes back, or one blip is permanent: this runs as the app root mounts, the widget
      // never unmounts, and `retryOpen` is the only way back.
      loadedRef.current = false;
      setOpenError(HISTORY_FAILED);
    } finally {
      setIsOpening(false);
    }
  }, [resolveHireSession, openSession, mergeHistory, greet, teamProjectNow]);

  /**
   * Brings a conversation the hire picked from the list on screen.
   *
   * Reads it and shows it — no greeting: only the first, never-spoken conversation opens with
   * one (see `openSession`), and everything else is a continuing thing the hire asked to see
   * again, not a fresh start. A running answer is cut short first (see `stopRunningTurn`);
   * anything else that is in flight refuses, like every other move that clears the thread.
   *
   * @returns Whether the conversation asked for is the one on screen now — `false` only for a
   *   refusal, so a caller acting on someone else's behalf (the page following its address) can
   *   tell "switched" from "nothing happened" instead of guessing from state a render behind.
   *   A running answer is not a refusal.
   */
  const selectSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (sessionId === currentSessionNow()) return true;
      if (teamProjectNow() !== null) return false;
      const blocked = () => greetingRef.current || isOpening || isDeciding || decidingNow();
      if (blocked()) return false;

      if (tracker.isStreaming()) {
        await stopRunningTurn();
        // Anything may have moved during the wait (another switch, a queued message that started as
        // the turn ended); whoever is ahead keeps the thread.
        if (blocked() || tracker.isStreaming() || teamProjectNow() !== null) return false;
        if (sessionId === currentSessionNow()) return true;
      }
      greetingRef.current = true;

      applyCurrentSession(sessionId);
      clearThread();

      try {
        await openSession(sessionId);
      } catch (e) {
        console.error(e);
        // Release the latch so the banner's "Try again" can re-run the read for this
        // conversation; the switch itself stays, and the banner says what failed.
        loadedRef.current = false;
        // This failure owns the banner: a retry must redo this read, not a stale move.
        retryRef.current = null;
        setOpenError(HISTORY_FAILED);
      } finally {
        greetingRef.current = false;
      }

      // Switched even when the read failed: the conversation on screen is the one asked for,
      // and the banner owns the failure.
      return true;
    },
    [
      tracker,
      isOpening,
      isDeciding,
      stopRunningTurn,
      applyCurrentSession,
      openSession,
      currentSessionNow,
      teamProjectNow,
      clearThread,
      decidingNow,
    ],
  );

  /**
   * Starts a new conversation: creates it server-side and switches to it, empty.
   *
   * A new conversation starts with an empty thread and the composer the hire's — they speak
   * first, and the title is written from that first message server-side. Only the hire's
   * first, never-spoken conversation opens with a greeting (see `openSession`), so nothing is
   * requested here.
   *
   * A still-untouched conversation the hire already has comes back instead of a second one
   * being created, and the create re-checks after its round trip: a turn or decision that
   * starts while it is in flight wins, and the new conversation is not adopted.
   *
   * Nothing is deleted: the conversation being left keeps its transcript and stays in the
   * list. The buddy's durable memory note is untouched — it is what keeps "new" from meaning
   * "starting over". Only the hire's scrollback moves on — together with any offer wording they
   * had half-edited, which belonged to the offers in it.
   *
   * A running answer is cut short first (see `stopRunningTurn`), because a stream cannot call its
   * callbacks into a thread that has just been cleared. Anything else in flight refuses, for the
   * same reason every other transcript-clearing move does. `pendingDecisionsRef` is read
   * alongside the state — a decision and this click can land in one frame, before the
   * "deciding" state has re-rendered.
   */
  const newConversation = useCallback(async () => {
    // The conversations list is the hire's surface; team mode has one conversation per project
    // and nothing to start. The controls that call this are hidden there too, but a stale
    // keyboard shortcut must not switch a manager into an empty hire thread.
    if (teamProjectNow() !== null) return;
    const blocked = () => greetingRef.current || isOpening || isDeciding || decidingNow();
    if (blocked()) return;

    if (tracker.isStreaming()) {
      await stopRunningTurn();
      // As in `selectSession`: what moved during the wait is ahead of this click.
      if (blocked() || tracker.isStreaming() || teamProjectNow() !== null) return;
    }

    // An untitled newest conversation is one nobody has written into (the backend titles from the
    // first message), so it is brought back instead of stacking a second empty one.
    const newest = reusableBlankSession(sessionsNow(), currentSessionNow());
    if (newest) {
      await selectSession(newest.id);
      return;
    }

    greetingRef.current = true;
    // What this click saw, for the re-check after the create: a send that begins during the round
    // trip would otherwise land in the conversation being left and lose its optimistic turn to the
    // clears below.
    const sessionAtEntry = currentSessionNow();
    const sendsAtEntry = tracker.sendCount();

    try {
      const createdId = await createSession();

      if (
        tracker.sendCount() !== sendsAtEntry ||
        decidingNow() ||
        teamProjectNow() !== null ||
        currentSessionNow() !== sessionAtEntry
      ) {
        // Something moved while the create was in flight; the new conversation stays unadopted (a
        // later refresh lists it) and the user's actual move keeps its turn.
        return;
      }

      // Newest first, like the backend's own ordering.
      applySessions([blankSession(createdId, new Date().toISOString()), ...sessionsNow()]);
      applyCurrentSession(createdId);

      clearThread();
    } catch (e) {
      console.error(e);
      // "Try again" redoes the create itself: `ensureOpened` would no-op out of a loaded
      // conversation, so the retry has to be this move, not the opening read.
      retryRef.current = "newConversation";
      setOpenError(CONVERSATION_FAILED);
    } finally {
      greetingRef.current = false;
    }
  }, [
    tracker,
    isOpening,
    isDeciding,
    stopRunningTurn,
    applySessions,
    applyCurrentSession,
    selectSession,
    currentSessionNow,
    sessionsNow,
    teamProjectNow,
    clearThread,
    decidingNow,
  ]);

  /**
   * Bins one of the hire's conversations and takes it out of the list.
   *
   * Binned, not deleted: the backend keeps the conversation — messages included — until its
   * retention window ends, and simply stops returning it. So the local removal is the same
   * thing the next read would show, and the id is tombstoned so a read already in flight
   * cannot put the row back (see `binnedSessionIdsRef`).
   *
   * When the conversation binned was the one on screen, the next newest takes its place — or,
   * with none left, a fresh conversation starts, so the hire is never left on a thread they
   * just binned. `selectSession`/`newConversation` own that move and its clears; both are
   * called with nothing in flight (a running answer in the binned conversation is cut short
   * first, see `stopRunningTurn`), so neither refuses.
   *
   * Refused while the conversation is opening or a decision is in flight — the rail's own
   * controls are disabled for the same window, so this is the guard behind them — and unlike the
   * other moves that clear the thread, the refusal throws: the list tells the user the bin
   * worked, so returning silently would toast "Conversation binned" over a conversation that
   * never left. A running answer in *another* conversation is left alone; binning a row does not
   * touch it.
   *
   * A `404` is settled, not failed: the conversation was binned in another tab, or purged after
   * its retention window — the local removal below is what the next read would show anyway. And
   * the throw is not only for refusals: if the move off a binned conversation fails, this throws
   * too, so the success toast cannot sit over a screen still showing the thread that was binned.
   */
  const binSession = useCallback(
    async (sessionId: string) => {
      if (teamProjectNow() !== null)
        throw new Error("Conversations can't be binned while you're in team mode.");
      if (greetingRef.current || isOpening || isDeciding || decidingNow())
        throw new Error("Your buddy is still working — try again once the reply finishes.");

      try {
        await binSessionApi(sessionId);
      } catch (e) {
        // See the doc above: "gone already" is settled, and settled for this call only.
        // Anything else is a real failure and belongs to the caller.
        if (!isNotFound(e)) throw e;
      }
      markBinned(sessionId);
      // Its draft goes with it. The box files its words under a conversation as it leaves it —
      // `isSessionBinned` is what keeps that write from bringing the entry back.
      clearDraft(userId, sessionId);

      const remaining = sessionsNow().filter((session) => session.id !== sessionId);
      applySessions(remaining);

      if (currentSessionNow() !== sessionId) return;

      // The answer being written belongs to the binned conversation; stopping it once here keeps
      // the two paths from toasting twice.
      if (tracker.isStreaming()) await stopRunningTurn();

      const next = remaining[0];
      if (next) {
        await selectSession(next.id);
      } else {
        await newConversation();
      }

      // The move can fail and still resolve (see `newConversation`'s catch); if the hire is still
      // on the binned conversation, the caller must hear it.
      if (currentSessionNow() === sessionId) throw new Error(BIN_MOVE_FAILED);
    },
    [
      tracker,
      applySessions,
      isOpening,
      isDeciding,
      stopRunningTurn,
      selectSession,
      newConversation,
      userId,
      currentSessionNow,
      markBinned,
      sessionsNow,
      teamProjectNow,
      decidingNow,
    ],
  );

  /**
   * Whether a conversation was binned in this app session — what the composer asks before it
   * files a draft under one it is leaving, since a binned conversation has nothing to keep it
   * for. Reads the tombstones `binSession` leaves, so it is true from the moment of the bin.
   */
  const isSessionBinned = useCallback((sessionId: string) => isBinned(sessionId), [isBinned]);

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
    if (retryRef.current === "newConversation") {
      retryRef.current = null;
      await newConversation();
      return;
    }
    await ensureOpened();
  }, [ensureOpened, newConversation]);

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
      loadedRef.current = false;

      void ensureOpened();
    })();
  }, [
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
