import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMessages,
  streamOpenBuddy,
  performAction,
  confirmStoredProposal,
  dismissStoredProposal,
  streamMessage,
  type BuddyOpeningAction,
} from "../../../services/buddyService";
import { useAuth } from "../../../context/useAuth";
import type { ActionPatch, BuddyMessageView, ProposedAction } from "../types";

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
/** The one sentence for a proposal that no longer exists for this caller (HTTP 404). */
const PROPOSAL_GONE = "This proposal is no longer available.";

function isNotFound(e: unknown): boolean {
  return e instanceof Error && "status" in e && (e as { status: number }).status === 404;
}

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
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);
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
  const [draft, setDraft] = useState("");
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
  useEffect(() => {
    userIdRef.current = userId;
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
  const teamTargetRef = useRef<string | null>(null);

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
  // Guards the greeting against overlapping calls — see `startFreshVisit`.
  const greetingRef = useRef(false);

  /**
   * Streams the buddy's opening greeting into the thread, *under* whatever is already there.
   *
   * Appending rather than replacing is what lets a visit open beneath a conversation the hire
   * can still read. It used to replace the list, which was safe only while this was reached
   * for an empty visit — and that restriction is exactly what left the buddy's memory-grounded
   * greeting unreachable in normal use (see [ensureOpened]).
   *
   * The greeting is a single growing message rather than one per token, so the hire watches it
   * being written instead of watching messages pile up.
   */
  const greet = useCallback(async () => {
    const id = crypto.randomUUID();

    // Its place in the thread is claimed *before* the stream is awaited, not on the first
    // token. The composer is live while the greeting is being written, so a hire who types
    // straight away would otherwise have their question appended first and the greeting land
    // underneath it — answering nothing, with a "New conversation" divider in the wrong place.
    // An empty assistant turn renders nothing (see `BuddyThread`), so the placeholder is
    // invisible until the first word arrives.
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
        citations: [],
        // Only worth marking when there is something above it to be divided from.
        startsVisit: prev.length > 0,
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
        // Read at call time, not captured: the greeting is for whichever conversation is current
        // when it runs, and a switch that lands between turns opens the right one.
        teamProjectIdRef.current ?? undefined,
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

  /**
   * Brings the conversation on screen, once per session.
   *
   * **It reads first, then opens a visit under what it read.** Both halves matter, and each
   * fixes the opposite failure.
   *
   * Reading first: a visit *ends* when the hire speaks, so a later open writes a new opening
   * marker and `getMessagesForMe` reads back only to the last one. Opening blind — which is
   * what the page and the mount-time warm-up both used to do — therefore replaced the hire's
   * conversation with a greeting on every reload. Nothing was deleted by that (the transcript
   * stays in `buddy_messages`, and the memory note is folded by a separate background pass),
   * but their scrollback moved past it, which is indistinguishable from loss.
   *
   * Opening anyway: the greeting is the *only* thing that reads the buddy's durable memory, so
   * a client that never opened one made the whole continuity mechanism unreachable except by
   * pressing "new chat" by hand. Continuity you have to ask for is not continuity. The previous
   * conversation stays on screen and the new visit begins beneath it — see `startsVisit` for
   * the divider that says so.
   *
   * What one visit's window holds is therefore the last conversation plus this one. Anything
   * older is out of reach: `getMessagesForMe` stops at the last marker, and no hire-facing
   * endpoint exposes what came before it.
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
      const history = await getMessages(teamProjectIdRef.current ?? undefined);
      // Merged in front of whatever is already there, never assigned over it. The fetch is in
      // flight while the composer is live, so a hire who types straight away has an optimistic
      // turn in the list by the time this resolves — assigning would delete their own message
      // out from under them. History is older, so it belongs in front.
      setMessages((prev) => [
        ...history.map((message) => ({
          ...message,
          id: crypto.randomUUID(),
          // The one-message window below: a greeting nobody answered, replayed as it was.
          isGreeting: history.length === 1 && message.role === "ASSISTANT",
        })),
        ...prev,
      ]);

      // A window of exactly one message is a greeting nobody answered: the window begins at an
      // opening marker, so nothing after it means the hire never spoke. The backend would
      // replay that same greeting rather than write a new one, and appending it would put the
      // same words on screen twice.
      if (history.length === 1) return;

      greetingRef.current = true;
      try {
        await greet();
      } finally {
        greetingRef.current = false;
      }
    } catch (e) {
      console.error(e);
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
  }, [greet]);

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
    await ensureOpened();
  }, [ensureOpened]);

  /**
   * Starts a new visit: clears the scrollback and greets again.
   *
   * The backend's rule is that *a visit ends when the hire speaks*, so opening once they have
   * writes a fresh opening marker — and `getMessagesForMe` returns from the last marker onward.
   * Asking to open again is therefore all a "new chat" is; there is no reset endpoint and none
   * is needed.
   *
   * Nothing is deleted. The whole transcript stays in `buddy_messages`, and the buddy's durable
   * memory note is untouched — it is what the greeting is written from, which is why starting
   * fresh does not mean starting over. Only the hire's scrollback moves on.
   */
  const startFreshVisit = useCallback(async () => {
    // The button stays enabled while the greeting is written, so a second click would run a
    // second open. The backend replays the greeting it has just written rather than composing
    // another, so the hire would read the identical words twice.
    // `pendingDecisionsRef` is read alongside the state: a decision and this click can land
    // in one frame, before the "deciding" state has re-rendered.
    if (greetingRef.current || isDeciding || pendingDecisionsRef.current > 0) return;
    greetingRef.current = true;

    setMessages([]);
    setOpenerAction(null);
    setOpenError(null);
    setDraft("");
    setIsOpening(true);
    try {
      await greet();
    } catch (e) {
      console.error(e);
    } finally {
      greetingRef.current = false;
      setIsOpening(false);
    }
  }, [greet, isDeciding]);

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

      try {
        await streamMessage(
          text,
          {
            onToolUse: (name) => {
              setActiveTool(name);
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
          teamProjectIdRef.current ?? undefined,
        );
      } catch (e) {
        console.error(e);
        setIsStreaming(false);
        setIsThinking(false);
        setActiveTool(null);
        failReply(assistantId);
      }
    },
    [failReply],
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
                });
          patchAction(messageId, action.id, {
            status: "resolved",
            ok: result.ok,
            outcome: result.message,
          });
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
    [beginDecision, endDecision, patchAction],
  );

  /**
   * Declines a proposed action — nothing changes; the conversation simply continues.
   *
   * A stored proposal is declined *at the backend* rather than only on screen, because it may
   * also be sitting in another tab waiting to be confirmed: dismissal closes that door too, and
   * only the backend can. A hire offer was never stored, so there is nothing to tell the
   * backend — declining is purely local, as it has always been.
   */
  const dismissAction = useCallback(
    (messageId: string, actionId: string) => {
      const action = messages
        .find((m) => m.id === messageId)
        ?.actions?.find((a) => a.id === actionId);

      // Unknown action: nothing to decline at the backend, but still worth putting away here.
      if (!action || !("proposalId" in action)) {
        patchAction(messageId, actionId, { status: "dismissed" });
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
    [beginDecision, endDecision, messages, patchAction],
  );

  /**
   * The thread on screen always belongs to exactly one conversation, and when the derived
   * target moves — a switch, a restored preference arriving, an involuntary exit — the thread
   * is cleared and the new conversation opens exactly as an untouched visit would: read first,
   * then greeted. The backend keeps the conversations separate, so reusing the latch would show
   * one inside the other. Mid-turn the move waits: the busy flags are in the dependency list,
   * so the effect re-runs the moment the turn ends and applies then.
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
    setDraft("");
    setActiveTool(null);
    setIsThinking(false);
    setIsStreaming(false);
    setPresentedGreetingId(null);
    // The latch is per conversation: releasing it is what lets `ensureOpened` read and greet
    // the one being switched to, exactly as it did the first time.
    loadedRef.current = false;

    void ensureOpened();
  }, [teamProjectId, isThinking, isStreaming, isOpening, isGreeting, isDeciding, ensureOpened]);

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

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const text = draft;
      if (!text.trim()) return;

      setDraft("");
      void sendMessage(text);
    },
    [draft, sendMessage],
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

    draft,
    setDraft,
    sendMessage,
    handleSubmit,
    confirmAction,
    dismissAction,

    ensureOpened,
    retryOpen,
    startFreshVisit,

    presentedGreetingId,
    markGreetingPresented: setPresentedGreetingId,
  };
}
