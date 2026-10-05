import { useCallback, useEffect, useRef, useState } from "react";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame";
import {
  getMessages,
  getSessions,
  createSession,
  streamOpenBuddy,
  performAction,
  confirmStoredProposal,
  dismissStoredProposal,
  streamMessage,
  type BuddyOpeningAction,
  type BuddySessionSummary,
} from "../../../services/buddyService";
import { announceBuddyPathChanged } from "../aiBuddyBus";
import { actionDraftKey } from "../actionDrafts";
import type { ActionDrafts } from "../actionDrafts";
import { BUDDY_PATH_ACTIONS } from "../types";
import { useAuth } from "../../../context/useAuth";
import { useInvalidateBoard } from "../../board/hooks/useInvalidateBoard";
import {
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_CLAIM_GOAL,
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_EDIT_CHECKLIST,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_EDIT_NOTE,
  BUDDY_ACTION_PLACE_CHECKLIST,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_ACTION_REORDER_CARDS,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
} from "../types";
import type { ActionPatch, BuddyMessage, BuddyMessageView, ProposedAction } from "../types";

/**
 * The slice of the global project context the buddy needs to keep team mode honest: team mode
 * is bound to the globally selected project, and only exists while this user manages it. Passed
 * in by [BuddyProvider] rather than read here, so the hook stays testable without a provider
 * above it.
 */
export type ProjectSelectionSlice = {
  selectedProjectId: string;
  hasSelectedProject: boolean;
  canManageSelected: boolean;
  isLoading: boolean;
  setSelectedProjectId: (projectId: string) => void;
};

/**
 * What the hire is told when a stream does not finish.
 *
 * Plain, and never the raw failure: a transport message or an HTTP status answers a question
 * nobody asked. What matters is whether trying again is worth it, so each line says so.
 */
const REPLY_FAILED = "Your buddy could not finish that reply. Ask again in a moment.";
const GREETING_FAILED = "Your buddy could not be reached just now.";
const HISTORY_FAILED = "Your conversation could not be loaded.";
const CONVERSATION_FAILED = "Your buddy could not start a new conversation. Ask again in a moment.";
/** The one sentence for a proposal that no longer exists for this caller (HTTP 404). */
const PROPOSAL_GONE = "This proposal is no longer available.";

function isNotFound(e: unknown): boolean {
  return e instanceof Error && "status" in e && (e as { status: number }).status === 404;
}

/**
 * The hire-confirmed buddy actions that write to the board, by their wire names: the five
 * `BuddyBoardWriteActions` handles (placing, amending, ticking and rewording a checklist, and
 * the note), the six board edits (a link, editing a note, link or checklist, clearing cards off
 * and rearranging them), plus `claim_goal`, which pins the claimed task as the board's CURRENT_TASK card —
 * its own outcome line says so ("It's on your board too"). Every other confirm changes something
 * else — a task claim, an attestation request, a flag, a username — and needs no board sync.
 */
const BUDDY_BOARD_ACTIONS = new Set<string>([
  BUDDY_ACTION_PLACE_CHECKLIST,
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_ACTION_CLAIM_GOAL,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_EDIT_NOTE,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_EDIT_CHECKLIST,
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_REORDER_CARDS,
]);

/**
 * The mid-answer tool that puts a card on the board. `place_card` is deliberately not a confirmed
 * action — it applies the moment the mentor runs it — so a turn that ran it is the only signal
 * the client ever gets that the board moved. Acted on by `sendMessage` when the turn ends.
 */
const BUDDY_BOARD_TOOLS = new Set<string>(["place_card"]);

/**
 * Where "is the buddy in team mode" lives between reloads — scoped to the signed-in user, the
 * way the project selection is. A shared browser must not hand one manager's team conversation
 * to the next.
 */
function teamModeStorageKey(userId: string): string {
  return `buddyTeamMode:${userId}`;
}

function readStoredTeamMode(userId: string): boolean {
  try {
    return localStorage.getItem(teamModeStorageKey(userId)) === "true";
  } catch {
    // Private modes can refuse storage outright. Not a reason to refuse the conversation.
    return false;
  }
}

