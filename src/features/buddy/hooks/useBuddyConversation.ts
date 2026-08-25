import { useCallback, useRef, useState } from "react";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame";
import { matchEggPhrase } from "../../easter-eggs/lib/eggPhrases";
import { playEggEffect } from "../../easter-eggs/eggEffectBus";
import {
  getMessages,
  streamOpenBuddy,
  performAction,
  streamMessage,
  type BuddyOpeningAction,
} from "../../../services/buddyService";
import type { BuddyMessageView, ProposedAction } from "../types";

/**
 * What the hire is told when a stream does not finish.
 *
 * Plain, and never the raw failure: a transport message or an HTTP status answers a question
 * nobody asked. What matters is whether trying again is worth it, so each line says so.
 */
const REPLY_FAILED = "Your buddy could not finish that reply. Ask again in a moment.";
const GREETING_FAILED = "Your buddy could not be reached just now.";
const HISTORY_FAILED = "Your conversation could not be loaded.";

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
export function useBuddyConversation() {
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // The tool the buddy is running right now, if any -- drives "Checking your progress…"
  // in place of a generic spinner. Cleared as soon as the answer starts streaming.
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Dino waiting-game: unlocked users may press Space while the buddy thinks
  // to play the runner until the answer arrives — the same deal the AI chat
  // offers. Closing is handled inside the hook: on exit, when the turn ends,
  // or when the cogwheel unlock flag flips off.
  const dinoUnlocked = useDinoUnlocked();
  const [dinoGameActive, closeDinoGame] = useSpaceOpensDino(isThinking, dinoUnlocked);
  const [prevBuddyBusy, setPrevBuddyBusy] = useState(false);
  if (prevBuddyBusy !== (isThinking || isStreaming)) {
    setPrevBuddyBusy(isThinking || isStreaming);
    if (!isThinking && !isStreaming && dinoGameActive) {
      closeDinoGame();
    }
  }

  // The one suggested next step the opening greeting invites, until the hire acts or asks.
  const [openerAction, setOpenerAction] = useState<BuddyOpeningAction | null>(null);
  // True while a surface is opening the conversation, so it can show a loading state rather
  // than an empty thread. Starts false: nothing is opening until somebody asks.
  const [isOpening, setIsOpening] = useState(false);
  // Set when the conversation could not be brought on screen at all -- distinct from a turn that
  // failed, which carries its own reason. Nothing is on screen to hang that on, so it is state.
  const [openError, setOpenError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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
      },
    ]);

    // Read back after the stream, which is why it is a bag rather than two `let`s: the compiler
    // narrows a local to its initial value when the only writes are inside callbacks, so the
    // reason would type as `null` at the point it is used. A property's narrowing is dropped at
    // the call, which is exactly the behaviour wanted here.
    const stream = { wroteSomething: false, failure: null as string | null };

    try {
      await streamOpenBuddy({
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
      });
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
      const history = await getMessages();
      // Merged in front of whatever is already there, never assigned over it. The fetch is in
      // flight while the composer is live, so a hire who types straight away has an optimistic
      // turn in the list by the time this resolves — assigning would delete their own message
      // out from under them. History is older, so it belongs in front.
      setMessages((prev) => [
        ...history.map((message) => ({ ...message, id: crypto.randomUUID() })),
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
    if (greetingRef.current) return;
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
  }, [greet]);

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
        await streamMessage(text, {
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
                m.id === assistantId ? { ...m, citations: [...(m.citations ?? []), citation] } : m,
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
                  m.id === assistantId ? { ...m, actions: [...(m.actions ?? []), ...proposed] } : m,
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
        });
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
  const patchAction = useCallback(
    (messageId: string, actionId: string, patch: Partial<ProposedAction>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) }
            : m,
        ),
      );
    },
    [],
  );

  /**
   * Confirms a proposed action: the one call that mutates. Reflects the outcome inline — a
   * legible line whether it changed something (`ok`) or legibly couldn't, or a retryable error
   * if the request itself failed.
   */
  const confirmAction = useCallback(
    (messageId: string, action: ProposedAction) => {
      patchAction(messageId, action.id, { status: "confirming" });
      // Fire-and-forget: the outcome lands back in message state, so the handler stays a plain
      // void callback (no Promise handed to a JSX prop).
      void (async () => {
        try {
          const result = await performAction(action.action, {
            question: action.question,
            taskId: action.taskId,
            title: action.title,
            attesterId: action.attesterId,
            githubLogin: action.githubLogin,
            competencyKey: action.competencyKey,
            level: action.level,
          });
          patchAction(messageId, action.id, {
            status: "resolved",
            ok: result.ok,
            outcome: result.message,
          });
        } catch (e) {
          console.error(e);
          patchAction(messageId, action.id, { status: "error" });
        }
      })();
    },
    [patchAction],
  );

  /** Declines a proposed action — nothing changes; the conversation simply continues. */
  const dismissAction = useCallback(
    (messageId: string, actionId: string) => {
      patchAction(messageId, actionId, { status: "dismissed" });
    },
    [patchAction],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      // Easter-egg phrases are intercepted before anything is sent: the
      // effect plays app-wide (EggEffectsLayer) and the message is swallowed
      // silently — no reply, no request. Same contract as the AI chat.
      const eggEffect = matchEggPhrase(draft);
      if (eggEffect) {
        setDraft("");
        playEggEffect(eggEffect);
        return;
      }

      const text = draft;
      if (!text.trim()) return;

      setDraft("");
      void sendMessage(text);
    },
    [draft, sendMessage, setDraft],
  );

  return {
    messages,
    isThinking,
    isStreaming,
    activeTool,
    openerAction,
    isOpening,
    openError,

    draft,
    setDraft,
    sendMessage,
    handleSubmit,
    confirmAction,
    dismissAction,

    dinoGameActive,
    closeDinoGame,
    dinoUnlocked,

    ensureOpened,
    retryOpen,
    startFreshVisit,
  };
}