function writeStoredTeamMode(userId: string, value: boolean): void {
  try {
    localStorage.setItem(teamModeStorageKey(userId), value ? "true" : "false");
  } catch {
    // Nothing to do: the conversation still switches, it just will not be remembered.
  }
}

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
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Dino waiting-game: unlocked users may press Space while the buddy thinks
  // to play the runner until the answer arrives — the same deal the AI chat
  // offers. Closing is handled inside the hook: on exit, when the turn ends,
  // or when the cogwheel unlock flag flips off.
  const dinoUnlocked = useDinoUnlocked();
  // How many surfaces currently show this thread (the open dock, the mounted `/buddy` page).
  // The session lives app-wide in BuddyProvider, so arming on `isThinking` alone let Space open
  // a game inside a minimised dock nobody could see — and with `keepActiveUntilExit` that
  // invisible game held the shared slot for good. Surfaces register via `useDinoSurface`.
  const [dinoSurfaceCount, setDinoSurfaceCount] = useState(0);
  const dinoSurfaceVisible = dinoSurfaceCount > 0;
  const [dinoGameActive, closeDinoGame] = useSpaceOpensDino(
    isThinking && dinoSurfaceVisible,
    dinoUnlocked,
    {
      // Parity with the chat and the drawer: the game outlives the turn it was armed for
      // and stays open until the player leaves it — the reply's arrival only flips its
      // completion badge. Without this the first token unmounted the game mid-run.
      keepActiveUntilExit: true,
    },
  );

  // The last visible surface went away (dock minimised, page left): the game it hosted is gone
  // from screen, so it must not keep running — or keep the shared slot — behind it.
  useEffect(() => {
    if (!dinoSurfaceVisible) closeDinoGame();
  }, [dinoSurfaceVisible, closeDinoGame]);

  /**
   * Declares that a surface showing this thread is on screen. Returns the matching release;
   * meant to be called from an effect (see `useDinoSurface`).
   */
  const registerDinoSurface = useCallback(() => {
    setDinoSurfaceCount((count) => count + 1);
    return () => setDinoSurfaceCount((count) => count - 1);
  }, []);

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

  /**
   * The conversations this hire owns, newest first — read once at the first open, then kept in
   * step by the two moves across it ([newConversation], [selectSession]). The ref shadows the
   * list for the same reason every other ref here does: a decision made mid-flight reads the
   * current value without every token re-creating its callbacks.
   */
  const [sessions, setSessions] = useState<BuddySessionSummary[]>([]);
  const sessionsRef = useRef<BuddySessionSummary[]>([]);
  /** Which conversation is on screen. `null` only before the first open has resolved one. */
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  /**
   * One resolution per app session, shared by every caller that can start one.
   *
   * The composer is live from the first paint, so a send can beat the opening read; without
   * this, two lookups racing an empty list would create two first conversations.
   */
  const resolvingRef = useRef<Promise<string> | null>(null);

  const applySessions = useCallback((next: BuddySessionSummary[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const applyCurrentSession = useCallback((sessionId: string | null) => {
    currentSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
  }, []);

  /**
   * Bumped whenever the conversation on screen is replaced — a new conversation, a selection,
   * a project switch.
   *
   * The composer's words are not this hook's any more (see `BuddyDraftProvider`), so the one
   * thing this session still owes them is the news that they belonged to a thread that is gone.
   * Told as a token rather than a call: the composer's state lives *below* this hook's provider,
   * and a parent cannot reach into a child's setter.
   */
  const [draftResetToken, setDraftResetToken] = useState(0);
  /**
   * The hire's wording for the proposals that carry an editable message — a flag's question, the
   * only payload a person reads and the hire therefore rewords (see `actionDrafts` for the key).
   *
   * Session state rather than card state, for the same reason the composer's words are: the dock
   * unmounts when it closes, the full page mounts a second card for the same action, and either
   * one would otherwise throw away words the hire was halfway through. Unlike the composer's,
   * nothing below this provider needs to write it, so it lives here rather than in a context.
   */
  const [actionDrafts, setActionDrafts] = useState<ActionDrafts>({});
  /**
   * The last greeting a surface has actually put in front of the hire — either watched while it
   * streamed, or revealed by `useGreetingReveal`. Held here, not per surface, so a greeting the
   * dock already played is not played again on `/buddy`, and the other way round.
   */
  const [presentedGreetingId, setPresentedGreetingId] = useState<string | null>(null);

  /**
   * Whether the manager has pointed the buddy at a project instead of their own onboarding.
   * Persisted per signed-in user; the *project* it means is never stored independently — it is
   * whichever project the global context currently vouches for (see the derivation below), so
   * team mode and the rest of the app can never disagree about which project is being discussed.
   */
  const [isTeamMode, setIsTeamMode] = useState(false);

  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const userIdRef = useRef<string | null>(null);
  // Declared before the effect that resets it: the target binding must not outlive the user whose
  // thread created it.
  const teamTargetRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = userId;
    // A signed-in-user change drops the old user's project binding here, not just the visible
    // mode: a stale target would make the adopt effect compare the next user's selection against
    // it and overwrite their restored preference with a bogus exit.
    teamTargetRef.current = null;
    // Re-read on every subject change: a logout or an account switch must not inherit the
    // previous user's preference. Nothing persisted while there is no user to own it.
    // Deferred to a microtask so the setState never runs synchronously in the effect body.
    void (async () => {
      await Promise.resolve();
      setIsTeamMode(userId === null ? false : readStoredTeamMode(userId));
    })();
  }, [userId]);

  /**
   * Which project the *thread on screen* is bound to — the conversation may lag the derived
   * target while a switch is pending. `null` means team mode is on but has not adopted a
   * project yet (a restored preference waiting for the list to vouch).
   */

  const setTeamMode = useCallback((value: boolean) => {
    setIsTeamMode(value);
    const id = userIdRef.current;

    if (id !== null) writeStoredTeamMode(id, value);
    if (!value) teamTargetRef.current = null;
  }, []);

  /**
   * The managed project this conversation is about, or `null` for the hire's own. Derived,
   * never stored: it exists only while the team preference is on *and* the loaded project list
   * vouches that this user manages the selected project. That derivation is the scoping
   * guarantee — before the list arrives, or once management is gone, the value collapses to the
   * hire conversation, so no team-scoped request can go to a project the buddy has no business
   * touching. Held as a ref alongside the state so the streaming calls read the current
   * conversation mid-turn without every token re-creating their callbacks.
   */
  const teamProjectId =
    isTeamMode && selection.hasSelectedProject && selection.canManageSelected
      ? selection.selectedProjectId
      : null;
  const teamProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    teamProjectIdRef.current = teamProjectId;
  }, [teamProjectId]);

  /**
   * Team mode ends involuntarily when the ground moves under it: the selected project is no
   * longer manageable, or the manager moved the global selection somewhere else while the buddy
   * was discussing the old one. The conversation then falls back to the hire thread — audibly,
   * via [onTeamModeLeft], because a silent fallback is exactly the drift this binding exists to
   * prevent. Voluntary switches never pass through here: they go through
   * [switchTeamProject], which binds the new target before the state settles, so this effect
   * sees a matching pair and stays out of the way.
   */
  useEffect(() => {
    if (!isTeamMode || selection.isLoading) return;

    void (async () => {
      await Promise.resolve();
      if (teamTargetRef.current === null) {
        // A restored preference adopting whatever the loaded list vouches for. Nothing to bind
        // to — no selection, or none of it manageable — and team mode ends audibly.
        if (selection.hasSelectedProject && selection.canManageSelected) {
          teamTargetRef.current = selection.selectedProjectId;
        } else {
          setTeamMode(false);
          onTeamModeLeft?.();
        }
        return;
      }

      if (!selection.canManageSelected || selection.selectedProjectId !== teamTargetRef.current) {
        setTeamMode(false);
        onTeamModeLeft?.();
      }
    })();
  }, [
    isTeamMode,
    selection.isLoading,
    selection.hasSelectedProject,
    selection.canManageSelected,
    selection.selectedProjectId,
    setTeamMode,
    onTeamModeLeft,
  ]);

  /**
   * True while a proposal confirm or dismissal is in flight. Unlike the message streams, these
   * decisions mutate state without setting any of the streaming flags, and every operation that
   * clears the transcript (a switch, a fresh visit) must wait for them: a manager who confirms
   * a destructive change and immediately switches projects would otherwise lose the one place
   * the outcome was going to be shown.
   */
  const pendingDecisionsRef = useRef(0);
  const [isDeciding, setIsDeciding] = useState(false);

  const loadedRef = useRef(false);
  // Guards the greeting against overlapping calls — see `newConversation` and `selectSession`.
  const greetingRef = useRef(false);
  /**
   * Counts sends that have started, monotonic. Compared across the create round trip in
   * `newConversation`: a send that begins while the create is in flight reads the session ref
   * synchronously and would land in the conversation being left — so it wins, and the new
   * conversation is simply not adopted.
   */
  const sendCountRef = useRef(0);
  /**
   * Which move the banner's "Try again" must redo. A failed "new conversation" retries as
   * itself — `ensureOpened` would no-op out of it (the conversation is already loaded), which
   * cleared the banner and did nothing else. Set by the failure site, consumed by `retryOpen`.
   */
  const retryRef = useRef<"newConversation" | null>(null);

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

    // Its place in the thread is claimed *before* the stream is awaited, not on the first
    // token. The composer is live while the greeting is being written, so a hire who types
    // straight away would otherwise have their question appended first and the greeting land
    // underneath it — answering nothing. An empty assistant turn renders nothing (see
    // `BuddyThread`), so the placeholder is invisible until the first word arrives.
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
        citations: [],
        isGreeting: true,
      },
    ]);

    // Read back after the stream, which is why it is a bag rather than two `let`s: the compiler
    // narrows a local to its initial value when the only writes are inside callbacks, so the
    // reason would type as `null` at the point it is used. A property's narrowing is dropped at
    // the call, which is exactly the behaviour wanted here.
    const stream = { wroteSomething: false, failure: null as string | null };

    // The switch gate holds for the whole greeting, not just the empty-screen part — see
    // `isGreeting`.
    setIsGreeting(true);
    try {
      await streamOpenBuddy(
        {
          onToken: (token) => {
            stream.wroteSomething = true;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === id ? { ...message, content: message.content + token } : message,
              ),
            );
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
      const reason = stream.failure;

      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((message) => message.id !== id);

        // Nothing came, and nothing went wrong: the placeholder held the greeting's *place*
        // while it was being written, and once it is established that no words are coming, an
        // empty assistant turn would sit in the conversation for the rest of the session. It
        // renders as nothing, which is worse than useless -- invisible state every reader of
        // `messages` still has to account for, starting with "which turn is streaming".
        if (!reason) return stream.wroteSomething ? prev : withoutPlaceholder;

        // A greeting that failed under a conversation the hire can already read is not worth
        // saying. They did not ask for it -- it is a visit opening behind them -- and a red
        // banner under their own thread reports a problem they do not have. If they ask
        // something and *that* fails, the reply says so.
        if (!stream.wroteSomething && withoutPlaceholder.length > 0) return withoutPlaceholder;

        // Otherwise it is worth saying, and for opposite reasons. Either this is all there is,
        // and an empty thread would read as "there is no buddy here" rather than as a buddy
        // that could not be reached; or words did arrive and then stopped, and a greeting
        // ending mid-sentence needs the explanation more than a missing one does.
        return prev.map((message) => (message.id === id ? { ...message, error: reason } : message));
      });

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
    setMessages((prev) => [
      ...history.map((message) => ({
        ...message,
        id: crypto.randomUUID(),
        // The one-message window: a greeting nobody answered, replayed as it was.
        isGreeting: history.length === 1 && message.role === "ASSISTANT",
      })),
      ...prev,
    ]);
  }, []);

  /**
   * The conversation the hire was last in: their newest one, or a brand-new one when they
   * have none at all.
   *
   * Prefers the conversation this app session was already in when the list still holds it —
   * a team-mode round trip or a retry must not move the hire out of their conversation.
   * Memoised in flight, because the composer is live from the first paint: a send racing the
   * opening read must land on the same conversation, not create a second.
   */
  const resolveHireSession = useCallback(async (): Promise<string> => {
    if (resolvingRef.current) return resolvingRef.current;

    const pending = (async () => {
      const list = await getSessions();

      if (list.length > 0) {
        const previous = currentSessionIdRef.current;
        const chosen = list.some((session) => session.id === previous)
          ? (previous as string)
          : list[0].id;
        applySessions(list);
        applyCurrentSession(chosen);
        return chosen;
      }

      const createdId = await createSession();
      const created: BuddySessionSummary = {
        id: createdId,
        title: "",
        projectId: null,
        createdAt: new Date().toISOString(),
      };
      applySessions([created]);
      applyCurrentSession(createdId);
      return createdId;
    })();

    resolvingRef.current = pending;

    try {
      return await pending;
    } finally {
      resolvingRef.current = null;
    }
  }, [applySessions, applyCurrentSession]);

  /**
   * Re-reads the conversation list.
   *
   * The backend names a conversation from its first message, and the list is otherwise read
   * once at open and edited locally from there — so without this, every conversation started in
   * a session read "New conversation" in the rail until a reload. Called when a first turn
   * completes on a row that is still untitled; the refreshed read naturally stops needing it.
   */
  const refreshSessions = useCallback(async () => {
    try {
      const fetched = await getSessions();

      // The read is a moment, and a conversation created while it was in flight is newer
      // than that moment: it stays, in front, rather than being replaced away. Without the
      // merge, a slow refresh landing after a create dropped the new row from the rail until
      // a reload — and the reuse pick then read a list that no longer held it. (Nothing
      // deletes a conversation server-side yet; when one can, this needs the tombstone too.)
      const fetchedIds = new Set(fetched.map((session) => session.id));
      const createdMeanwhile = sessionsRef.current.filter((session) => !fetchedIds.has(session.id));

      applySessions([...createdMeanwhile, ...fetched]);
    } catch (e) {
      // Cosmetic only: the rail keeps the titles it has; the next completed turn tries again.
      console.error(e);
    }
  }, [applySessions]);

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

        // The read is for the conversation the caller asked for; if that stopped being the
        // one on screen while it was in flight, its history is not this thread's to show.
        // (Every way of switching refuses while an open is running, so this is the invariant
        // rather than the plan — kept structural for the next caller that forgets.)
        if (currentSessionIdRef.current !== sessionId) return;

        mergeHistory(history);

        if (
          history.length === 0 &&
          sessionsRef.current.length === 1 &&
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
    [greet, mergeHistory],
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
      const teamId = teamProjectIdRef.current;

      if (teamId === null) {
        const sessionId = await resolveHireSession();
        await openSession(sessionId);
      } else {
        const history = await getMessages(undefined, teamId);

        // Same invariant as `openSession`'s: a switch that happened while this read was in
        // flight makes the read stale, and stale history does not merge.
        if (teamProjectIdRef.current !== teamId) return;

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
      // The latch goes back, or one blip is permanent. This runs as the app root mounts, so the
      // request most likely to fail is the first one there will ever be -- and the widget never
      // unmounts, so the mount effect that called this will not call it again. Without the
      // release the hire has an empty thread, no history, no greeting, and no way back short of
      // a reload. `retryOpen` is what actually offers them one.
      loadedRef.current = false;
      setOpenError(HISTORY_FAILED);
    } finally {
      setIsOpening(false);
    }
  }, [resolveHireSession, openSession, mergeHistory, greet]);

  /**
   * Brings a conversation the hire picked from the list on screen.
   *
   * Reads it and shows it — no greeting: only the first, never-spoken conversation opens with
   * one (see `openSession`), and everything else is a continuing thing the hire asked to see
   * again, not a fresh start. Refused while anything is in flight, like every other move that
   * clears the thread.
   */
  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === currentSessionIdRef.current) return;
      if (teamProjectIdRef.current !== null) return;
      if (
        greetingRef.current ||
        isOpening ||
        isDeciding ||
        isThinking ||
        isStreaming ||
        pendingDecisionsRef.current > 0
      )
        return;
      greetingRef.current = true;

      applyCurrentSession(sessionId);
      setMessages([]);
      setOpenerAction(null);
      setOpenError(null);
      setDraftResetToken((token) => token + 1);
      // Bound to the offers of the conversation being left, not to the tab: a switch starts
      // with no wording of its own, like every other piece of session state here.
      setActionDrafts({});
      setActiveTool(null);
      setPresentedGreetingId(null);
      closeDinoGame();

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
    },
    [
      closeDinoGame,
      isOpening,
      isDeciding,
      isThinking,
      isStreaming,
      applyCurrentSession,
      openSession,
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
   * Refused while anything is in flight, for the same reason every other transcript-clearing
   * move is: a stream cannot call its callbacks into a thread that has just been cleared.
   * `pendingDecisionsRef` is read alongside the state — a decision and this click can land in
   * one frame, before the "deciding" state has re-rendered.
   */
  const newConversation = useCallback(async () => {
    // The conversations list is the hire's surface; team mode has one conversation per project
    // and nothing to start. The controls that call this are hidden there too, but a stale
    // keyboard shortcut must not switch a manager into an empty hire thread.
    if (teamProjectIdRef.current !== null) return;
    if (
      greetingRef.current ||
      isOpening ||
      isDeciding ||
      isThinking ||
      isStreaming ||
      pendingDecisionsRef.current > 0
    )
      return;

    // Bringing back a conversation nobody has spoken in beats stacking a second empty one:
    // the backend names a conversation from its first message, so an untitled newest row is
    // one nobody has written into — and the next reload would open it anyway. Without this,
    // leaving, switching back and pressing again piled up identical "New conversation" rows.
    // (A title that failed to generate server-side leaves a used row untitled too — rare,
    // and the reload this mirrors would open that same row.)
    const newest = sessionsRef.current[0];
    if (newest && newest.id !== currentSessionIdRef.current && newest.title.trim() === "") {
      await selectSession(newest.id);
      return;
    }

    greetingRef.current = true;
    // What this click saw, for the re-check after the create: the create is a round trip, and
    // a send that begins during it reads the session ref synchronously — it would land in the
    // conversation being left, and the clears below would wipe its optimistic turn while the
    // answer streamed into a thread nobody is looking at.
    const sessionAtEntry = currentSessionIdRef.current;
    const sendsAtEntry = sendCountRef.current;

    try {
      const createdId = await createSession();

      if (
        sendCountRef.current !== sendsAtEntry ||
        pendingDecisionsRef.current > 0 ||
        teamProjectIdRef.current !== null ||
        currentSessionIdRef.current !== sessionAtEntry
      ) {
        // Something moved while the create was in flight — a send, a decision, a mode
        // switch — and the click no longer describes the thread on screen. The new
        // conversation stays unadopted (a later refresh lists it) and the move the user
        // actually made keeps its turn.
        return;
      }

      const created: BuddySessionSummary = {
        id: createdId,
        title: "",
        projectId: null,
        createdAt: new Date().toISOString(),
      };
      // Newest first, like the backend's own ordering.
      applySessions([created, ...sessionsRef.current]);
      applyCurrentSession(createdId);

      setMessages([]);
      setOpenerAction(null);
      setOpenError(null);
      // The box is emptied through the token: a question typed about the conversation being
      // left is about a thread that no longer exists. See `draftResetToken`.
      setDraftResetToken((token) => token + 1);
      // Wording the hire had half-edited belonged to the offers that are going with the
      // transcript — it is not a composer draft and must not outlive them.
      setActionDrafts({});
      setActiveTool(null);
      setPresentedGreetingId(null);
      closeDinoGame();
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
    closeDinoGame,
    isOpening,
    isDeciding,
    isThinking,
    isStreaming,
    applySessions,
    applyCurrentSession,
    selectSession,
  ]);

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
    // Redo what actually failed: a failed "new conversation" retries as itself, because
    // `ensureOpened` would no-op out of it — the conversation is already loaded, and the
    // banner would clear while nothing else happened.
    if (retryRef.current === "newConversation") {
      retryRef.current = null;
      await newConversation();
      return;
    }
    await ensureOpened();
  }, [ensureOpened, newConversation]);

  /**
   * Marks the turn a reply was streaming into as failed, so the thread says so.
   *
   * Whatever arrived before the failure is kept: a half-written answer with a line under it
   * saying it stopped is more use than a bubble that silently ends mid-sentence. The turn is
   * also what makes the failure visible at all -- an assistant turn with no text and no error
   * renders as nothing, which left the hire's question sitting under a reply that never came.
   */
  const failReply = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, error: REPLY_FAILED } : message,
      ),
    );
  }, []);

  /**
   * Sends a new message and streams the buddy's reply into the conversation.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // See `sendCountRef`: this is what `newConversation` watches to tell that a send began
      // while its create was in flight.
      sendCountRef.current += 1;

      // The hire's surface must name the conversation it speaks into. The composer is live
      // from the first paint, so a send can beat the opening read; resolution is shared and
      // memoised in flight (`resolveHireSession`), so both land on the same conversation.
      let sessionId: string | undefined;
      if (teamProjectIdRef.current === null) {
        try {
          sessionId = currentSessionIdRef.current ?? (await resolveHireSession());
        } catch (e) {
          console.error(e);
          // The banner this puts up owns the retry, like every other failure site: a stale
          // "new conversation" marker must not outvote the move that actually failed.
          retryRef.current = null;
          setOpenError(HISTORY_FAILED);
          return;
        }
      }

      const userMessage: BuddyMessageView = {
        id: crypto.randomUUID(),
        role: "USER",
        content: text,
        createdAt: new Date().toISOString(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMessage: BuddyMessageView = {
        id: assistantId,
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
        citations: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsThinking(true);

      /**
       * Proposals held back until the reply is finished.
       *
       * The backend can emit `action_proposal` before it has written a word, which put an
       * "Accept this task" button on screen above an empty bubble — the hire was asked to agree
       * to something the buddy had not said yet. Buffering them costs nothing (a proposal is
       * inert until confirmed) and guarantees the only sane order: what it wants to do, then the
       * button that does it.
       */
      const proposed: ProposedAction[] = [];
      setActiveTool(null);
      // Once the hire says anything, the opener's one-click suggestion has served its purpose.
      setOpenerAction(null);

      // Whether this turn ran a tool that puts a card on the board, and whether it ran any tool at
      // all. Properties rather than `let`s, so the reads below see the writes made in the stream
      // callbacks — see `greet`.
      const touched = { board: false, any: false };

      /**
       * `place_card` is the one board write that is not confirmed: its `tool_use` event is the
       * whole signal the client gets, and it cannot say whether the tool wrote a card or was
       * refused. So the board is marked stale when the turn ends — the failing paths included.
       * See `useInvalidateBoard` for why the mark is what makes this visible.
       */
      //
      // Any tool, not only `place_card`: the backend grows tools faster than this list follows,
      // and a board that changed mid-answer and then waited for a manual refresh is the one thing
      // the hire notices. A re-read after a turn that only *read* something costs one request; a
      // missed one costs the hire's trust in what the board shows. The board only — the path's
      // "changed" signal stays for confirmed path actions, because the pages that listen to it
      // refetch whole steps and say so when that fails.
      const syncBoardIfTouched = () => {
        if (touched.board || touched.any) invalidateBoard();
      };

      try {
        await streamMessage(
          text,
          {
            onToolUse: (name) => {
              setActiveTool(name);
              touched.any = true;
              if (BUDDY_BOARD_TOOLS.has(name)) touched.board = true;
            },

            onToken: (token) => {
              setIsStreaming(true);
              setIsThinking(false);
              setActiveTool(null);

              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
              );
            },

            onCitation: (citation) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, citations: [...(m.citations ?? []), citation] }
                    : m,
                ),
              );
            },

            onActionProposal: (proposal) => {
              // The buddy is offering to do something. Nothing has changed yet and nothing will
              // until the hire confirms — so this is only recorded here, and attached to the reply
              // once the reply exists. The confirm payloads ride along so the action runs against
              // what the buddy actually proposed.
              setActiveTool(null);
              proposed.push({
                id: crypto.randomUUID(),
                action: proposal.action,
                label: proposal.label,
                question: proposal.question,
                taskId: proposal.taskId,
                title: proposal.title,
                attesterId: proposal.attesterId,
                githubLogin: proposal.githubLogin,
                competencyKey: proposal.competencyKey,
                level: proposal.level,
                checklistTitle: proposal.checklistTitle,
                checklistItems: proposal.checklistItems,
                cardId: proposal.cardId,
                noteText: proposal.noteText,
                lineBefore: proposal.lineBefore,
                lineAfter: proposal.lineAfter,
                stepId: proposal.stepId,
                questionId: proposal.questionId,
                phaseId: proposal.phaseId,
                onboardingTaskId: proposal.onboardingTaskId,
                answer: proposal.answer,
                optionIds: proposal.optionIds,
                description: proposal.description,
                reason: proposal.reason,
                waitsOnIds: proposal.waitsOnIds,
                unlocksIds: proposal.unlocksIds,
                linkUrl: proposal.linkUrl,
                linkLabel: proposal.linkLabel,
                cardIds: proposal.cardIds,
                cardNames: proposal.cardNames,
                preview: proposal.preview,
                status: "idle",
              });
            },

            onStoredProposal: (proposal) => {
              // A team-mode offer: stored server-side, confirmed by id. Recorded the same way —
              // held back until the reply exists, so the card never lands above an empty bubble.
              setActiveTool(null);
              proposed.push({
                id: crypto.randomUUID(),
                proposalId: proposal.proposalId,
                label: proposal.label,
                preview: proposal.preview,
                risk: proposal.risk,
                status: "idle",
              });
            },

            onDone: () => {
              setIsStreaming(false);
              // Also here, not only in `onToken`: a turn whose whole answer is a proposal never
              // emits a token, and the typing dots would sit under it forever.
              setIsThinking(false);
              setActiveTool(null);

              if (proposed.length > 0) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, actions: [...(m.actions ?? []), ...proposed] }
                      : m,
                  ),
                );
              }

              // The first completed turn is when the backend has named the conversation; while
              // its row is still untitled, re-read the list so the rail shows the name it just
              // wrote.
              if (sessionId !== undefined) {
                const summary = sessionsRef.current.find((session) => session.id === sessionId);
                if (summary && summary.title.trim() === "") void refreshSessions();
              }
            },

            onError: (err) => {
              console.error(err);
              setIsStreaming(false);
              setIsThinking(false);
              setActiveTool(null);
              failReply(assistantId);
            },
          },
          // Read at call time: a turn speaks to whichever conversation is current when it starts.
          sessionId,
          teamProjectIdRef.current ?? undefined,
          // The page the dock is floating over, for the buddy's app guide. Read from the window at
          // send time rather than through `useLocation`, which would re-render the one app-wide
          // conversation on every navigation to learn something only a send needs. The pathname
          // is all the guide matches on, so the query string stays on this side.
          window.location.pathname,
        );

        // The turn is over — the first moment a card placed mid-answer is certainly on the board.
        syncBoardIfTouched();
      } catch (e) {
        console.error(e);
        setIsStreaming(false);
        setIsThinking(false);
        setActiveTool(null);
        failReply(assistantId);
        // Same reason as above: a turn that placed a card and then broke still wrote it.
        syncBoardIfTouched();
      }
    },
    [failReply, invalidateBoard, resolveHireSession, refreshSessions],
  );

  /** Patches one proposed action in place, keyed by its message and action id. */
  const patchAction = useCallback((messageId: string, actionId: string, patch: ActionPatch) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) }
          : m,
      ),
    );
  }, []);

  // The one proposal currently on its way to the backend, per message and action id. A stored
  // proposal survives a reload server-side and the card disables its buttons while a confirm is
  // in flight — but two clicks inside one React frame both read the same pre-re-render state, so
  // the honest guard is here, where the second click is refused rather than re-sent.
  const inFlightRef = useRef<Set<string>>(new Set());

  /**
   * Records what the hire typed into a proposal's field, so it survives a closed dock, a handed-
   * over conversation and the retry a refusal offers — see `actionDrafts` for why it is session
   * state and not the card's own.
   */
  const setActionDraft = useCallback((key: string, text: string) => {
    setActionDrafts((current) => ({ ...current, [key]: text }));
  }, []);

  /**
   * Forgets a draft whose proposal is done with — it was sent, or the hire declined it. Nothing
   * is left to edit, and a card re-rendered later must not offer wording that has already left
   * the product.
   */
  const clearActionDraft = useCallback((key: string) => {
    setActionDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  /**
   * Confirms a proposed action: the one call that mutates. Reflects the outcome inline — a
   * legible line whether it changed something (`ok`) or legibly couldn't, or a retryable error
   * if the request itself failed.
   *
   * The two kinds confirm differently, and the split is what keeps each honest: a hire offer
   * echoes its own payload back (`performAction`), while a stored team proposal confirms by id
   * alone (`confirmStoredProposal`) — the client sends back exactly what it was given, nothing
   * derived. A `404` from either stored call arrives as a *resolved* outcome: the proposal was
   * already confirmed or dismissed (a reload between sessions, or a second tab), and the
   * backend's message says so legibly — not an error to retry.
   */
  const beginDecision = useCallback(() => {
    pendingDecisionsRef.current += 1;
    setIsDeciding(true);
  }, []);

  const endDecision = useCallback(() => {
    pendingDecisionsRef.current -= 1;
    if (pendingDecisionsRef.current === 0) setIsDeciding(false);
  }, []);

  const confirmAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      // Retryable after a transport error, and after a hire offer came back a legible "couldn't" —
      // that refusal is not always permanent, and the card offers it again. A stored team proposal
      // is never re-confirmable: resolved means the backend has already spoken for it. Anything on
      // its way, succeeded or declined is spent — confirming a success twice is how somebody
      // claims the same task twice.
      const isRetryableRefusal =
        action.status === "resolved" && action.ok === false && !("proposalId" in action);
      if (action.status !== "idle" && action.status !== "error" && !isRetryableRefusal) return;

      // One lock per proposal card, shared by both decisions: confirm and dismiss are the two
      // halves of one question, and letting both run would let the slower response overwrite
      // the truth the faster one already told.
      const flightKey = `${messageId}:${action.id}`;
      if (inFlightRef.current.has(flightKey)) return;
      inFlightRef.current.add(flightKey);
      beginDecision();

      patchAction(messageId, action.id, { status: "confirming" });
      // Fire-and-forget: the outcome lands back in message state, so the handler stays a plain
      // void callback (no Promise handed to a JSX prop).
      void (async () => {
        try {
          const result =
            "proposalId" in action
              ? await confirmStoredProposal(action.proposalId)
              : await performAction(action.action, {
                  question: action.question,
                  taskId: action.taskId,
                  title: action.title,
                  attesterId: action.attesterId,
                  githubLogin: action.githubLogin,
                  competencyKey: action.competencyKey,
                  level: action.level,
                  checklistTitle: action.checklistTitle,
                  checklistItems: action.checklistItems,
                  cardId: action.cardId,
                  noteText: action.noteText,
                  lineBefore: action.lineBefore,
                  lineAfter: action.lineAfter,
                  stepId: action.stepId,
                  questionId: action.questionId,
                  phaseId: action.phaseId,
                  onboardingTaskId: action.onboardingTaskId,
                  answer: action.answer,
                  optionIds: action.optionIds,
                  description: action.description,
                  reason: action.reason,
                  waitsOnIds: action.waitsOnIds,
                  unlocksIds: action.unlocksIds,
                  linkUrl: action.linkUrl,
                  linkLabel: action.linkLabel,
                  cardIds: action.cardIds,
                });
          patchAction(messageId, action.id, {
            status: "resolved",
            ok: result.ok,
            outcome: result.message,
          });
          // It went out: the wording has left the product, so the session keeps none of it. A
          // refusal keeps it — that card is about to be handed the hire's text back to correct.
          if (result.ok) clearActionDraft(actionDraftKey(messageId, action.id));
          // A path action just moved something on a page that may be open behind this dock. Told
          // rather than polled, and only on success: a refused confirm changed nothing to refresh.
          if (result.ok && "action" in action && BUDDY_PATH_ACTIONS.includes(action.action)) {
            announceBuddyPathChanged();
          }

          // `board.all()`, not a project key: the backend re-resolves the project server-side
          // (the caller's single onboarding project) and never tells the client which board —
          // see `useInvalidateBoard`.
          if (result.ok && "action" in action && BUDDY_BOARD_ACTIONS.has(action.action)) {
            invalidateBoard();
          }
        } catch (e) {
          console.error(e);
          // A settled proposal does NOT come back 404 — the backend answers 200 with ok: false
          // and the exact sentence for what happened (already confirmed, expired, beaten to it).
          // All of that is handled above. A 404 here means no such proposal exists for this
          // caller at all: retrying cannot help, so the card resolves legibly instead.
          patchAction(
            messageId,
            action.id,
            isNotFound(e)
              ? {
                  status: "resolved",
                  ok: false,
                  outcome: PROPOSAL_GONE,
                }
              : { status: "error" },
          );
        } finally {
          inFlightRef.current.delete(flightKey);
          endDecision();
        }
      })();
    },
    [beginDecision, endDecision, patchAction, invalidateBoard, clearActionDraft],
  );

  /**
   * Declines a proposed action — nothing changes; the conversation simply continues.
   *
   * The action itself arrives from the card that drew it, the way `confirmAction`'s does. It used
   * to arrive as an id and be looked up in the transcript, which is what forced a
   * `messagesRef` to keep this callback's identity stable — the callback now depends on nothing
   * that a token can change, and the lookup (and its staleness question) is gone with it.
   *
   * A stored proposal is declined *at the backend* rather than only on screen, because it may
   * also be sitting in another tab waiting to be confirmed: dismissal closes that door too, and
   * only the backend can. A hire offer was never stored, so there is nothing to tell the
   * backend — declining is purely local, as it has always been.
   */
  const dismissAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      const actionId = action.id;

      // A hire offer, or one that arrived without its details: nothing to decline at the backend,
      // but still worth putting away here.
      if (!("proposalId" in action)) {
        patchAction(messageId, actionId, { status: "dismissed" });
        // A hire offer is the only kind that carries a draft, and this is the one place one is
        // declined — the wording goes with the offer it belonged to.
        clearActionDraft(actionDraftKey(messageId, actionId));
        return;
      }

      if (action.status !== "idle" && action.status !== "error") return;

      // The confirm's lock, shared: one question, one in-flight decision.
      const flightKey = `${messageId}:${actionId}`;
      if (inFlightRef.current.has(flightKey)) return;
      inFlightRef.current.add(flightKey);
      beginDecision();

      patchAction(messageId, actionId, { status: "confirming" });
      void (async () => {
        try {
          // The backend owns the truth here: a 200 with ok: false means the proposal was
          // already confirmed (or expired, or beaten to it) and its message says exactly what
          // happened — surfacing that beats claiming "Dismissed — nothing changed" over a
          // change that may already have happened.
          const result = await dismissStoredProposal(action.proposalId);
          patchAction(
            messageId,
            actionId,
            result.ok
              ? { status: "dismissed" }
              : { status: "resolved", ok: false, outcome: result.message },
          );
        } catch (e) {
          console.error(e);
          // 404: no such proposal for this caller. Retrying cannot help, so the card resolves
          // legibly instead. Any other failure keeps the offer on the table: the card's own
          // error note would read as if the dismissal had half-happened, so it goes back to
          // idle and stays retryable.
          patchAction(
            messageId,
            actionId,
            isNotFound(e)
              ? { status: "resolved", ok: false, outcome: PROPOSAL_GONE }
              : { status: "idle" },
          );
        } finally {
          inFlightRef.current.delete(flightKey);
          endDecision();
        }
      })();
    },
    [beginDecision, endDecision, patchAction, clearActionDraft],
  );

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
    if (
      isThinking ||
      isStreaming ||
      isOpening ||
      isGreeting ||
      isDeciding ||
      pendingDecisionsRef.current > 0
    )
      return;

    openedForRef.current = target;
    teamProjectIdRef.current = teamProjectId;

    setMessages([]);
    setOpenerAction(null);
    setOpenError(null);
    // Same rule as a fresh visit: the words belonged to the conversation that just went away.
    setDraftResetToken((token) => token + 1);
    // Bound to the offers of the conversation being left, not to the tab: a switch starts
    // with no wording of its own, like every other piece of session state here.
    setActionDrafts({});
    setActiveTool(null);
    setIsThinking(false);
    setIsStreaming(false);
    setPresentedGreetingId(null);
    // The latch is per conversation: releasing it is what lets `ensureOpened` read and greet
    // the one being switched to, exactly as it did the first time.
    loadedRef.current = false;
    // A game left open from the previous conversation would keep claiming "Reply ready" for a
    // thread that has just been cleared.
    closeDinoGame();

    void ensureOpened();
  }, [
    teamProjectId,
    isThinking,
    isStreaming,
    isOpening,
    isGreeting,
    isDeciding,
    ensureOpened,
    closeDinoGame,
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
      if (
        isThinking ||
        isStreaming ||
        isOpening ||
        isGreeting ||
        isDeciding ||
        pendingDecisionsRef.current > 0
      )
        return;

      if (projectId === null) {
        setTeamMode(false);
        return;
      }

      selection.setSelectedProjectId(projectId);
      // Bind the conversation target before the derived value settles, so the adopt/exit
      // effect sees a matching pair and does not read the buddy's own switch as an exit.
      teamTargetRef.current = projectId;
      setTeamMode(true);
    },
    [isThinking, isStreaming, isOpening, isGreeting, isDeciding, selection, setTeamMode],
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

    // The composer's words live in `BuddyDraftProvider`, below this provider; this is the only
    // thing about them the session still owns — the news that the thread they belonged to is
    // gone. See `draftResetToken`.
    draftResetToken,
    // The same idea for the fields a proposal carries: a flag's question is the hire's to word,
    // and the session is what keeps that wording across a closed dock and a handed-over page.
    actionDrafts,
    setActionDraft,
    sendMessage,
    confirmAction,
    dismissAction,

    dinoGameActive,
    closeDinoGame,
    dinoUnlocked,
    registerDinoSurface,

    ensureOpened,
    retryOpen,

    // The conversations on this surface: what the hire has, which one is on screen, and the
    // two moves across them. A new conversation starts empty — the composer is the hire's
    // from there (see `newConversation`).
    sessions,
    currentSessionId,
    newConversation,
    selectSession,

    presentedGreetingId,
    markGreetingPresented: setPresentedGreetingId,
  };
}
